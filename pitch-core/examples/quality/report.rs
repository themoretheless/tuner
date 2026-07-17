use super::manifest::{ScenarioManifest, ScenarioRuntime, SCHEMA_VERSION};
use pitch_core::PitchQualityMetrics;
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QualityReport {
    schema_version: u32,
    capture: String,
    sample_rate: f32,
    window_samples: usize,
    hop_seconds: f32,
    configuration: ConfigurationReport,
    metrics: MetricsReport,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ConfigurationReport {
    tolerance_cents: f32,
    minimum_correct_hold_seconds: f32,
    reference_a4: f32,
    min_frequency: Option<f32>,
    max_frequency: Option<f32>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MetricsReport {
    evaluated_duration_seconds: f32,
    time_to_first_correct_ms: Option<f32>,
    mean_reacquisition_latency_ms: Option<f32>,
    max_reacquisition_latency_ms: Option<f32>,
    missed_acquisitions: usize,
    false_lock_duration_ms: f32,
    false_lock_ratio: f32,
    note_switches_per_second: f32,
    stable_sustain_cents_mae: Option<f32>,
    stable_detection_coverage: f32,
    segments: Vec<SegmentReport>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SegmentReport {
    id: String,
    target_frequency: f32,
    acquisition_latency_ms: Option<f32>,
    false_lock_duration_ms: f32,
    note_switches: usize,
    stable_sustain_cents_mae: Option<f32>,
    stable_detection_coverage: f32,
}

pub fn build(
    capture: String,
    scenario: &ScenarioManifest,
    runtime: &ScenarioRuntime,
    metrics: PitchQualityMetrics,
) -> QualityReport {
    QualityReport {
        schema_version: SCHEMA_VERSION,
        capture,
        sample_rate: scenario.sample_rate,
        window_samples: runtime.window_samples,
        hop_seconds: runtime.hop_seconds,
        configuration: ConfigurationReport {
            tolerance_cents: runtime.evaluation.tolerance_cents,
            minimum_correct_hold_seconds: runtime.evaluation.minimum_correct_hold_seconds,
            reference_a4: runtime.evaluation.reference_a4,
            min_frequency: scenario.min_frequency,
            max_frequency: scenario.max_frequency,
        },
        metrics: MetricsReport {
            evaluated_duration_seconds: metrics.evaluated_duration_seconds,
            time_to_first_correct_ms: metrics.time_to_first_correct_ms,
            mean_reacquisition_latency_ms: metrics.mean_reacquisition_latency_ms,
            max_reacquisition_latency_ms: metrics.max_reacquisition_latency_ms,
            missed_acquisitions: metrics.missed_acquisitions,
            false_lock_duration_ms: metrics.false_lock_duration_ms,
            false_lock_ratio: metrics.false_lock_ratio,
            note_switches_per_second: metrics.note_switches_per_second,
            stable_sustain_cents_mae: metrics.stable_sustain_cents_mae,
            stable_detection_coverage: metrics.stable_detection_coverage,
            segments: metrics
                .segments
                .into_iter()
                .zip(&scenario.segments)
                .map(|(metrics, segment)| SegmentReport {
                    id: segment.id.clone(),
                    target_frequency: metrics.target_frequency,
                    acquisition_latency_ms: metrics.acquisition_latency_ms,
                    false_lock_duration_ms: metrics.false_lock_duration_ms,
                    note_switches: metrics.note_switches,
                    stable_sustain_cents_mae: metrics.stable_sustain_cents_mae,
                    stable_detection_coverage: metrics.stable_detection_coverage,
                })
                .collect(),
        },
    }
}
