/// Runtime switches for optional tuner stages.
///
/// Signal measurement, candidate arbitration, frame resolution and
/// DetectionFrame assembly are mandatory pipeline boundaries and therefore
/// are not exposed as switches. At least one pitch candidate provider is
/// always kept enabled.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PipelineConfig {
    pub adaptive_gate_enabled: bool,
    pub dc_removal_enabled: bool,
    pub fixed_gate_enabled: bool,
    pub harmonic_enabled: bool,
    pub hold_enabled: bool,
    pub octave_enabled: bool,
    pub power_chord_enabled: bool,
    pub secondary_detector_enabled: bool,
    pub tracking_enabled: bool,
    pub yin_enabled: bool,
}

impl Default for PipelineConfig {
    fn default() -> Self {
        Self {
            adaptive_gate_enabled: true,
            dc_removal_enabled: true,
            fixed_gate_enabled: true,
            harmonic_enabled: true,
            hold_enabled: true,
            octave_enabled: true,
            power_chord_enabled: true,
            secondary_detector_enabled: true,
            tracking_enabled: true,
            yin_enabled: true,
        }
    }
}

impl PipelineConfig {
    pub fn normalized(mut self) -> Self {
        if !self.yin_enabled && !self.secondary_detector_enabled {
            self.yin_enabled = true;
        }
        self
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct PipelineCandidate {
    pub confidence: f32,
    pub frequency: f32,
}

/// Small, fixed-size spectral summary used by the diagnostics UI.
///
/// Values are relative strengths in `0..=1`, not probabilities. Keeping the
/// summary to five harmonics and three octave hypotheses avoids exposing FFT
/// buffers or detector scratch state through the real-time frame contract.
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct PipelineSpectralTelemetry {
    pub active_octave: i8,
    pub base_frequency: f32,
    pub harmonics: [f32; 5],
    pub octave_scores: [f32; 3],
    pub pending_octave: i8,
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum PipelineArbitration {
    #[default]
    None,
    YinOnly,
    SecondaryOnly,
    Fused,
    GuidedYin,
    GuidedSecondary,
    ConfidenceYin,
    ConfidenceSecondary,
    RejectedDisagreement,
    HarmonicRescue,
}

impl PipelineArbitration {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::None => "none",
            Self::YinOnly => "yin-only",
            Self::SecondaryOnly => "secondary-only",
            Self::Fused => "fused",
            Self::GuidedYin => "guided-yin",
            Self::GuidedSecondary => "guided-secondary",
            Self::ConfidenceYin => "confidence-yin",
            Self::ConfidenceSecondary => "confidence-secondary",
            Self::RejectedDisagreement => "rejected-disagreement",
            Self::HarmonicRescue => "harmonic-rescue",
        }
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum PipelineDecision {
    #[default]
    NoCandidate,
    FixedGateRejected,
    BelowConfidence,
    TargetRejected,
    OctavePending,
    AdaptiveGateRejected,
    TrackingAcquiring,
    Held,
    Published,
}

impl PipelineDecision {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::NoCandidate => "no-candidate",
            Self::FixedGateRejected => "fixed-gate-rejected",
            Self::BelowConfidence => "below-confidence",
            Self::TargetRejected => "target-rejected",
            Self::OctavePending => "octave-pending",
            Self::AdaptiveGateRejected => "adaptive-gate-rejected",
            Self::TrackingAcquiring => "tracking-acquiring",
            Self::Held => "held",
            Self::Published => "published",
        }
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct PipelineTelemetry {
    pub adaptive_gate_open: bool,
    pub arbitration: PipelineArbitration,
    pub decision: PipelineDecision,
    pub fixed_gate_open: bool,
    pub gate_threshold: f32,
    pub held: bool,
    pub noise_floor: f32,
    pub processing_ms: f32,
    pub sample_rate: f32,
    pub secondary: Option<PipelineCandidate>,
    pub selected: Option<PipelineCandidate>,
    pub spectral: Option<PipelineSpectralTelemetry>,
    pub tracked: bool,
    pub window_samples: u32,
    pub yin: Option<PipelineCandidate>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalization_keeps_one_candidate_provider_enabled() {
        let normalized = PipelineConfig {
            yin_enabled: false,
            secondary_detector_enabled: false,
            ..PipelineConfig::default()
        }
        .normalized();

        assert!(normalized.yin_enabled);
        assert!(!normalized.secondary_detector_enabled);
    }
}
