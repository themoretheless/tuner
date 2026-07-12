use crate::{
    get_tunings, is_likely_power_chord_native, signal, DetectionFrame, DetectorConfig,
    FrameContext, FrameResolver, HybridPitchDetector, PitchDetector, Smoother, SpectrumAnalyzer,
    Tuning,
};

const DEFAULT_SPECTRUM_FFT_SIZE: usize = 2048;
const DEFAULT_SPECTRUM_BINS: usize = 512;

#[derive(Clone, Debug)]
pub struct EngineConfig {
    pub a4: f32,
    pub detector: DetectorConfig,
    pub frame_context: Option<FrameContext>,
    pub tuning: Option<Tuning>,
    pub spectrum_fft_size: usize,
    pub spectrum_bins: usize,
}

impl Default for EngineConfig {
    fn default() -> Self {
        Self {
            a4: 440.0,
            detector: DetectorConfig::default(),
            frame_context: None,
            tuning: None,
            spectrum_fft_size: DEFAULT_SPECTRUM_FFT_SIZE,
            spectrum_bins: DEFAULT_SPECTRUM_BINS,
        }
    }
}

pub struct TunerEngine {
    smoother: Smoother,
    detector: HybridPitchDetector,
    resolver: FrameResolver,
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
            frame_context,
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
        let tuning = tuning
            .or_else(|| tunings.into_iter().next())
            .unwrap_or_else(|| Tuning {
                name: "Chromatic",
                strings: Vec::new(),
            });
        Self {
            smoother: Smoother::new(),
            detector: HybridPitchDetector::new(detector),
            resolver: FrameResolver::new(a4, tuning, frame_context),
            spectrum: (spectrum_bins > 0)
                .then(|| SpectrumAnalyzer::new(spectrum_fft_size, spectrum_bins)),
            spectrum_bins: configured_spectrum_bins,
            spectrum_fft_size,
        }
    }

    pub fn set_a4(&mut self, a4: f32) {
        self.resolver.set_a4(a4);
        self.smoother.reset();
    }

    pub fn set_tuning(&mut self, t: Tuning) {
        self.resolver.set_tuning(t);
        self.smoother.reset();
    }

    pub fn set_frame_context(&mut self, context: Option<FrameContext>) {
        self.resolver.set_context(context);
        self.smoother.reset();
    }

    pub fn set_detection_range(&mut self, min_frequency: f32, max_frequency: f32) {
        self.detector
            .set_frequency_range(min_frequency, max_frequency);
        self.smoother.reset();
        self.resolver.reset();
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

        let resolution = self.resolver.resolve(freq_opt);

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
            cents: resolution.cents,
            note: resolution.note,
            target: resolution.target,
            in_tune: resolution.in_tune,
            spectrum,
        }
    }

    pub fn reset(&mut self) {
        self.smoother.reset();
        self.resolver.reset();
    }
}
