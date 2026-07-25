//! Proof for the raised default `max_frequency` (400 Hz -> 1400 Hz).
//!
//! A guitar above the 12th fret of the high-E string produces fundamentals
//! far beyond 400 Hz (E4 = 329.6 Hz, E6 on the 24th fret ~= 1318.5 Hz).
//! These tests synthesize harmonic tones at 660 / 880 / 1200 Hz and show
//! that the *old* default range (30-400 Hz) could not lock any of them
//! (rejection or sub-harmonic misdetection), while the *new* default
//! configuration accepts them with sub-5-cent error.

use pitch_core::{DetectorConfig, HybridPitchDetector, PitchDetector};

const SAMPLE_RATE: f32 = 48_000.0;
/// Match the window size used by the quality corpus and the web pipeline.
const WINDOW_SAMPLES: usize = 8192;

/// Fundamental plus two decaying harmonics, like a plucked string.
fn harmonic_tone(fundamental: f32) -> Vec<f32> {
    (0..WINDOW_SAMPLES)
        .map(|index| {
            let phase = std::f32::consts::TAU * fundamental * index as f32 / SAMPLE_RATE;
            0.5 * phase.sin() + 0.25 * (2.0 * phase).sin() + 0.125 * (3.0 * phase).sin()
        })
        .collect()
}

fn cents_off(measured: f32, target: f32) -> f32 {
    1_200.0 * (measured / target).log2()
}

#[test]
fn default_max_frequency_covers_the_whole_guitar_fretboard() {
    let config = DetectorConfig::default();
    assert!(
        config.max_frequency >= 1_400.0,
        "default max_frequency {} Hz must reach E6 (~1318.5 Hz, 24th fret high-E)",
        config.max_frequency
    );
}

#[test]
fn old_default_range_cannot_lock_high_fret_notes() {
    // Reconstruct the pre-change default explicitly: 30-400 Hz. The old
    // range either rejects the tone outright or locks onto a sub-harmonic
    // an octave (or more) down, because YIN's first CMNDF dip inside the
    // searched tau window sits at a multiple of the true period. Both
    // outcomes are failures: the criterion is the absence of a *correct*
    // reading.
    for fundamental in [660.0, 880.0, 1_200.0] {
        let mut detector =
            HybridPitchDetector::new(DetectorConfig::default().with_frequency_range(30.0, 400.0));
        let estimate = detector.detect(&harmonic_tone(fundamental), SAMPLE_RATE);
        eprintln!("legacy 30-400 Hz default @ {fundamental} Hz -> {estimate:?}");
        match estimate {
            None => {} // rejected outright
            Some(estimate) => {
                let error = cents_off(estimate.frequency, fundamental);
                assert!(
                    error.abs() > 50.0,
                    "legacy default must NOT lock {fundamental} Hz correctly, \
                     got {} Hz ({error:+.2} cents)",
                    estimate.frequency
                );
            }
        }
    }
}

#[test]
fn new_default_range_accepts_high_fret_notes_within_a_few_cents() {
    for fundamental in [660.0, 880.0, 1_200.0] {
        let mut detector = HybridPitchDetector::new(DetectorConfig::default());
        let estimate = detector
            .detect(&harmonic_tone(fundamental), SAMPLE_RATE)
            .unwrap_or_else(|| panic!("default config must accept {fundamental} Hz"));
        let error = cents_off(estimate.frequency, fundamental);
        eprintln!(
            "new default @ {fundamental} Hz -> {} Hz ({error:+.3} cents, confidence {})",
            estimate.frequency, estimate.confidence
        );
        assert!(
            error.abs() < 5.0,
            "{fundamental} Hz measured as {} Hz ({error:+.2} cents)",
            estimate.frequency
        );
        assert!(
            estimate.confidence >= 0.7,
            "{fundamental} Hz confidence {} below usable threshold",
            estimate.confidence
        );
    }
}
