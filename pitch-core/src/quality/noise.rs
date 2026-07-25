//! Deterministic noise mixing for offline robustness evaluation.
//!
//! Like the rest of the `quality` module this never runs in the realtime
//! detector path; it exists so the benchmark harness can replay a capture at
//! controlled SNR levels without touching the original fixtures.

/// White Gaussian noise, xorshift64* + Box-Muller.
///
/// Returns a copy of `samples` mixed with white Gaussian noise whose RMS
/// puts the mixture at `snr_db` relative to the signal's own RMS
/// (`noise_rms = signal_rms * 10^(-snr_db/20)`). The generator is a seeded
/// xorshift64* PRNG feeding a Box-Muller transform, so the same
/// `(samples, snr_db, seed)` triple always produces bit-identical output —
/// corpus reports stay reproducible without storing noise fixtures.
///
/// White noise was chosen over pink: it stresses all detector stages
/// uniformly across the spectrum, while pink noise concentrates energy at
/// low frequencies and would mostly re-test the already-gated hum
/// robustness.
pub fn mix_white_noise_at_snr(samples: &[f32], snr_db: f32, seed: u64) -> Vec<f32> {
    let mut mixed = samples.to_vec();
    if samples.is_empty() || !snr_db.is_finite() {
        return mixed;
    }
    let signal_rms =
        (samples.iter().map(|sample| sample * sample).sum::<f32>() / samples.len() as f32).sqrt();
    if signal_rms <= 0.0 {
        return mixed;
    }
    let noise_rms = signal_rms * 10.0_f32.powf(-snr_db / 20.0);

    let mut state = seed | 1; // xorshift must not start at zero
    let mut spare: Option<f32> = None;
    for sample in &mut mixed {
        let gaussian = match spare.take() {
            Some(value) => value,
            None => {
                let (first, second) = box_muller(&mut state);
                spare = Some(second);
                first
            }
        };
        *sample += noise_rms * gaussian;
    }
    mixed
}

fn next_uniform(state: &mut u64) -> f64 {
    // xorshift64*: period 2^64-1, good enough for noise synthesis.
    let mut x = *state;
    x ^= x >> 12;
    x ^= x << 25;
    x ^= x >> 27;
    *state = x;
    // Map to (0, 1) — never exactly 0 so log() stays finite.
    (x.wrapping_mul(0x2545_F491_4F6C_DD1D) >> 11) as f64 * (1.0 / (1u64 << 53) as f64)
        + f64::MIN_POSITIVE
}

fn box_muller(state: &mut u64) -> (f32, f32) {
    let u1 = next_uniform(state);
    let u2 = next_uniform(state);
    let radius = (-2.0 * u1.ln()).sqrt();
    let angle = std::f64::consts::TAU * u2;
    ((radius * angle.cos()) as f32, (radius * angle.sin()) as f32)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sine(samples: usize) -> Vec<f32> {
        (0..samples)
            .map(|index| 0.5 * (std::f32::consts::TAU * 440.0 * index as f32 / 48_000.0).sin())
            .collect()
    }

    #[test]
    fn mixing_is_deterministic() {
        let samples = sine(4_096);
        assert_eq!(
            mix_white_noise_at_snr(&samples, 20.0, 42),
            mix_white_noise_at_snr(&samples, 20.0, 42)
        );
    }

    #[test]
    fn measured_snr_matches_the_requested_level() {
        let samples = sine(48_000);
        let mixed = mix_white_noise_at_snr(&samples, 20.0, 7);
        let noise: Vec<f32> = mixed
            .iter()
            .zip(&samples)
            .map(|(mixed, clean)| mixed - clean)
            .collect();
        let rms = |samples: &[f32]| {
            (samples.iter().map(|sample| sample * sample).sum::<f32>() / samples.len() as f32)
                .sqrt()
        };
        let measured = 20.0 * (rms(&samples) / rms(&noise)).log10();
        assert!(
            (measured - 20.0).abs() < 0.2,
            "measured SNR {measured} dB should be within 0.2 dB of 20 dB"
        );
    }

    #[test]
    fn different_seeds_decorrelate() {
        let samples = sine(4_096);
        assert_ne!(
            mix_white_noise_at_snr(&samples, 10.0, 1),
            mix_white_noise_at_snr(&samples, 10.0, 2)
        );
    }
}
