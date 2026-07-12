use super::{MpmDetector, YinDetector};

const DEFAULT_MIN_FREQUENCY: f32 = 30.0;
const DEFAULT_MAX_FREQUENCY: f32 = 400.0;

/// Lowest normalized periodicity score that may update the tuner readout.
///
/// Confidence is a signal-quality score, not a probability: `0.0` means no
/// usable periodic estimate and `1.0` means an ideal periodic frame.
pub const MIN_USABLE_CONFIDENCE: f32 = 0.5;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct PitchEstimate {
    pub confidence: f32,
    pub frequency: f32,
}

impl PitchEstimate {
    pub fn into_tuple(self) -> (f32, f32) {
        (self.frequency, self.confidence)
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct DetectorConfig {
    pub max_frequency: f32,
    pub min_confidence: f32,
    pub min_frequency: f32,
    pub peak_gate: f32,
    pub rms_gate: f32,
    pub yin_threshold: f32,
}

impl Default for DetectorConfig {
    fn default() -> Self {
        Self {
            min_frequency: DEFAULT_MIN_FREQUENCY,
            max_frequency: DEFAULT_MAX_FREQUENCY,
            min_confidence: MIN_USABLE_CONFIDENCE,
            peak_gate: 0.012,
            rms_gate: 0.0025,
            yin_threshold: 0.12,
        }
    }
}

impl DetectorConfig {
    pub fn with_frequency_range(mut self, min_frequency: f32, max_frequency: f32) -> Self {
        self.set_frequency_range(min_frequency, max_frequency);
        self
    }

    pub fn set_frequency_range(&mut self, min_frequency: f32, max_frequency: f32) {
        let min_frequency = min_frequency.clamp(20.0, 1_500.0);
        let max_frequency = max_frequency.clamp(40.0, 2_000.0);
        if max_frequency > min_frequency * 1.05 {
            self.min_frequency = min_frequency;
            self.max_frequency = max_frequency;
        }
    }

    pub fn with_min_confidence(mut self, min_confidence: f32) -> Self {
        self.set_min_confidence(min_confidence);
        self
    }

    pub fn set_min_confidence(&mut self, min_confidence: f32) {
        self.min_confidence = normalize_confidence(min_confidence, MIN_USABLE_CONFIDENCE);
    }

    pub(crate) fn accepts_confidence(&self, confidence: f32) -> bool {
        confidence.is_finite()
            && confidence >= normalize_confidence(self.min_confidence, MIN_USABLE_CONFIDENCE)
    }
}

pub trait PitchDetector {
    fn detect(&mut self, buffer: &[f32], sample_rate: f32) -> Option<PitchEstimate>;
    fn set_config(&mut self, config: DetectorConfig);
}

pub struct HybridPitchDetector {
    cleaned: Vec<f32>,
    config: DetectorConfig,
    mpm: MpmDetector,
    yin: YinDetector,
}

impl Default for HybridPitchDetector {
    fn default() -> Self {
        Self::new(DetectorConfig::default())
    }
}

impl HybridPitchDetector {
    pub fn new(config: DetectorConfig) -> Self {
        let mut config = config;
        config.set_min_confidence(config.min_confidence);
        Self {
            cleaned: Vec::new(),
            config,
            mpm: MpmDetector::new(config),
            yin: YinDetector::new(config),
        }
    }

    pub fn set_frequency_range(&mut self, min_frequency: f32, max_frequency: f32) {
        let mut config = self.config;
        config.set_frequency_range(min_frequency, max_frequency);
        self.set_config(config);
    }

    fn prepare_centered(&mut self, buffer: &[f32]) -> bool {
        if buffer.is_empty() {
            return false;
        }

        let mean = buffer.iter().sum::<f32>() / buffer.len() as f32;
        self.cleaned.resize(buffer.len(), 0.0);
        for (output, sample) in self.cleaned.iter_mut().zip(buffer) {
            *output = *sample - mean;
        }

        let mut sum_sq = 0.0;
        let mut max_abs = 0.0_f32;
        for sample in &self.cleaned {
            sum_sq += sample * sample;
            max_abs = max_abs.max(sample.abs());
        }
        let rms = (sum_sq / self.cleaned.len() as f32).sqrt();
        if rms < self.config.rms_gate || max_abs < self.config.peak_gate {
            return false;
        }

        true
    }
}

impl PitchDetector for HybridPitchDetector {
    fn detect(&mut self, buffer: &[f32], sample_rate: f32) -> Option<PitchEstimate> {
        if !self.prepare_centered(buffer) {
            return None;
        }
        let cleaned = std::mem::take(&mut self.cleaned);
        let estimate = self
            .yin
            .detect_centered(&cleaned, sample_rate)
            .or_else(|| self.mpm.detect_centered(&cleaned, sample_rate))
            .filter(|estimate| self.config.accepts_confidence(estimate.confidence));
        self.cleaned = cleaned;
        estimate
    }

    fn set_config(&mut self, config: DetectorConfig) {
        let mut normalized = config;
        normalized.set_min_confidence(config.min_confidence);
        self.config = normalized;
        self.yin.set_config(normalized);
        self.mpm.set_config(normalized);
    }
}

fn normalize_confidence(value: f32, fallback: f32) -> f32 {
    if value.is_finite() {
        value.clamp(0.0, 1.0)
    } else {
        fallback
    }
}
