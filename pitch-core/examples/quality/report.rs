mod schema;

use self::schema::{
    ConfigurationReport, CorpusCaptureReport, CorpusReport, CorpusSummary, MetricsReport,
    QualityReport, SegmentReport, ThresholdsReport,
};
use super::manifest::{
    CorpusCapture, CorpusManifest, ScenarioDefinition, ScenarioRuntime, SCHEMA_VERSION,
};
use pitch_core::{PitchQualityMetrics, PitchQualityThresholds, QualityThresholdViolation};

pub(super) fn build(
    capture: String,
    scenario: &ScenarioDefinition,
    runtime: &ScenarioRuntime,
    thresholds: Option<PitchQualityThresholds>,
    metrics: PitchQualityMetrics,
    violations: Vec<QualityThresholdViolation>,
) -> QualityReport {
    QualityReport {
        schema_version: SCHEMA_VERSION,
        capture,
        sample_rate: scenario.sample_rate,
        window_samples: runtime.window_samples,
        hop_seconds: runtime.hop_seconds,
        passed: violations.is_empty(),
        thresholds: thresholds.map(Into::into),
        violations: violations.into_iter().map(Into::into).collect(),
        configuration: ConfigurationReport {
            guidance: scenario.guidance.unwrap_or_default().as_str(),
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

pub(super) fn build_corpus_capture(
    capture: &CorpusCapture,
    path: String,
    scenario: &ScenarioDefinition,
    runtime: &ScenarioRuntime,
    thresholds: PitchQualityThresholds,
    metrics: PitchQualityMetrics,
    violations: Vec<QualityThresholdViolation>,
) -> CorpusCaptureReport {
    CorpusCaptureReport {
        id: capture.id.clone(),
        instrument: capture.instrument.clone(),
        note: capture.note.clone(),
        capture_sha256: capture.capture_sha256.clone(),
        source_page: capture.source.page_url.clone(),
        source_url: capture.source.source_url.clone(),
        source_sha256: capture.source.source_sha256.clone(),
        source_license: capture.source.license_spdx.clone(),
        source_license_url: capture.source.license_url.clone(),
        report: build(
            path,
            scenario,
            runtime,
            Some(thresholds),
            metrics,
            violations,
        ),
    }
}

pub(super) fn build_corpus(
    corpus: &CorpusManifest,
    captures: Vec<CorpusCaptureReport>,
) -> CorpusReport {
    let passed_captures = captures
        .iter()
        .filter(|capture| capture.report.passed)
        .count();
    let violation_count = captures
        .iter()
        .map(|capture| capture.report.violations.len())
        .sum();
    CorpusReport {
        schema_version: SCHEMA_VERSION,
        corpus: corpus.id.clone(),
        config_revision: corpus.config_revision.clone(),
        passed: passed_captures == captures.len(),
        summary: CorpusSummary {
            capture_count: captures.len(),
            passed_captures,
            failed_captures: captures.len() - passed_captures,
            violation_count,
        },
        captures,
    }
}

impl CorpusReport {
    pub(super) fn passed(&self) -> bool {
        self.passed
    }
}

impl QualityReport {
    pub(super) fn passed(&self) -> bool {
        self.passed
    }
}

impl From<PitchQualityThresholds> for ThresholdsReport {
    fn from(value: PitchQualityThresholds) -> Self {
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
