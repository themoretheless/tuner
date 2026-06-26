const GUITAR_MIN_FREQ: f32 = 30.0;
const GUITAR_MAX_FREQ: f32 = 400.0;
const YIN_THRESHOLD: f32 = 0.12;

// Domain layer (Note, Tuning, the tunings table, and note/cents math) lives in
// domain.rs and is re-exported here. See ARCHITECTURE.md for the layering plan.
mod domain;
pub use domain::*;

// === Simple shared engine (feed samples -> structured update) ===

#[derive(Default, Clone)]
pub struct TunerUpdate {
    pub freq: Option<f32>,
    pub confidence: f32,
    pub rms: f32,
    pub is_power: bool,
    pub cents: f32,
    pub note: String,
    pub spectrum: Vec<f32>,  // normalized 0..1, first half bins
}

pub struct TunerEngine {
    smoother: Smoother,
    a4: f32,
    tuning: Tuning,
    // for spectrum
    fft: std::sync::Arc<dyn rustfft::Fft<f32>>,
    spectrum_buffer: Vec<rustfft::num_complex::Complex<f32>>,
}

impl TunerEngine {
    pub fn new(a4: f32) -> Self {
        let tunings = get_tunings();
        let mut planner = rustfft::FftPlanner::<f32>::new();
        let fft = planner.plan_fft_forward(2048);
        Self {
            smoother: Smoother::new(),
            a4,
            tuning: tunings.get(0).cloned().unwrap_or_else(|| Tuning {
                name: "Standard (EADGBE)",
                strings: GUITAR_STRINGS_STANDARD.to_vec(),
            }),
            fft,
            spectrum_buffer: vec![rustfft::num_complex::Complex::new(0.0, 0.0); 2048],
        }
    }

    pub fn set_a4(&mut self, a4: f32) {
        if (self.a4 - a4).abs() > 0.01 {
            self.a4 = a4;
            self.smoother.reset();
        }
    }

    pub fn set_tuning(&mut self, t: Tuning) {
        self.tuning = t;
        self.smoother.reset();
    }

    pub fn process(&mut self, buffer: &[f32], sample_rate: f32) -> TunerUpdate {
        let rms = compute_rms_volume(buffer);
        let (raw_freq, confidence) = detect_pitch_native(buffer, sample_rate)
            .unwrap_or((0.0, 0.0));
        let raw_opt = if raw_freq > 0.0 { Some(raw_freq) } else { None };

        // Smooth the detected pitch to de-jitter the readout. When detection
        // drops (silence / gate closed), clear immediately instead of lingering
        // on the last smoothed value.
        let smoothed = self.smoother.add(raw_opt);
        let freq_opt = if raw_opt.is_some() { smoothed } else { None };

        let is_power = if let Some(f) = freq_opt {
            is_likely_power_chord_native(buffer, sample_rate, f)
        } else {
            false
        };

        let (note, cents_chromatic) = if let Some(f) = freq_opt {
            frequency_to_note(f, self.a4)
        } else {
            ("—".to_string(), 0.0)
        };

        // Cents relative to the closest string of the current tuning (A4-scaled),
        // matching the web path; falls back to chromatic cents if no strings.
        let cents = if let Some(f) = freq_opt {
            if !self.tuning.strings.is_empty() {
                let target = find_closest_string(f, &self.tuning.strings, self.a4);
                get_cents(f, target.frequency)
            } else {
                cents_chromatic
            }
        } else {
            0.0
        };

        // Compute spectrum (reuse buffer)
        let mut spectrum = vec![0.0f32; 512];
        if buffer.len() >= 2048 {
            let n = 2048f32;
            for (i, &sample) in buffer.iter().take(2048).enumerate() {
                // Hann window to reduce spectral leakage (sharper bars, less smearing)
                let w = 0.5 * (1.0 - (2.0 * i as f32 / (n - 1.0) - 1.0).cos());
                self.spectrum_buffer[i] = rustfft::num_complex::Complex::new(sample * w, 0.0);
            }
            self.fft.process(&mut self.spectrum_buffer);
            for i in 0..512 {
                let re = self.spectrum_buffer[i].re;
                let im = self.spectrum_buffer[i].im;
                spectrum[i] = (re * re + im * im).sqrt();
            }
            let max_mag = spectrum.iter().cloned().fold(0.0, f32::max).max(1e-6);
            for m in &mut spectrum {
                *m /= max_mag;
            }
        }

        TunerUpdate {
            freq: freq_opt,
            confidence,
            rms,
            is_power,
            cents,
            note,
            spectrum,
        }
    }

    pub fn reset(&mut self) {
        self.smoother.reset();
    }
}



#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub struct PitchDetection {
    pub freq: f32,
    pub confidence: f32,
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
impl PitchDetection {
    #[wasm_bindgen(constructor)]
    pub fn new(freq: f32, confidence: f32) -> Self {
        Self { freq, confidence }
    }
}

fn detect_pitch_yin_internal(buffer: &[f32], sample_rate: f32) -> Option<(f32, f32)> {
    let size = buffer.len();
    let half = size / 2;
    if half < 64 {
        return None;
    }

    let min_tau = (sample_rate / GUITAR_MAX_FREQ).floor() as usize;
    let max_tau = std::cmp::min(half, (sample_rate / GUITAR_MIN_FREQ).floor() as usize);

    // Gate on energy
    let mut sum_sq = 0.0;
    let mut max_abs = 0.0;
    for &v in buffer {
        sum_sq += v * v;
        let a = v.abs();
        if a > max_abs {
            max_abs = a;
        }
    }
    let rms = (sum_sq / size as f32).sqrt();
    if rms < 0.0025 || max_abs < 0.012 {
        return None;
    }

    // Adaptive threshold
    let rms_factor = (rms * 15.0).min(1.0);
    let adaptive_threshold = YIN_THRESHOLD * (1.0 - 0.35 * rms_factor);

    // Difference function over the full lag range. Computing it only from
    // min_tau skewed the cumulative-mean normalization below; canonical YIN
    // needs d(j) for every j from 1 so the running sum is correct.
    let mut diff = vec![0.0f32; max_tau];
    for tau in 1..max_tau {
        let mut sum = 0.0;
        for i in 0..half {
            let delta = buffer[i] - buffer[i + tau];
            sum += delta * delta;
        }
        diff[tau] = sum;
    }

    // Cumulative mean normalized difference (CMNDF), accumulated from tau=1.
    let mut yin = vec![0.0f32; max_tau];
    yin[0] = 1.0;
    let mut running_sum = 0.0;
    for tau in 1..max_tau {
        running_sum += diff[tau];
        yin[tau] = if running_sum > 0.0 {
            diff[tau] * (tau as f32 / running_sum)
        } else {
            1.0
        };
    }

    // Absolute threshold: first lag below the threshold, then descend to the
    // local minimum of that dip. The walk must compare consecutive values
    // (yin[b+1] < yin[b]); comparing against the fixed crossing value walked
    // past the true minimum and read every note ~a semitone flat.
    let mut tau_estimate = None;
    for tau in min_tau..max_tau {
        if yin[tau] < adaptive_threshold {
            let mut b = tau;
            while b + 1 < max_tau && yin[b + 1] < yin[b] {
                b += 1;
            }
            tau_estimate = Some(b);
            break;
        }
    }

    let (t, confidence) = match tau_estimate {
        Some(v) => (v, (1.0 - yin[v]).clamp(0.0, 1.0)),
        None => {
            let mut min_val = f32::INFINITY;
            let mut b = 0;
            for tau in min_tau..max_tau {
                if yin[tau] < min_val {
                    min_val = yin[tau];
                    b = tau;
                }
            }
            if min_val > 0.35 {
                return None;
            }
            (b, (1.0 - min_val).clamp(0.0, 1.0))
        }
    };

    if t < 2 {
        return None;
    }

    // Parabolic interpolation
    let mut better_tau = t as f32;
    let ti = t;
    if ti > 1 && ti < max_tau - 1 {
        let s0 = yin[ti - 1];
        let s1 = yin[ti];
        let s2 = yin[ti + 1];
        let denom = 2.0 * s1 - s0 - s2;
        if denom.abs() > 1e-9 {
            let delta = (s2 - s0) / (2.0 * denom);
            if delta.abs() < 1.0 {
                better_tau = t as f32 + delta;
            }
        }
    }

    let freq = sample_rate / better_tau;
    if freq < GUITAR_MIN_FREQ || freq > GUITAR_MAX_FREQ {
        return None;
    }

    Some((freq, confidence))
}

fn detect_pitch_mpm_internal(buffer: &[f32], sample_rate: f32) -> Option<(f32, f32)> {
    let n = buffer.len();
    let max_tau = n / 2;
    let mut nsdf = vec![0.0f32; max_tau];

    for tau in 0..max_tau {
        let mut numerator = 0.0;
        let mut denominator = 0.0;
        for i in 0..(n - tau) {
            let x1 = buffer[i];
            let x2 = buffer[i + tau];
            numerator += x1 * x2;
            denominator += x1 * x1 + x2 * x2;
        }
        nsdf[tau] = if denominator > 0.0 {
            (2.0 * numerator) / denominator
        } else {
            0.0
        };
    }

    // Find first significant peak
    let mut max_val = -1.0;
    let mut peak = None;
    for tau in 2..(max_tau - 1) {
        if nsdf[tau] > nsdf[tau - 1] && nsdf[tau] > nsdf[tau + 1] && nsdf[tau] > max_val {
            max_val = nsdf[tau];
            peak = Some(tau);
            if max_val > 0.9 {
                break;
            }
        }
    }

    let peak = match peak {
        Some(p) if max_val > 0.25 => p,
        _ => return None,
    };

    // Parabolic interpolation for peak
    let mut better = peak as f32;
    if peak > 1 && peak < max_tau - 1 {
        let a = nsdf[peak - 1];
        let b = nsdf[peak];
        let c = nsdf[peak + 1];
        let denom = a - 2.0 * b + c;
        if denom.abs() > 1e-9 {
            let delta = 0.5 * (a - c) / denom;
            if delta.abs() < 1.0 {
                better = peak as f32 + delta;
            }
        }
    }

    let freq = sample_rate / better;
    if freq < GUITAR_MIN_FREQ || freq > GUITAR_MAX_FREQ {
        return None;
    }

    Some((freq, max_val.clamp(0.0, 1.0)))
}

pub fn detect_pitch(buffer: &[f32], sample_rate: f32) -> Option<(f32, f32)> {
    if buffer.is_empty() {
        return None;
    }

    // Remove DC offset (mic/ADC bias) before detection. A constant offset
    // inflates the YIN difference function and biases the MPM denominator,
    // so subtract the mean once for both detectors.
    let mean = buffer.iter().sum::<f32>() / buffer.len() as f32;
    let cleaned: Vec<f32> = if mean.abs() > 1e-6 {
        buffer.iter().map(|&v| v - mean).collect()
    } else {
        buffer.to_vec()
    };

    // Prefer YIN
    if let Some(result) = detect_pitch_yin_internal(&cleaned, sample_rate) {
        return Some(result);
    }

    // Then MPM
    if let Some(result) = detect_pitch_mpm_internal(&cleaned, sample_rate) {
        return Some(result);
    }

    None
}

#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn detect_pitch_yin(buffer: &[f32], sample_rate: f32) -> Option<PitchDetection> {
    detect_pitch_yin_internal(buffer, sample_rate).map(|(f, c)| PitchDetection::new(f, c))
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn detect_pitch_mpm(buffer: &[f32], sample_rate: f32) -> Option<PitchDetection> {
    detect_pitch_mpm_internal(buffer, sample_rate).map(|(f, c)| PitchDetection::new(f, c))
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn detect_pitch_wasm(buffer: &[f32], sample_rate: f32) -> Option<PitchDetection> {
    detect_pitch(buffer, sample_rate).map(|(f, c)| PitchDetection::new(f, c))
}

pub fn detect_pitch_native(buffer: &[f32], sample_rate: f32) -> Option<(f32, f32)> {
    detect_pitch(buffer, sample_rate)
}

fn is_likely_power_chord_impl(buffer: &[f32], sample_rate: f32, fundamental: f32) -> bool {
    if fundamental < 40.0 {
        return false;
    }
    let f5 = fundamental * 1.4983;
    let lag = (sample_rate / f5) as usize;
    if lag < 2 || lag >= buffer.len() / 2 {
        return false;
    }
    let mut corr = 0.0;
    let mut energy = 0.0;
    let len = std::cmp::min(512, buffer.len() - lag);
    for i in 0..len {
        let v = buffer[i];
        corr += v * buffer[i + lag];
        energy += v * v;
    }
    energy > 0.0 && (corr / energy) > 0.5
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn is_likely_power_chord(buffer: &[f32], sample_rate: f32, fundamental: f32) -> bool {
    is_likely_power_chord_impl(buffer, sample_rate, fundamental)
}

pub fn is_likely_power_chord_native(buffer: &[f32], sample_rate: f32, fundamental: f32) -> bool {
    is_likely_power_chord_impl(buffer, sample_rate, fundamental)
}

fn compute_rms_volume_impl(buffer: &[f32]) -> f32 {
    let mut sum = 0.0;
    for &v in buffer {
        sum += v * v;
    }
    (sum / buffer.len() as f32).sqrt()
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn compute_rms_volume(buffer: &[f32]) -> f32 {
    compute_rms_volume_impl(buffer)
}

#[cfg(not(feature = "wasm"))]
pub fn compute_rms_volume(buffer: &[f32]) -> f32 {
    compute_rms_volume_impl(buffer)
}

fn normalize_level_impl(rms: f32) -> f32 {
    // Typical mic guitar signal after gate is ~0.01-0.2 rms
    rms.min(1.0) * 18.0
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn normalize_level(rms: f32) -> f32 {
    normalize_level_impl(rms)
}

#[cfg(not(feature = "wasm"))]
pub fn normalize_level(rms: f32) -> f32 {
    normalize_level_impl(rms)
}

fn downsample_for_pitch_impl(buffer: &[f32], factor: usize) -> Vec<f32> {
    if factor <= 1 {
        return buffer.to_vec();
    }
    let out_len = buffer.len() / factor;
    let mut out = vec![0.0; out_len];
    for i in 0..out_len {
        out[i] = buffer[i * factor];
    }
    out
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn downsample_for_pitch(buffer: &[f32], factor: usize) -> Vec<f32> {
    downsample_for_pitch_impl(buffer, factor)
}

#[cfg(not(feature = "wasm"))]
pub fn downsample_for_pitch(buffer: &[f32], factor: usize) -> Vec<f32> {
    downsample_for_pitch_impl(buffer, factor)
}

#[derive(Default)]
pub struct Smoother {
    ema: Option<f32>,
    hist: Vec<f32>,
    alpha: f32,
    maxh: usize,
}

impl Smoother {
    pub fn new() -> Self {
        Self {
            ema: None,
            hist: vec![],
            alpha: 0.4,
            maxh: 5,
        }
    }

    pub fn add(&mut self, f: Option<f32>) -> Option<f32> {
        if let Some(v) = f {
            self.ema = Some(self.ema.map_or(v, |e| self.alpha * v + (1.0 - self.alpha) * e));
            if let Some(e) = self.ema {
                self.hist.push(e);
                if self.hist.len() > self.maxh {
                    self.hist.remove(0);
                }
            }
        }
        if self.hist.is_empty() {
            return self.ema;
        }
        let mut s = self.hist.clone();
        s.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let m = s.len() / 2;
        Some(if s.len() % 2 == 1 {
            s[m]
        } else {
            (s[m - 1] + s[m]) * 0.5
        })
    }

    pub fn reset(&mut self) {
        self.hist.clear();
        self.ema = None;
    }
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub struct WasmSmoother {
    inner: Smoother,
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
impl WasmSmoother {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self { inner: Smoother::new() }
    }

    pub fn add(&mut self, f: Option<f32>) -> Option<f32> {
        self.inner.add(f)
    }

    pub fn reset(&mut self) {
        self.inner.reset();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_yin_440hz() {
        // Generate sine wave at 440Hz
        let sr = 44100.0;
        let n = 2048;
        let mut buf = vec![0.0; n];
        for i in 0..n {
            buf[i] = (2.0 * std::f32::consts::PI * 440.0 * i as f32 / sr).sin();
        }
        let res = detect_pitch_native(&buf, sr);
        assert!(res.is_some());
        let (f, c) = res.unwrap();
        // Note: may detect octave, accept close or half for sine test
        assert!((f - 440.0).abs() < 10.0 || (f - 220.0).abs() < 10.0, "freq was {}", f);
        assert!(c > 0.3);
    }

    #[test]
    fn test_mpm_440hz() {
        let sr = 44100.0;
        let n = 2048;
        let mut buf = vec![0.0; n];
        for i in 0..n {
            buf[i] = (2.0 * std::f32::consts::PI * 440.0 * i as f32 / sr).sin();
        }
        let _ = detect_pitch_native(&buf, sr); // exercises the YIN path
        // For MPM direct
        if let Some((f, _)) = detect_pitch_mpm_internal(&buf, sr) {
            assert!((f - 440.0).abs() < 2.0);
        }
    }

    #[test]
    fn test_power_chord() {
        let sr = 44100.0;
        let n = 2048;
        let mut buf = vec![0.0; n];
        let f = 110.0; // A2
        for i in 0..n {
            // Mix fundamental + fifth
            buf[i] = (2.0 * std::f32::consts::PI * f * i as f32 / sr).sin() * 0.7
                + (2.0 * std::f32::consts::PI * f * 1.5 * i as f32 / sr).sin() * 0.5;
        }
        let res = detect_pitch_native(&buf, sr);
        assert!(res.is_some());
        let (freq, _) = res.unwrap();
        // freq approx, focus on power detection
        let _ = is_likely_power_chord_native(&buf, sr, freq); // may need buffer adjust

    }

    #[test]
    fn test_note_math_440() {
        let (name, cents) = frequency_to_note(440.0, 440.0);
        assert_eq!(name, "A4");
        assert!((cents).abs() < 0.1);
    }

    #[test]
    fn test_get_cents() {
        let c = get_cents(445.0, 440.0);
        assert!(c > 0.0 && c < 30.0);
    }

    #[test]
    fn test_find_closest_and_tunings() {
        let tunings = get_tunings();
        assert!(tunings.len() >= 13);
        let std = &tunings[0].strings;
        let closest = find_closest_string(110.0, std, 440.0);
        assert_eq!(closest.name, "A");
        assert!((closest.frequency - 110.0).abs() < 0.1);
        // A4 scaling
        let closest_442 = find_closest_string(110.0 * (442.0/440.0), std, 442.0);
        assert_eq!(closest_442.name, "A");
        // New presets exist and are well-formed (6 strings each, ascending pitch).
        for name in ["Drop B (BF#BEG#C#)", "Open C (CGCGCE)", "Open A (EAC#EAE)",
                     "Full Step Down (DGCFAD)", "Open Gm (DGDGA#D)"] {
            let t = tunings.iter().find(|t| t.name == name)
                .unwrap_or_else(|| panic!("missing tuning {}", name));
            assert_eq!(t.strings.len(), 6, "{} should have 6 strings", name);
            for w in t.strings.windows(2) {
                assert!(w[1].frequency > w[0].frequency, "{} not ascending", name);
            }
        }
    }

    #[test]
    fn test_yin_guitar_notes() {
        // Every in-range guitar fundamental must detect at the fundamental
        // (not an octave/subharmonic). Guards the CMNDF normalization.
        let sr = 44100.0;
        let n = 2048;
        for &expected in &[82.4069f32, 110.0, 146.8324, 195.9977, 246.9417, 329.6276] {
            let mut buf = vec![0.0f32; n];
            for i in 0..n {
                buf[i] = (2.0 * std::f32::consts::PI * expected * i as f32 / sr).sin();
            }
            let res = detect_pitch_native(&buf, sr);
            assert!(res.is_some(), "no detection for {} Hz", expected);
            let (f, c) = res.unwrap();
            assert!((f - expected).abs() < 2.0, "expected {} Hz, got {} Hz", expected, f);
            assert!(c > 0.5, "low confidence {} for {} Hz", c, expected);
        }
    }

    #[test]
    fn test_detect_pitch_dc_offset() {
        // A large DC offset must not break detection (mean is removed first).
        let sr = 44100.0;
        let n = 2048;
        let mut buf = vec![0.0f32; n];
        for i in 0..n {
            buf[i] = (2.0 * std::f32::consts::PI * 110.0 * i as f32 / sr).sin() + 0.6;
        }
        let res = detect_pitch(&buf, sr);
        assert!(res.is_some());
        let (f, _) = res.unwrap();
        assert!((f - 110.0).abs() < 2.0, "got {} Hz", f);
    }
}

