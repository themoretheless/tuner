use crate::{
    detect_pitch_in_range, find_closest_string, frequency_to_note, get_cents, get_tunings,
    is_likely_power_chord_native, signal, DetectionFrame, Smoother, Tuning, DEFAULT_MAX_FREQUENCY,
    DEFAULT_MIN_FREQUENCY, GUITAR_STRINGS_STANDARD,
};

const DEFAULT_SPECTRUM_FFT_SIZE: usize = 2048;
const DEFAULT_SPECTRUM_BINS: usize = 512;
const DEFAULT_A4: f32 = 440.0;
const MIN_A4: f32 = 400.0;
const MAX_A4: f32 = 480.0;

#[derive(Clone, Debug)]
pub struct EngineConfig {
    pub a4: f32,
    pub tuning: Option<Tuning>,
    pub spectrum_fft_size: usize,
    pub spectrum_bins: usize,
    pub min_frequency: f32,
    pub max_frequency: f32,
}

impl Default for EngineConfig {
    fn default() -> Self {
        Self {
            a4: DEFAULT_A4,
            tuning: None,
            spectrum_fft_size: DEFAULT_SPECTRUM_FFT_SIZE,
            spectrum_bins: DEFAULT_SPECTRUM_BINS,
            min_frequency: DEFAULT_MIN_FREQUENCY,
            max_frequency: DEFAULT_MAX_FREQUENCY,
        }
    }
}

pub struct TunerEngine {
    smoother: Smoother,
    a4: f32,
    tuning: Tuning,
    fft: std::sync::Arc<dyn rustfft::Fft<f32>>,
    spectrum_buffer: Vec<rustfft::num_complex::Complex<f32>>,
    spectrum_fft_size: usize,
    spectrum_bins: usize,
    min_frequency: f32,
    max_frequency: f32,
}

impl TunerEngine {
    pub fn new(a4: f32) -> Self {
        Self::with_config(EngineConfig {
            a4: sanitize_a4(a4),
            ..EngineConfig::default()
        })
    }

    pub fn with_config(config: EngineConfig) -> Self {
        let EngineConfig {
            a4,
            tuning,
            spectrum_fft_size,
            spectrum_bins,
            min_frequency,
            max_frequency,
        } = config;
        let a4 = sanitize_a4(a4);
        let tunings = get_tunings();
        let spectrum_fft_size = spectrum_fft_size.max(64);
        let spectrum_bins = spectrum_bins.clamp(1, spectrum_fft_size / 2);
        let (min_frequency, max_frequency) = if min_frequency.is_finite()
            && max_frequency.is_finite()
            && min_frequency > 0.0
            && max_frequency > min_frequency
        {
            (min_frequency, max_frequency)
        } else {
            (DEFAULT_MIN_FREQUENCY, DEFAULT_MAX_FREQUENCY)
        };
        let mut planner = rustfft::FftPlanner::<f32>::new();
        let fft = planner.plan_fft_forward(spectrum_fft_size);
        Self {
            smoother: Smoother::new(),
            a4,
            tuning: tuning.unwrap_or_else(|| {
                tunings.first().cloned().unwrap_or_else(|| Tuning {
                    name: "Standard (EADGBE)",
                    strings: GUITAR_STRINGS_STANDARD.to_vec(),
                })
            }),
            fft,
            spectrum_buffer: vec![rustfft::num_complex::Complex::new(0.0, 0.0); spectrum_fft_size],
            spectrum_fft_size,
            spectrum_bins,
            min_frequency,
            max_frequency,
        }
    }

    pub fn set_a4(&mut self, a4: f32) {
        let a4 = sanitize_a4(a4);
        if (self.a4 - a4).abs() > 0.01 {
            self.a4 = a4;
            self.smoother.reset();
        }
    }

    pub fn set_tuning(&mut self, t: Tuning) {
        self.tuning = t;
        self.smoother.reset();
    }

    pub fn process(&mut self, buffer: &[f32], sample_rate: f32) -> DetectionFrame {
        let rms = signal::compute_rms_volume(buffer);
        let level = signal::normalize_level_impl(rms);
        let (raw_freq, confidence) =
            detect_pitch_in_range(buffer, sample_rate, self.min_frequency, self.max_frequency)
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
        let (target, cents) = if let Some(f) = freq_opt {
            if !self.tuning.strings.is_empty() {
                let target = find_closest_string(f, &self.tuning.strings, self.a4);
                let cents = get_cents(f, target.frequency);
                (Some(target), cents)
            } else {
                (None, cents_chromatic)
            }
        } else {
            (None, 0.0)
        };

        let spectrum = self.compute_spectrum(buffer);

        DetectionFrame {
            freq: freq_opt,
            confidence,
            rms,
            level,
            is_power,
            cents,
            note,
            target,
            in_tune: freq_opt.is_some() && cents.abs() <= 5.0,
            spectrum,
        }
    }

    pub fn reset(&mut self) {
        self.smoother.reset();
    }

    fn compute_spectrum(&mut self, buffer: &[f32]) -> Vec<f32> {
        let mut spectrum = vec![0.0f32; self.spectrum_bins];
        if buffer.len() < self.spectrum_fft_size {
            return spectrum;
        }

        for (i, &sample) in buffer.iter().take(self.spectrum_fft_size).enumerate() {
            // Hann window to reduce spectral leakage (sharper bars, less smearing).
            let w = hann_weight(i, self.spectrum_fft_size);
            let sample = if sample.is_finite() { sample } else { 0.0 };
            self.spectrum_buffer[i] = rustfft::num_complex::Complex::new(sample * w, 0.0);
        }
        self.fft.process(&mut self.spectrum_buffer);
        for (i, bin) in spectrum.iter_mut().enumerate() {
            let re = self.spectrum_buffer[i].re;
            let im = self.spectrum_buffer[i].im;
            *bin = (re * re + im * im).sqrt();
        }
        let max_mag = spectrum.iter().copied().fold(0.0, f32::max).max(1e-6);
        for m in &mut spectrum {
            *m /= max_mag;
        }
        spectrum
    }
}

fn sanitize_a4(a4: f32) -> f32 {
    if a4.is_finite() && (MIN_A4..=MAX_A4).contains(&a4) {
        a4
    } else {
        DEFAULT_A4
    }
}

fn hann_weight(index: usize, len: usize) -> f32 {
    if len <= 1 {
        return 1.0;
    }
    let phase = 2.0 * std::f32::consts::PI * index as f32 / (len - 1) as f32;
    0.5 * (1.0 - phase.cos())
}

#[cfg(test)]
mod tests {
    use super::{hann_weight, sanitize_a4, EngineConfig, TunerEngine, DEFAULT_A4};

    #[test]
    fn hann_window_has_zero_endpoints_and_unit_center() {
        let len = 129;
        assert!(hann_weight(0, len).abs() < f32::EPSILON);
        assert!((hann_weight(len / 2, len) - 1.0).abs() < 1e-6);
        assert!(hann_weight(len - 1, len).abs() < 1e-6);
    }

    #[test]
    fn invalid_a4_values_fall_back_to_standard_pitch() {
        assert_eq!(sanitize_a4(f32::NAN), DEFAULT_A4);
        assert_eq!(sanitize_a4(f32::INFINITY), DEFAULT_A4);
        assert_eq!(sanitize_a4(-440.0), DEFAULT_A4);
        assert_eq!(sanitize_a4(442.0), 442.0);

        let mut engine = TunerEngine::with_config(EngineConfig {
            a4: f32::NAN,
            ..EngineConfig::default()
        });
        assert_eq!(engine.a4, DEFAULT_A4);
        engine.set_a4(-1.0);
        assert_eq!(engine.a4, DEFAULT_A4);
        engine.set_a4(442.0);
        assert_eq!(engine.a4, 442.0);
    }
}
