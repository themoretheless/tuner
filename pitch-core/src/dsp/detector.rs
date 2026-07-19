use super::{
    prefer_guided_harmonic, select_pitch_candidate_with_reason, CandidateSelectionReason,
    HarmonicPitchDetector, MpmDetector, OctaveDisambiguator, PitchGuidance, YinDetector,
};
use crate::{
    PipelineArbitration, PipelineCandidate, PipelineConfig, PipelineDecision, PipelineTelemetry,
};

const DEFAULT_MIN_FREQUENCY: f32 = 30.0;
const DEFAULT_MAX_FREQUENCY: f32 = 400.0;

/// Lowest normalized periodicity score that may update the tuner readout.
///
/// Confidence is a signal-quality score, not a probability: `0.0` means no
/// usable periodic estimate and `1.0` means an ideal periodic frame.
pub const MIN_USABLE_CONFIDENCE: f32 = 0.7;

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
    harmonic: HarmonicPitchDetector,
    mpm: MpmDetector,
    octave: OctaveDisambiguator,
    pipeline: PipelineConfig,
    telemetry: PipelineTelemetry,
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
            harmonic: HarmonicPitchDetector::new(),
            mpm: MpmDetector::new(config),
            octave: OctaveDisambiguator::new(),
            pipeline: PipelineConfig::default(),
            telemetry: PipelineTelemetry::default(),
            yin: YinDetector::new(config),
        }
    }

    pub fn set_frequency_range(&mut self, min_frequency: f32, max_frequency: f32) {
        let mut config = self.config;
        config.set_frequency_range(min_frequency, max_frequency);
        self.set_config(config);
    }

    pub(crate) fn take_octave_correction_started(&mut self) -> bool {
        self.octave.take_correction_started()
    }

    pub(crate) fn has_unconfirmed_octave_correction(&self) -> bool {
        self.octave.has_unconfirmed_correction()
    }

    pub(crate) fn reset_tracking_state(&mut self) {
        self.octave.reset();
    }

    pub(crate) fn telemetry(&self) -> PipelineTelemetry {
        self.telemetry
    }

    pub(crate) fn set_pipeline_config(&mut self, pipeline: PipelineConfig) {
        let pipeline = pipeline.normalized();
        if self.pipeline == pipeline {
            return;
        }
        self.pipeline = pipeline;
        self.octave.reset();
    }

    pub(crate) fn detect_guided(
        &mut self,
        buffer: &[f32],
        sample_rate: f32,
        selected_target: Option<f32>,
        tuning_targets: &[f32],
    ) -> Option<PitchEstimate> {
        self.detect_with_guidance(
            buffer,
            sample_rate,
            PitchGuidance::new(selected_target, tuning_targets),
        )
    }

    fn detect_with_guidance(
        &mut self,
        buffer: &[f32],
        sample_rate: f32,
        guidance: PitchGuidance<'_>,
    ) -> Option<PitchEstimate> {
        // Frame status is edge-triggered; never let an unread status leak
        // into a later detector call.
        self.telemetry = PipelineTelemetry::default();
        self.telemetry.config_fingerprint = self.pipeline.fingerprint();
        self.telemetry.sample_rate = sample_rate;
        self.telemetry.window_samples = buffer.len().min(u32::MAX as usize) as u32;
        self.octave.take_correction_started();
        self.octave.begin_frame();
        if !self.prepare_samples(buffer) {
            self.octave.reset();
            return None;
        }
        let cleaned = std::mem::take(&mut self.cleaned);
        let yin = self
            .pipeline
            .yin_enabled
            .then(|| self.yin.detect_centered(&cleaned, sample_rate))
            .flatten();
        let mpm = self
            .pipeline
            .secondary_detector_enabled
            .then(|| self.mpm.detect_centered(&cleaned, sample_rate))
            .flatten();
        self.telemetry.yin = yin.map(pipeline_candidate);
        self.telemetry.secondary = mpm.map(pipeline_candidate);
        let selection = select_pitch_candidate_with_reason(yin, mpm, guidance);
        self.telemetry.arbitration = arbitration_from_selection(selection.reason);
        let mut estimate = selection.estimate;
        let needs_harmonic_alternative = self.pipeline.harmonic_enabled
            && !guidance.is_empty()
            && (yin.is_some() || mpm.is_some())
            && estimate.is_none_or(|estimate| !guidance.supports_resolved(estimate.frequency));
        if needs_harmonic_alternative {
            let harmonic = self.harmonic.detect(
                &cleaned,
                sample_rate,
                guidance.selected_target(),
                guidance.tuning_targets(),
                self.config.min_frequency,
                self.config.max_frequency,
            );
            let preferred = prefer_guided_harmonic(estimate, harmonic, guidance);
            if harmonic.is_some() && preferred == harmonic && preferred != estimate {
                self.telemetry.arbitration = PipelineArbitration::HarmonicRescue;
            }
            estimate = preferred;
        }
        let had_candidate = estimate.is_some();
        estimate = estimate.filter(|estimate| self.config.accepts_confidence(estimate.confidence));
        if had_candidate && estimate.is_none() {
            self.telemetry.decision = PipelineDecision::BelowConfidence;
        }
        estimate = estimate.and_then(|estimate| {
            let frequency = if self.pipeline.octave_enabled {
                self.octave.resolve(
                    &cleaned,
                    sample_rate,
                    estimate.frequency,
                    self.config.min_frequency,
                    self.config.max_frequency,
                )
            } else {
                estimate.frequency
            };
            // A pending octave correction is deliberately held by the
            // engine on this frame. Validate only settled decisions so a
            // correct 2f candidate is not rejected before it folds to f.
            let correction_pending =
                self.pipeline.octave_enabled && self.octave.has_unconfirmed_correction();
            if correction_pending || guidance.supports_resolved(frequency) {
                Some(PitchEstimate {
                    frequency,
                    ..estimate
                })
            } else {
                self.telemetry.decision = PipelineDecision::TargetRejected;
                None
            }
        });
        self.telemetry.spectral = self.octave.evidence();
        self.telemetry.selected = estimate.map(pipeline_candidate);
        self.cleaned = cleaned;
        estimate
    }

    fn prepare_samples(&mut self, buffer: &[f32]) -> bool {
        if buffer.is_empty() {
            return false;
        }

        let mean = if self.pipeline.dc_removal_enabled {
            buffer.iter().sum::<f32>() / buffer.len() as f32
        } else {
            0.0
        };
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
        if self.pipeline.fixed_gate_enabled
            && (rms < self.config.rms_gate || max_abs < self.config.peak_gate)
        {
            self.telemetry.decision = PipelineDecision::FixedGateRejected;
            return false;
        }

        self.telemetry.fixed_gate_open = true;
        true
    }
}

fn pipeline_candidate(estimate: PitchEstimate) -> PipelineCandidate {
    PipelineCandidate {
        confidence: estimate.confidence,
        frequency: estimate.frequency,
    }
}

fn arbitration_from_selection(reason: CandidateSelectionReason) -> PipelineArbitration {
    match reason {
        CandidateSelectionReason::None => PipelineArbitration::None,
        CandidateSelectionReason::YinOnly => PipelineArbitration::YinOnly,
        CandidateSelectionReason::SecondaryOnly => PipelineArbitration::SecondaryOnly,
        CandidateSelectionReason::Fused => PipelineArbitration::Fused,
        CandidateSelectionReason::GuidedYin => PipelineArbitration::GuidedYin,
        CandidateSelectionReason::GuidedSecondary => PipelineArbitration::GuidedSecondary,
        CandidateSelectionReason::ConfidenceYin => PipelineArbitration::ConfidenceYin,
        CandidateSelectionReason::ConfidenceSecondary => PipelineArbitration::ConfidenceSecondary,
        CandidateSelectionReason::RejectedDisagreement => PipelineArbitration::RejectedDisagreement,
    }
}

impl PitchDetector for HybridPitchDetector {
    fn detect(&mut self, buffer: &[f32], sample_rate: f32) -> Option<PitchEstimate> {
        self.detect_with_guidance(buffer, sample_rate, PitchGuidance::none())
    }

    fn set_config(&mut self, config: DetectorConfig) {
        let mut normalized = config;
        normalized.set_min_confidence(config.min_confidence);
        self.config = normalized;
        self.yin.set_config(normalized);
        self.mpm.set_config(normalized);
        self.octave.reset();
    }
}

fn normalize_confidence(value: f32, fallback: f32) -> f32 {
    if value.is_finite() {
        value.clamp(0.0, 1.0)
    } else {
        fallback
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dc_removal_changes_the_fixed_gate_input() {
        let samples: Vec<f32> = (0..4096)
            .map(|index| {
                0.2 + 0.001 * (std::f32::consts::TAU * 220.0 * index as f32 / 48_000.0).sin()
            })
            .collect();
        let mut detector = HybridPitchDetector::new(DetectorConfig::default());

        assert!(!detector.prepare_samples(&samples));
        detector.set_pipeline_config(PipelineConfig {
            dc_removal_enabled: false,
            ..PipelineConfig::default()
        });
        assert!(detector.prepare_samples(&samples));
    }
}
