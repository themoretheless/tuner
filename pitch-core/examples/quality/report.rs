mod schema;

use self::schema::{
    ConfigurationReport, CorpusCaptureReport, CorpusReport, CorpusSummary, MetricsReport,
    QualityReport, ReverbConditionReport, SegmentReport, SnrLevelReport, ThresholdsReport,
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
        metrics: metrics_report(metrics, scenario),
    }
}

fn metrics_report(metrics: PitchQualityMetrics, scenario: &ScenarioDefinition) -> MetricsReport {
    MetricsReport {
        evaluated_duration_seconds: metrics.evaluated_duration_seconds,
        time_to_first_correct_ms: metrics.time_to_first_correct_ms,
        mean_reacquisition_latency_ms: metrics.mean_reacquisition_latency_ms,
        max_reacquisition_latency_ms: metrics.max_reacquisition_latency_ms,
        missed_acquisitions: metrics.missed_acquisitions,
        false_lock_duration_ms: metrics.false_lock_duration_ms,
        false_lock_ratio: metrics.false_lock_ratio,
        note_switches_per_second: metrics.note_switches_per_second,
        stable_sustain_cents_mae: metrics.stable_sustain_cents_mae,
        stable_sustain_cents_p50: metrics.stable_sustain_cents_p50,
        stable_sustain_cents_p95: metrics.stable_sustain_cents_p95,
        stable_sustain_cents_max: metrics.stable_sustain_cents_max,
        octave_error_ratio: metrics.octave_error_ratio,
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
                stable_sustain_cents_p50: metrics.stable_sustain_cents_p50,
                stable_sustain_cents_p95: metrics.stable_sustain_cents_p95,
                stable_sustain_cents_max: metrics.stable_sustain_cents_max,
                octave_error_ratio: metrics.octave_error_ratio,
                stable_detection_coverage: metrics.stable_detection_coverage,
            })
            .collect(),
    }
}

pub(super) fn build_snr_level(
    snr_db: f32,
    scenario: &ScenarioDefinition,
    thresholds: PitchQualityThresholds,
    metrics: PitchQualityMetrics,
    violations: Vec<QualityThresholdViolation>,
) -> SnrLevelReport {
    SnrLevelReport {
        snr_db,
        passed: violations.is_empty(),
        thresholds: thresholds.into(),
        violations: violations.into_iter().map(Into::into).collect(),
        metrics: metrics_report(metrics, scenario),
    }
}

pub(super) fn build_reverb_condition(
    rt60_seconds: f32,
    wet_db: f32,
    scenario: &ScenarioDefinition,
    thresholds: PitchQualityThresholds,
    metrics: PitchQualityMetrics,
    violations: Vec<QualityThresholdViolation>,
) -> ReverbConditionReport {
    ReverbConditionReport {
        rt60_seconds,
        wet_db,
        passed: violations.is_empty(),
        thresholds: thresholds.into(),
        violations: violations.into_iter().map(Into::into).collect(),
        metrics: metrics_report(metrics, scenario),
    }
}

#[allow(clippy::too_many_arguments)]
pub(super) fn build_corpus_capture(
    capture: &CorpusCapture,
    path: String,
    scenario: &ScenarioDefinition,
    runtime: &ScenarioRuntime,
    thresholds: PitchQualityThresholds,
    metrics: PitchQualityMetrics,
    violations: Vec<QualityThresholdViolation>,
    snr_levels: Vec<SnrLevelReport>,
    reverb_conditions: Vec<ReverbConditionReport>,
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
        snr_levels,
        reverb_conditions,
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
    let snr_levels_evaluated = captures
        .iter()
        .map(|capture| capture.snr_levels.len())
        .sum();
    let snr_levels_passed = captures
        .iter()
        .flat_map(|capture| capture.snr_levels.iter())
        .filter(|level| level.passed)
        .count();
    let reverb_conditions_evaluated = captures
        .iter()
        .map(|capture| capture.reverb_conditions.len())
        .sum();
    let reverb_conditions_passed = captures
        .iter()
        .flat_map(|capture| capture.reverb_conditions.iter())
        .filter(|condition| condition.passed)
        .count();
    CorpusReport {
        schema_version: SCHEMA_VERSION,
        corpus: corpus.id.clone(),
        config_revision: corpus.config_revision.clone(),
        // The clean gate is unchanged: every capture must pass its clean
        // thresholds. SNR levels and reverb conditions gate on top of that,
        // never instead of it.
        passed: passed_captures == captures.len()
            && snr_levels_passed == snr_levels_evaluated
            && reverb_conditions_passed == reverb_conditions_evaluated,
        summary: CorpusSummary {
            capture_count: captures.len(),
            passed_captures,
            failed_captures: captures.len() - passed_captures,
            violation_count,
            snr_levels_evaluated,
            snr_levels_passed,
            reverb_conditions_evaluated,
            reverb_conditions_passed,
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
