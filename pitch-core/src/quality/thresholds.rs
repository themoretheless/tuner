use super::{
    PitchQualityMetrics, PitchQualityThresholds, QualityMetric, QualityThresholdError,
    QualityThresholdRequirement, QualityThresholdViolation,
};

pub fn evaluate_quality_thresholds(
    metrics: &PitchQualityMetrics,
    thresholds: PitchQualityThresholds,
) -> Result<Vec<QualityThresholdViolation>, QualityThresholdError> {
    validate_thresholds(thresholds)?;

    let mut violations = Vec::new();
    check_maximum(
        &mut violations,
        QualityMetric::TimeToFirstCorrectMs,
        metrics.time_to_first_correct_ms,
        thresholds.max_time_to_first_correct_ms,
    );
    check_maximum(
        &mut violations,
        QualityMetric::MeanReacquisitionLatencyMs,
        metrics.mean_reacquisition_latency_ms,
        thresholds.max_mean_reacquisition_latency_ms,
    );
    check_maximum(
        &mut violations,
        QualityMetric::MaxReacquisitionLatencyMs,
        metrics.max_reacquisition_latency_ms,
        thresholds.max_reacquisition_latency_ms,
    );
    check_maximum(
        &mut violations,
        QualityMetric::MissedAcquisitions,
        Some(metrics.missed_acquisitions as f32),
        thresholds.max_missed_acquisitions.map(|value| value as f32),
    );
    check_maximum(
        &mut violations,
        QualityMetric::FalseLockRatio,
        Some(metrics.false_lock_ratio),
        thresholds.max_false_lock_ratio,
    );
    check_maximum(
        &mut violations,
        QualityMetric::NoteSwitchesPerSecond,
        Some(metrics.note_switches_per_second),
        thresholds.max_note_switches_per_second,
    );
    check_maximum(
        &mut violations,
        QualityMetric::StableSustainCentsMae,
        metrics.stable_sustain_cents_mae,
        thresholds.max_stable_sustain_cents_mae,
    );
    check_minimum(
        &mut violations,
        QualityMetric::StableDetectionCoverage,
        Some(metrics.stable_detection_coverage),
        thresholds.min_stable_detection_coverage,
    );

    Ok(violations)
}

fn validate_thresholds(thresholds: PitchQualityThresholds) -> Result<(), QualityThresholdError> {
    let non_negative = [
        thresholds.max_time_to_first_correct_ms,
        thresholds.max_mean_reacquisition_latency_ms,
        thresholds.max_reacquisition_latency_ms,
        thresholds.max_note_switches_per_second,
        thresholds.max_stable_sustain_cents_mae,
    ]
    .into_iter()
    .flatten()
    .all(|value| value.is_finite() && value >= 0.0);
    let ratios = [
        thresholds.max_false_lock_ratio,
        thresholds.min_stable_detection_coverage,
    ]
    .into_iter()
    .flatten()
    .all(|value| value.is_finite() && (0.0..=1.0).contains(&value));

    if non_negative && ratios {
        Ok(())
    } else {
        Err(QualityThresholdError::InvalidThresholds)
    }
}

fn check_maximum(
    violations: &mut Vec<QualityThresholdViolation>,
    metric: QualityMetric,
    observed: Option<f32>,
    limit: Option<f32>,
) {
    check(
        violations,
        metric,
        observed,
        limit,
        QualityThresholdRequirement::AtMost,
        |value, threshold| value <= threshold,
    );
}

fn check_minimum(
    violations: &mut Vec<QualityThresholdViolation>,
    metric: QualityMetric,
    observed: Option<f32>,
    limit: Option<f32>,
) {
    check(
        violations,
        metric,
        observed,
        limit,
        QualityThresholdRequirement::AtLeast,
        |value, threshold| value >= threshold,
    );
}

fn check(
    violations: &mut Vec<QualityThresholdViolation>,
    metric: QualityMetric,
    observed: Option<f32>,
    limit: Option<f32>,
    requirement: QualityThresholdRequirement,
    passes: impl FnOnce(f32, f32) -> bool,
) {
    let Some(limit) = limit else {
        return;
    };
    if observed.is_none_or(|value| !value.is_finite() || !passes(value, limit)) {
        violations.push(QualityThresholdViolation {
            metric,
            observed,
            limit,
            requirement,
        });
    }
}
