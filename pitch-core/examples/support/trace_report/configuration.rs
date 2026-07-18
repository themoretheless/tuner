use pitch_core::{DetectorConfig, PipelineConfig};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct ReplayConfiguration {
    pub(super) window_samples: usize,
    pub(super) hop_samples: usize,
    pub(super) reference_a4: f32,
    pub(super) guidance: &'static str,
    pub(super) target_frequency: Option<f32>,
    pub(super) detector: DetectorConfiguration,
    pub(super) pipeline: PipelineConfiguration,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct DetectorConfiguration {
    min_frequency: f32,
    max_frequency: f32,
    min_confidence: f32,
    peak_gate: f32,
    rms_gate: f32,
    yin_threshold: f32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct PipelineConfiguration {
    adaptive_gate_enabled: bool,
    dc_removal_enabled: bool,
    fixed_gate_enabled: bool,
    harmonic_enabled: bool,
    hold_enabled: bool,
    octave_enabled: bool,
    power_chord_enabled: bool,
    secondary_detector_enabled: bool,
    tracking_enabled: bool,
    yin_enabled: bool,
}

impl From<DetectorConfig> for DetectorConfiguration {
    fn from(value: DetectorConfig) -> Self {
        Self {
            min_frequency: value.min_frequency,
            max_frequency: value.max_frequency,
            min_confidence: value.min_confidence,
            peak_gate: value.peak_gate,
            rms_gate: value.rms_gate,
            yin_threshold: value.yin_threshold,
        }
    }
}

impl From<PipelineConfig> for PipelineConfiguration {
    fn from(value: PipelineConfig) -> Self {
        Self {
            adaptive_gate_enabled: value.adaptive_gate_enabled,
            dc_removal_enabled: value.dc_removal_enabled,
            fixed_gate_enabled: value.fixed_gate_enabled,
            harmonic_enabled: value.harmonic_enabled,
            hold_enabled: value.hold_enabled,
            octave_enabled: value.octave_enabled,
            power_chord_enabled: value.power_chord_enabled,
            secondary_detector_enabled: value.secondary_detector_enabled,
            tracking_enabled: value.tracking_enabled,
            yin_enabled: value.yin_enabled,
        }
    }
}
