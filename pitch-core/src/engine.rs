use crate::{
    detect_pitch_native, find_closest_string, frequency_to_note, get_cents, get_tunings,
    is_likely_power_chord_native, signal, DetectionFrame, Smoother, Tuning,
    GUITAR_STRINGS_STANDARD,
};

const DEFAULT_SPECTRUM_FFT_SIZE: usize = 2048;
const DEFAULT_SPECTRUM_BINS: usize = 512;

#[derive(Clone, Debug)]
pub struct EngineConfig {
    pub a4: f32,
    pub tuning: Option<Tuning>,
    pub spectrum_fft_size: usize,
    pub spectrum_bins: usize,
}

impl Default for EngineConfig {
    fn default() -> Self {
        Self {
            a4: 440.0,
            tuning: None,
            spectrum_fft_size: DEFAULT_SPECTRUM_FFT_SIZE,
            spectrum_bins: DEFAULT_SPECTRUM_BINS,
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
}

impl TunerEngine {
    pub fn new(a4: f32) -> Self {
        Self::with_config(EngineConfig {
            a4,
            ..EngineConfig::default()
        })
    }

    pub fn with_config(config: EngineConfig) -> Self {
        let EngineConfig {
            a4,
            tuning,
            spectrum_fft_size,
            spectrum_bins,
        } = config;
        let tunings = get_tunings();
        let spectrum_fft_size = spectrum_fft_size.max(64);
        let spectrum_bins = spectrum_bins.clamp(1, spectrum_fft_size / 2);
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

    pub fn process(&mut self, buffer: &[f32], sample_rate: f32) -> DetectionFrame {
        let rms = signal::compute_rms_volume(buffer);
        let level = signal::normalize_level_impl(rms);
        let (raw_freq, confidence) = detect_pitch_native(buffer, sample_rate).unwrap_or((0.0, 0.0));
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

        let n = self.spectrum_fft_size as f32;
        for (i, &sample) in buffer.iter().take(self.spectrum_fft_size).enumerate() {
            // Hann window to reduce spectral leakage (sharper bars, less smearing).
            let w = 0.5 * (1.0 - (2.0 * i as f32 / (n - 1.0) - 1.0).cos());
            self.spectrum_buffer[i] = rustfft::num_complex::Complex::new(sample * w, 0.0);
        }
        self.fft.process(&mut self.spectrum_buffer);
        for (i, bin) in spectrum.iter_mut().enumerate() {
            let re = self.spectrum_buffer[i].re;
            let im = self.spectrum_buffer[i].im;
            *bin = (re * re + im * im).sqrt();
        }
        let max_mag = spectrum.iter().cloned().fold(0.0, f32::max).max(1e-6);
        for m in &mut spectrum {
            *m /= max_mag;
        }
        spectrum
    }
}
