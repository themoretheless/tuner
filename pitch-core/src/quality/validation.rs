use super::{ExpectedPitchSegment, QualityEvaluationConfig, QualityEvaluationError};

pub(super) fn validate_inputs(
    segments: &[ExpectedPitchSegment],
    config: QualityEvaluationConfig,
) -> Result<(), QualityEvaluationError> {
    if !config.tolerance_cents.is_finite()
        || config.tolerance_cents <= 0.0
        || !config.minimum_correct_hold_seconds.is_finite()
        || config.minimum_correct_hold_seconds < 0.0
        || !config.reference_a4.is_finite()
        || config.reference_a4 <= 0.0
    {
        return Err(QualityEvaluationError::InvalidConfig);
    }
    if segments.is_empty() {
        return Err(QualityEvaluationError::NoSegments);
    }

    for (index, segment) in segments.iter().enumerate() {
        let duration = segment.end_seconds - segment.start_seconds;
        if !segment.start_seconds.is_finite()
            || !segment.end_seconds.is_finite()
            || segment.start_seconds < 0.0
            || duration <= 0.0
            || !segment.target_frequency.is_finite()
            || segment.target_frequency <= 0.0
            || !segment.stable_after_seconds.is_finite()
            || segment.stable_after_seconds < 0.0
            || segment.stable_after_seconds >= duration
        {
            return Err(QualityEvaluationError::InvalidSegment { index });
        }

        if let Some(previous) = index.checked_sub(1).and_then(|value| segments.get(value)) {
            if segment.start_seconds < previous.start_seconds {
                return Err(QualityEvaluationError::SegmentsNotChronological {
                    previous: index - 1,
                    current: index,
                });
            }
            if segment.start_seconds < previous.end_seconds {
                return Err(QualityEvaluationError::OverlappingSegments {
                    previous: index - 1,
                    current: index,
                });
            }
        }
    }

    Ok(())
}
