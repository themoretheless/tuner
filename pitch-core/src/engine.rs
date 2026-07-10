use crate::{
    find_closest_string, frequency_to_note, get_cents, get_tunings, is_likely_power_chord_native,
    signal, DetectionFrame, DetectorConfig, HybridPitchDetector, PitchDetector, Smoother,
    SpectrumAnalyzer, Tuning, GUITAR_STRINGS_STANDARD,
};

const DEFAULT_SPECTRUM_FFT_SIZE: usize = 2048;
const DEFAULT_SPECTRUM_BINS: usize = 512;

#[derive(Clone, Debug)]
pub struct EngineConfig {
    pub a4: f32,
    pub detector: DetectorConfig,
    pub tuning: Option<Tuning>,
    pub spectrum_fft_size: usize,
    pub spectrum_bins: usize,
}

impl Default for EngineConfig {
    fn default() -> Self {
        Self {
            a4: 440.0,
            detector: DetectorConfig::default(),
            tuning: None,
            spectrum_fft_size: DEFAULT_SPECTRUM_FFT_SIZE,
            spectrum_bins: DEFAULT_SPECTRUM_BINS,
        }
    }
}

pub struct TunerEngine {
    smoother: Smoother,
    a4: f32,
    detector: HybridPitchDetector,
    tuning: Tuning,
    spectrum: Option<SpectrumAnalyzer>,
    spectrum_bins: usize,
    spectrum_fft_size: usize,
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
            detector,
            tuning,
            spectrum_fft_size,
            spectrum_bins,
        } = config;
        let tunings = get_tunings();
        let configured_spectrum_bins = if spectrum_bins == 0 {
            DEFAULT_SPECTRUM_BINS
        } else {
            spectrum_bins
        };
        Self {
            smoother: Smoother::new(),
            a4,
            detector: HybridPitchDetector::new(detector),
            tuning: tuning.unwrap_or_else(|| {
                tunings.first().cloned().unwrap_or_else(|| Tuning {
                    name: "Standard (EADGBE)",
                    strings: GUITAR_STRINGS_STANDARD.to_vec(),
                })
            }),
            spectrum: (spectrum_bins > 0)
                .then(|| SpectrumAnalyzer::new(spectrum_fft_size, spectrum_bins)),
            spectrum_bins: configured_spectrum_bins,
            spectrum_fft_size,
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

    pub fn set_detection_range(&mut self, min_frequency: f32, max_frequency: f32) {
        self.detector
            .set_frequency_range(min_frequency, max_frequency);
        self.smoother.reset();
    }

    pub fn set_spectrum_enabled(&mut self, enabled: bool) {
        match (enabled, self.spectrum.is_some()) {
            (true, false) => {
                self.spectrum = Some(SpectrumAnalyzer::new(
                    self.spectrum_fft_size,
                    self.spectrum_bins,
                ));
            }
            (false, true) => self.spectrum = None,
            _ => {}
        }
    }

    pub fn process(&mut self, buffer: &[f32], sample_rate: f32) -> DetectionFrame {
        let rms = signal::compute_rms_volume(buffer);
        let level = signal::normalize_level(rms);
        let estimate = self.detector.detect(buffer, sample_rate);
        let raw_opt = estimate.map(|estimate| estimate.frequency);
        let confidence = estimate.map_or(0.0, |estimate| estimate.confidence);

        // Smooth the detected pitch to de-jitter the readout. When detection
        // drops (silence / gate closed), clear immediately instead of lingering
        // on the last smoothed value.
        let freq_opt = if raw_opt.is_some() {
            self.smoother.add(raw_opt)
        } else {
            self.smoother.reset();
            None
        };

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

        let spectrum = self
            .spectrum
            .as_mut()
            .map(|analyzer| analyzer.analyze(buffer).to_vec())
            .unwrap_or_default();

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
}
