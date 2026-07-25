//! Phase-based period refinement on a synthetic high note.

use pitch_core::{DetectorConfig, PhaseRefiner, PitchDetector, PitchEstimate, YinDetector};

fn e6_signal(sample_rate: f32, samples: usize) -> (f32, Vec<f32>) {
    // E6 = 1318.51 Hz: high enough that one lag quantum is a large fraction
    // of the period and the YIN parabolic interpolation bias shows.
    let frequency = 1_318.51;
    let buffer = (0..samples)
        .map(|index| {
            let t = index as f32 / sample_rate;
            0.3 * (std::f32::consts::TAU * frequency * t).sin()
                + 0.15 * (std::f32::consts::TAU * 2.0 * frequency * t).sin()
                + 0.07 * (std::f32::consts::TAU * 3.0 * frequency * t).sin()
        })
        .collect();
    (frequency, buffer)
}

fn cents_error(measured: f32, expected: f32) -> f32 {
    (1_200.0 * (measured / expected).log2()).abs()
}

#[test]
fn phase_refinement_reduces_yin_bias_on_a_high_note() {
    let sample_rate = 48_000.0;
    let (frequency, buffer) = e6_signal(sample_rate, 8_192);
    let mut yin = YinDetector::new(DetectorConfig::default());
    let estimate = yin
        .detect(&buffer, sample_rate)
        .expect("clean tone detects");
    let raw_error = cents_error(estimate.frequency, frequency);

    let mut refiner = PhaseRefiner::new();
    let refined = refiner.refine(&buffer, sample_rate, estimate);
    let refined_error = cents_error(refined.frequency, frequency);

    assert!(
        refined_error < raw_error,
        "refinement must reduce the error: raw {raw_error:.3} cents, refined {refined_error:.3} cents"
    );
    assert!(
        refined_error < 0.2,
        "refined high-note error must be well under a cent, got {refined_error:.3}"
    );
}

#[test]
fn noisy_low_confidence_frames_keep_the_time_domain_estimate() {
    let sample_rate = 48_000.0;
    let (_, buffer) = e6_signal(sample_rate, 8_192);
    let mut refiner = PhaseRefiner::new();
    let low_confidence = PitchEstimate {
        confidence: 0.5,
        frequency: 1_319.4,
    };
    let refined = refiner.refine(&buffer, sample_rate, low_confidence);
    assert_eq!(
        refined.frequency, low_confidence.frequency,
        "the gate must pass low-confidence frames through untouched"
    );
}
