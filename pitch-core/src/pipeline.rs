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
