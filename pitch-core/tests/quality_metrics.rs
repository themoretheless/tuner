use approx::assert_abs_diff_eq;
use pitch_core::{
    evaluate_pitch_quality, ExpectedPitchSegment, PitchObservation, QualityEvaluationConfig,
    QualityEvaluationError,
};

fn observation(time_seconds: f32, frequency: Option<f32>) -> PitchObservation {
    PitchObservation {
        time_seconds,
        frequency,
    }
}

fn segment(
    start_seconds: f32,
    end_seconds: f32,
    target_frequency: f32,
    stable_after_seconds: f32,
) -> ExpectedPitchSegment {
    ExpectedPitchSegment {
        start_seconds,
        end_seconds,
        target_frequency,
        stable_after_seconds,
    }
}

#[test]
fn measures_confirmed_acquisition_false_lock_and_note_switches() {
    let metrics = evaluate_pitch_quality(
        &[
            observation(0.0, Some(200.0)),
            observation(0.1, Some(200.0)),
            observation(0.2, Some(100.0)),
        ],
        &[segment(0.0, 1.0, 100.0, 0.4)],
        QualityEvaluationConfig::default(),
    )
    .expect("valid quality trace");

    assert_abs_diff_eq!(
        metrics.time_to_first_correct_ms.unwrap(),
        200.0,
        epsilon = 0.01
    );
    assert_abs_diff_eq!(metrics.false_lock_duration_ms, 200.0, epsilon = 0.01);
    assert_abs_diff_eq!(metrics.false_lock_ratio, 0.2, epsilon = 0.0001);
    assert_abs_diff_eq!(metrics.note_switches_per_second, 1.0, epsilon = 0.0001);
    assert_abs_diff_eq!(
        metrics.stable_sustain_cents_mae.unwrap(),
        0.0,
        epsilon = 0.0001
    );
    assert_abs_diff_eq!(metrics.stable_detection_coverage, 1.0, epsilon = 0.0001);
}

#[test]
fn measures_reacquisition_without_counting_the_expected_boundary_as_a_switch() {
    let metrics = evaluate_pitch_quality(
        &[
            observation(0.0, Some(100.0)),
            observation(1.0, Some(100.0)),
            observation(1.2, Some(150.0)),
        ],
        &[segment(0.0, 1.0, 100.0, 0.2), segment(1.0, 2.0, 150.0, 0.3)],
        QualityEvaluationConfig::default(),
    )
    .expect("valid transition trace");

    assert_abs_diff_eq!(
        metrics.time_to_first_correct_ms.unwrap(),
        0.0,
        epsilon = 0.01
    );
    assert_abs_diff_eq!(
        metrics.mean_reacquisition_latency_ms.unwrap(),
        200.0,
        epsilon = 0.01
    );
    assert_abs_diff_eq!(
        metrics.max_reacquisition_latency_ms.unwrap(),
        200.0,
        epsilon = 0.01
    );
    assert_abs_diff_eq!(metrics.false_lock_duration_ms, 200.0, epsilon = 0.01);
    assert_abs_diff_eq!(metrics.note_switches_per_second, 0.5, epsilon = 0.0001);
    assert_eq!(metrics.missed_acquisitions, 0);
}

#[test]
fn reports_detection_coverage_separately_from_cents_accuracy() {
    let metrics = evaluate_pitch_quality(
        &[observation(0.0, None), observation(0.7, Some(100.0))],
        &[segment(0.0, 1.0, 100.0, 0.5)],
        QualityEvaluationConfig::default(),
    )
    .expect("valid dropout trace");

    assert_abs_diff_eq!(
        metrics.time_to_first_correct_ms.unwrap(),
        700.0,
        epsilon = 0.01
    );
    assert_abs_diff_eq!(metrics.stable_detection_coverage, 0.6, epsilon = 0.0001);
    assert_abs_diff_eq!(
        metrics.stable_sustain_cents_mae.unwrap(),
        0.0,
        epsilon = 0.0001
    );
}

#[test]
fn computes_time_weighted_stable_sustain_mae() {
    let ten_cents_sharp = 100.0 * 2.0_f32.powf(10.0 / 1200.0);
    let metrics = evaluate_pitch_quality(
        &[observation(0.0, Some(ten_cents_sharp))],
        &[segment(0.0, 1.0, 100.0, 0.2)],
        QualityEvaluationConfig {
            tolerance_cents: 15.0,
            ..QualityEvaluationConfig::default()
        },
    )
    .expect("valid detuned trace");

    assert_abs_diff_eq!(
        metrics.stable_sustain_cents_mae.unwrap(),
        10.0,
        epsilon = 0.01
    );
    assert_abs_diff_eq!(metrics.stable_detection_coverage, 1.0, epsilon = 0.0001);
}

#[test]
fn rejects_invalid_and_overlapping_scenarios() {
    assert_eq!(
        evaluate_pitch_quality(&[], &[], QualityEvaluationConfig::default()),
        Err(QualityEvaluationError::NoSegments)
    );
    assert_eq!(
        evaluate_pitch_quality(
            &[],
            &[segment(0.0, 1.0, 100.0, 0.2), segment(0.9, 2.0, 150.0, 0.2),],
            QualityEvaluationConfig::default(),
        ),
        Err(QualityEvaluationError::OverlappingSegments {
            previous: 0,
            current: 1,
        })
    );
}
