use super::validation::validate_inputs;
use super::{
    ExpectedPitchSegment, PitchObservation, PitchQualityMetrics, PitchSegmentMetrics,
    QualityEvaluationConfig, QualityEvaluationError,
};
use crate::{frequency_to_nearest_midi, get_cents};

/// Lower edge of the absolute cents-error band counted as an octave lock.
const OCTAVE_ERROR_MIN_CENTS: f32 = 1150.0;
/// Upper edge of the absolute cents-error band counted as an octave lock.
const OCTAVE_ERROR_MAX_CENTS: f32 = 1250.0;

#[derive(Clone, Copy, Debug, PartialEq)]
struct StableErrorSummary {
    p50: f32,
    p95: f32,
    max: f32,
    octave_error_ratio: f32,
}

struct SegmentEvaluation {
    metrics: PitchSegmentMetrics,
    stable_cents_error_seconds: f32,
    stable_detected_seconds: f32,
    stable_duration_seconds: f32,
    stable_errors: Vec<(f32, f32)>,
}

pub fn evaluate_pitch_quality(
    observations: &[PitchObservation],
    segments: &[ExpectedPitchSegment],
    config: QualityEvaluationConfig,
) -> Result<PitchQualityMetrics, QualityEvaluationError> {
    validate_inputs(segments, config)?;

    let mut observations: Vec<_> = observations
        .iter()
        .copied()
        .filter(|observation| observation.time_seconds.is_finite())
        .collect();
    observations.sort_by(|left, right| left.time_seconds.total_cmp(&right.time_seconds));

    let evaluations: Vec<_> = segments
        .iter()
        .map(|segment| evaluate_segment(&observations, *segment, config))
        .collect();
    let evaluated_duration_seconds = segments
        .iter()
        .map(|segment| segment.end_seconds - segment.start_seconds)
        .sum::<f32>();
    let false_lock_duration_ms = evaluations
        .iter()
        .map(|evaluation| evaluation.metrics.false_lock_duration_ms)
        .sum::<f32>();
    let note_switches = evaluations
        .iter()
        .map(|evaluation| evaluation.metrics.note_switches)
        .sum::<usize>();
    let stable_cents_error_seconds = evaluations
        .iter()
        .map(|evaluation| evaluation.stable_cents_error_seconds)
        .sum::<f32>();
    let stable_detected_seconds = evaluations
        .iter()
        .map(|evaluation| evaluation.stable_detected_seconds)
        .sum::<f32>();
    let stable_duration_seconds = evaluations
        .iter()
        .map(|evaluation| evaluation.stable_duration_seconds)
        .sum::<f32>();
    let reacquisition_latencies: Vec<_> = evaluations
        .iter()
        .skip(1)
        .filter_map(|evaluation| evaluation.metrics.acquisition_latency_ms)
        .collect();
    let stable_errors: Vec<_> = evaluations
        .iter()
        .flat_map(|evaluation| evaluation.stable_errors.iter().copied())
        .collect();
    let stable_summary = summarize_stable_errors(&stable_errors);

    Ok(PitchQualityMetrics {
        evaluated_duration_seconds,
        time_to_first_correct_ms: evaluations
            .first()
            .and_then(|evaluation| evaluation.metrics.acquisition_latency_ms),
        mean_reacquisition_latency_ms: mean(&reacquisition_latencies),
        max_reacquisition_latency_ms: reacquisition_latencies.iter().copied().reduce(f32::max),
        missed_acquisitions: evaluations
            .iter()
            .filter(|evaluation| evaluation.metrics.acquisition_latency_ms.is_none())
            .count(),
        false_lock_duration_ms,
        false_lock_ratio: false_lock_duration_ms / (evaluated_duration_seconds * 1000.0),
        note_switches_per_second: note_switches as f32 / evaluated_duration_seconds,
        stable_sustain_cents_mae: (stable_detected_seconds > 0.0)
            .then_some(stable_cents_error_seconds / stable_detected_seconds),
        stable_sustain_cents_p50: stable_summary.map(|summary| summary.p50),
        stable_sustain_cents_p95: stable_summary.map(|summary| summary.p95),
        stable_sustain_cents_max: stable_summary.map(|summary| summary.max),
        octave_error_ratio: stable_summary.map(|summary| summary.octave_error_ratio),
        stable_detection_coverage: stable_detected_seconds / stable_duration_seconds,
        segments: evaluations
            .into_iter()
            .map(|evaluation| evaluation.metrics)
            .collect(),
    })
}

fn evaluate_segment(
    observations: &[PitchObservation],
    segment: ExpectedPitchSegment,
    config: QualityEvaluationConfig,
) -> SegmentEvaluation {
    let mut acquisition_latency_ms = None;
    let mut correct_run_start = None;
    let mut false_lock_duration_seconds = 0.0;
    let mut previous_note = None;
    let mut note_switches = 0usize;
    let mut stable_cents_error_seconds = 0.0;
    let mut stable_detected_seconds = 0.0;
    let mut stable_errors = Vec::new();
    let stable_start = segment.start_seconds + segment.stable_after_seconds;
    let stable_duration_seconds = segment.end_seconds - stable_start;
    let mut cursor = segment.start_seconds;

    for (index, observation) in observations.iter().enumerate() {
        if observation.time_seconds >= segment.end_seconds {
            break;
        }
        let next_time = observations
            .get(index + 1)
            .map_or(segment.end_seconds, |next| next.time_seconds);
        if next_time <= segment.start_seconds {
            continue;
        }

        let interval_start = observation.time_seconds.max(segment.start_seconds);
        let interval_end = next_time.min(segment.end_seconds);
        if interval_end <= interval_start {
            continue;
        }
        if interval_start > cursor {
            correct_run_start = None;
        }
        cursor = interval_end;

        let frequency = valid_frequency(observation.frequency);
        let cents_error = frequency.map(|value| get_cents(value, segment.target_frequency).abs());
        let correct = cents_error.is_some_and(|error| error <= config.tolerance_cents);

        if correct {
            let run_start = *correct_run_start.get_or_insert(interval_start);
            if acquisition_latency_ms.is_none()
                && interval_end - run_start >= config.minimum_correct_hold_seconds
            {
                acquisition_latency_ms = Some((run_start - segment.start_seconds) * 1000.0);
            }
        } else {
            correct_run_start = None;
            if frequency.is_some() {
                false_lock_duration_seconds += interval_end - interval_start;
            }
        }

        if let Some(value) = frequency {
            let note = frequency_to_nearest_midi(value, config.reference_a4);
            if previous_note.is_some_and(|previous| previous != note) {
                note_switches += 1;
            }
            previous_note = Some(note);
        }

        let stable_interval_start = interval_start.max(stable_start);
        if interval_end > stable_interval_start {
            if let Some(error) = cents_error {
                let duration = interval_end - stable_interval_start;
                stable_detected_seconds += duration;
                stable_cents_error_seconds += error * duration;
                stable_errors.push((error, duration));
            }
        }
    }

    let stable_summary = summarize_stable_errors(&stable_errors);

    SegmentEvaluation {
        metrics: PitchSegmentMetrics {
            target_frequency: segment.target_frequency,
            acquisition_latency_ms,
            false_lock_duration_ms: false_lock_duration_seconds * 1000.0,
            note_switches,
            stable_sustain_cents_mae: (stable_detected_seconds > 0.0)
                .then_some(stable_cents_error_seconds / stable_detected_seconds),
            stable_sustain_cents_p50: stable_summary.map(|summary| summary.p50),
            stable_sustain_cents_p95: stable_summary.map(|summary| summary.p95),
            stable_sustain_cents_max: stable_summary.map(|summary| summary.max),
            octave_error_ratio: stable_summary.map(|summary| summary.octave_error_ratio),
            stable_detection_coverage: stable_detected_seconds / stable_duration_seconds,
        },
        stable_cents_error_seconds,
        stable_detected_seconds,
        stable_duration_seconds,
        stable_errors,
    }
}

/// Duration-weighted distribution of absolute sustain cents errors.
///
/// `samples` holds `(abs_cents_error, duration_seconds)` pairs collected over
/// the stable sustain window, the same population that feeds
/// `stable_sustain_cents_mae`. Percentiles use the weighted nearest-rank
/// convention; the octave ratio is the duration share of errors inside
/// ±50 cents around one octave (1200 cents).
fn summarize_stable_errors(samples: &[(f32, f32)]) -> Option<StableErrorSummary> {
    let total_duration: f32 = samples.iter().map(|(_, duration)| duration).sum();
    if samples.is_empty() || total_duration <= 0.0 {
        return None;
    }

    let mut sorted: Vec<_> = samples.to_vec();
    sorted.sort_by(|left, right| left.0.total_cmp(&right.0));

    let weighted_percentile = |quantile: f32| {
        let threshold = quantile * total_duration;
        let mut cumulative = 0.0;
        for (error, duration) in &sorted {
            cumulative += duration;
            if cumulative >= threshold {
                return *error;
            }
        }
        sorted.last().map_or(0.0, |(error, _)| *error)
    };

    let octave_duration: f32 = sorted
        .iter()
        .filter(|(error, _)| (OCTAVE_ERROR_MIN_CENTS..=OCTAVE_ERROR_MAX_CENTS).contains(error))
        .fold(0.0, |total, (_, duration)| total + duration);

    Some(StableErrorSummary {
        p50: weighted_percentile(0.50),
        p95: weighted_percentile(0.95),
        max: sorted.last().map_or(0.0, |(error, _)| *error),
        octave_error_ratio: octave_duration / total_duration,
    })
}

fn valid_frequency(frequency: Option<f32>) -> Option<f32> {
    frequency.filter(|value| value.is_finite() && *value > 0.0)
}

fn mean(values: &[f32]) -> Option<f32> {
    (!values.is_empty()).then(|| values.iter().sum::<f32>() / values.len() as f32)
}
