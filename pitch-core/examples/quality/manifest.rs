mod corpus;
mod provenance;
mod scenario;

pub use corpus::*;
pub use provenance::*;
pub use scenario::*;

use pitch_core::PitchQualityThresholds;
use serde::Deserialize;
use std::error::Error;
use std::io::{Error as IoError, ErrorKind};

pub const SCHEMA_VERSION: u32 = 1;

#[derive(Clone, Copy, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GuidanceMode {
    #[default]
    Chromatic,
    TuningTargets,
}

impl GuidanceMode {
    pub fn uses_tuning_targets(self) -> bool {
        matches!(self, Self::TuningTargets)
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Chromatic => "chromatic",
            Self::TuningTargets => "tuningTargets",
        }
    }
}

#[derive(Clone, Copy, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ThresholdManifest {
    pub max_time_to_first_correct_ms: Option<f32>,
    pub max_mean_reacquisition_latency_ms: Option<f32>,
    pub max_reacquisition_latency_ms: Option<f32>,
    pub max_missed_acquisitions: Option<usize>,
    pub max_false_lock_ratio: Option<f32>,
    pub max_note_switches_per_second: Option<f32>,
    pub max_stable_sustain_cents_mae: Option<f32>,
    pub min_stable_detection_coverage: Option<f32>,
}

impl ThresholdManifest {
    pub fn has_single_note_release_gate(self) -> bool {
        self.max_time_to_first_correct_ms.is_some()
            && self.max_missed_acquisitions.is_some()
            && self.max_false_lock_ratio.is_some()
            && self.max_note_switches_per_second.is_some()
            && self.max_stable_sustain_cents_mae.is_some()
            && self.min_stable_detection_coverage.is_some()
    }
}

impl From<ThresholdManifest> for PitchQualityThresholds {
    fn from(value: ThresholdManifest) -> Self {
        Self {
            max_time_to_first_correct_ms: value.max_time_to_first_correct_ms,
            max_mean_reacquisition_latency_ms: value.max_mean_reacquisition_latency_ms,
            max_reacquisition_latency_ms: value.max_reacquisition_latency_ms,
            max_missed_acquisitions: value.max_missed_acquisitions,
            max_false_lock_ratio: value.max_false_lock_ratio,
            max_note_switches_per_second: value.max_note_switches_per_second,
            max_stable_sustain_cents_mae: value.max_stable_sustain_cents_mae,
            min_stable_detection_coverage: value.min_stable_detection_coverage,
        }
    }
}

pub fn invalid_input(message: impl Into<String>) -> Box<dyn Error> {
    Box::new(IoError::new(ErrorKind::InvalidInput, message.into()))
}

fn validate_schema_version(version: u32) -> Result<(), Box<dyn Error>> {
    if version == SCHEMA_VERSION {
        Ok(())
    } else {
        Err(invalid_input(format!(
            "unsupported quality schema version {version}"
        )))
    }
}

fn valid_sha256(value: &str) -> bool {
    value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn approximately_equal(left: f32, right: f32) -> bool {
    (left - right).abs() <= 0.0001
}
