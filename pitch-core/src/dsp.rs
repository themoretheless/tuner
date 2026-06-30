const GUITAR_MIN_FREQ: f32 = 30.0;
const GUITAR_MAX_FREQ: f32 = 400.0;
const YIN_THRESHOLD: f32 = 0.12;

#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;

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

pub(crate) fn detect_pitch_yin_internal(buffer: &[f32], sample_rate: f32) -> Option<(f32, f32)> {
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
            for (tau, &value) in yin.iter().enumerate().take(max_tau).skip(min_tau) {
                if value < min_val {
                    min_val = value;
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
    if !(GUITAR_MIN_FREQ..=GUITAR_MAX_FREQ).contains(&freq) {
        return None;
    }

    Some((freq, confidence))
}

pub(crate) fn detect_pitch_mpm_internal(buffer: &[f32], sample_rate: f32) -> Option<(f32, f32)> {
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
    if !(GUITAR_MIN_FREQ..=GUITAR_MAX_FREQ).contains(&freq) {
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
