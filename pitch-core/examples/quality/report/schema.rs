use pitch_core::QualityThresholdViolation;
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct QualityReport {
    pub(super) schema_version: u32,
    pub(super) capture: String,
    pub(super) sample_rate: f32,
    pub(super) window_samples: usize,
    pub(super) hop_seconds: f32,
    pub(super) passed: bool,
    pub(super) thresholds: Option<ThresholdsReport>,
    pub(super) violations: Vec<ThresholdViolationReport>,
    pub(super) configuration: ConfigurationReport,
    pub(super) metrics: MetricsReport,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CorpusReport {
    pub(super) schema_version: u32,
    pub(super) corpus: String,
    pub(super) config_revision: String,
    pub(super) passed: bool,
    pub(super) summary: CorpusSummary,
    pub(super) captures: Vec<CorpusCaptureReport>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CorpusCaptureReport {
    pub(super) id: String,
    pub(super) instrument: String,
    pub(super) note: String,
    pub(super) capture_sha256: String,
    pub(super) source_page: String,
    pub(super) source_url: String,
    pub(super) source_sha256: String,
    pub(super) source_license: String,
    pub(super) source_license_url: String,
    #[serde(flatten)]
    pub(super) report: QualityReport,
    /// Per-SNR-level robustness results (deterministic noise mix); empty
    /// when the corpus manifest defines no `snrGrid`.
    pub(super) snr_levels: Vec<SnrLevelReport>,
}

/// Evaluation of one capture at one SNR level.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SnrLevelReport {
    pub(super) snr_db: f32,
    pub(super) passed: bool,
    pub(super) thresholds: ThresholdsReport,
    pub(super) violations: Vec<ThresholdViolationReport>,
    pub(super) metrics: MetricsReport,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct CorpusSummary {
    pub(super) capture_count: usize,
    pub(super) passed_captures: usize,
    pub(super) failed_captures: usize,
    pub(super) violation_count: usize,
    pub(super) snr_levels_evaluated: usize,
    pub(super) snr_levels_passed: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct ConfigurationReport {
    pub(super) guidance: &'static str,
    pub(super) tolerance_cents: f32,
    pub(super) minimum_correct_hold_seconds: f32,
    pub(super) reference_a4: f32,
    pub(super) min_frequency: Option<f32>,
    pub(super) max_frequency: Option<f32>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct ThresholdsReport {
    pub(super) max_time_to_first_correct_ms: Option<f32>,
    pub(super) max_mean_reacquisition_latency_ms: Option<f32>,
    pub(super) max_reacquisition_latency_ms: Option<f32>,
    pub(super) max_missed_acquisitions: Option<usize>,
    pub(super) max_false_lock_ratio: Option<f32>,
    pub(super) max_note_switches_per_second: Option<f32>,
    pub(super) max_stable_sustain_cents_mae: Option<f32>,
    pub(super) min_stable_detection_coverage: Option<f32>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct MetricsReport {
    pub(super) evaluated_duration_seconds: f32,
    pub(super) time_to_first_correct_ms: Option<f32>,
    pub(super) mean_reacquisition_latency_ms: Option<f32>,
    pub(super) max_reacquisition_latency_ms: Option<f32>,
    pub(super) missed_acquisitions: usize,
    pub(super) false_lock_duration_ms: f32,
    pub(super) false_lock_ratio: f32,
    pub(super) note_switches_per_second: f32,
    pub(super) stable_sustain_cents_mae: Option<f32>,
    pub(super) stable_sustain_cents_p50: Option<f32>,
    pub(super) stable_sustain_cents_p95: Option<f32>,
    pub(super) stable_sustain_cents_max: Option<f32>,
    pub(super) octave_error_ratio: Option<f32>,
    pub(super) stable_detection_coverage: f32,
    pub(super) segments: Vec<SegmentReport>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct SegmentReport {
    pub(super) id: String,
    pub(super) target_frequency: f32,
    pub(super) acquisition_latency_ms: Option<f32>,
    pub(super) false_lock_duration_ms: f32,
    pub(super) note_switches: usize,
    pub(super) stable_sustain_cents_mae: Option<f32>,
    pub(super) stable_sustain_cents_p50: Option<f32>,
    pub(super) stable_sustain_cents_p95: Option<f32>,
    pub(super) stable_sustain_cents_max: Option<f32>,
    pub(super) octave_error_ratio: Option<f32>,
    pub(super) stable_detection_coverage: f32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct ThresholdViolationReport {
    metric: &'static str,
    observed: Option<f32>,
    limit: f32,
    requirement: &'static str,
}

impl From<QualityThresholdViolation> for ThresholdViolationReport {
    fn from(value: QualityThresholdViolation) -> Self {
        Self {
            metric: value.metric.as_str(),
            observed: value.observed,
            limit: value.limit,
            requirement: value.requirement.as_str(),
        }
    }
}
