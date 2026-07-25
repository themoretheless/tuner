//! HPS (harmonic product spectrum) octave guard, exercised through the
//! public `OctaveDisambiguator` the same way the hybrid detector uses it.

use pitch_core::OctaveDisambiguator;

fn harmonic_signal(
    fundamental: f32,
    amplitudes: &[f32],
    sample_rate: f32,
    samples: usize,
) -> Vec<f32> {
    (0..samples)
        .map(|index| {
            let t = index as f32 / sample_rate;
            amplitudes
                .iter()
                .enumerate()
                .map(|(harmonic, amplitude)| {
                    amplitude
                        * (std::f32::consts::TAU * fundamental * (harmonic + 1) as f32 * t).sin()
                })
                .sum()
        })
        .collect()
}

#[test]
fn octave_up_lock_folds_back_to_the_spectral_fundamental() {
    let sample_rate = 48_000.0;
    // Detector locked onto 2f0 (300 Hz) while the spectrum carries a full
    // harmonic series rooted at 150 Hz. The fold needs two consecutive
    // frames of evidence (the same confirmation the Goertzel path uses).
    let buffer = harmonic_signal(150.0, &[0.4, 0.2, 0.1, 0.05], sample_rate, 8_192);
    let mut checker = OctaveDisambiguator::new();

    let first = checker.resolve(&buffer, sample_rate, 300.0, 30.0, 1_400.0);
    assert_eq!(
        first, 300.0,
        "first frame must not fold without confirmation"
    );
    let resolved = checker.resolve(&buffer, sample_rate, 300.0, 30.0, 1_400.0);
    assert!(
        (resolved - 150.0).abs() < 1.0,
        "second frame must fold 300 Hz down to the 150 Hz fundamental, got {resolved}"
    );
}

#[test]
fn subharmonic_lock_folds_up_to_the_supported_octave() {
    let sample_rate = 48_000.0;
    // Missing fundamental: energy only at 220/440/660 Hz. A 110 Hz lock is a
    // subharmonic error and the spectrum supports 220 Hz instead.
    let buffer = harmonic_signal(220.0, &[0.4, 0.25, 0.12], sample_rate, 8_192);
    let mut checker = OctaveDisambiguator::new();

    checker.resolve(&buffer, sample_rate, 110.0, 30.0, 1_400.0);
    let resolved = checker.resolve(&buffer, sample_rate, 110.0, 30.0, 1_400.0);
    assert!(
        (resolved - 220.0).abs() < 1.0,
        "110 Hz lock must fold up to 220 Hz, got {resolved}"
    );
}

#[test]
fn supported_estimate_is_not_flipped() {
    let sample_rate = 48_000.0;
    let buffer = harmonic_signal(150.0, &[0.4, 0.2, 0.1, 0.05], sample_rate, 8_192);
    let mut checker = OctaveDisambiguator::new();

    for _ in 0..4 {
        let resolved = checker.resolve(&buffer, sample_rate, 150.0, 30.0, 1_400.0);
        assert_eq!(resolved, 150.0, "a supported estimate must never move");
    }
}
