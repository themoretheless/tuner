//! Deterministic artificial reverb for offline robustness evaluation.
//!
//! Like the rest of the `quality` module this never runs in the realtime
//! detector path; it exists so the benchmark harness can replay a capture
//! under controlled reverberant conditions without touching the original
//! fixtures.
//!
//! Impulse response model: exponentially decaying white Gaussian noise
//! (`ir[t] = n[t] * exp(-6.908 * t / rt60)`, i.e. −60 dB at `rt60`
//! seconds), the standard synthetic-room approximation. Decaying noise was
//! chosen over a comb/allpass network because it has no tonal resonances of
//! its own, so every grid condition stresses the detector with diffuse
//! late energy rather than with one resonant frequency. The IR is built
//! from the same seeded xorshift64* + Box–Muller generator as
//! [`crate::mix_white_noise_at_snr`], so a `(capture, rt60, wet, seed)`
//! tuple always reproduces bit-identical output.
//!
//! The mix normalizes the wet signal to the dry RMS and applies the wet
//! level in dB relative to the dry signal: the grid's −12 dB wet means the
//! reverberant tail carries a quarter of the dry power, a moderately
//! reverberant room.

use super::noise::box_muller;
use rustfft::{num_complex::Complex, FftPlanner};

/// Synthesize a deterministic exponentially decaying noise impulse response
/// for the given RT60 (seconds) and sample rate. The IR is energy-normalized
/// so the wet level is controlled purely by the mix ratio.
pub fn synthesize_impulse_response(rt60_seconds: f32, sample_rate: f32, seed: u64) -> Vec<f32> {
    if !rt60_seconds.is_finite() || rt60_seconds <= 0.0 || sample_rate <= 0.0 {
        return Vec::new();
    }
    // Carry the IR out to −80 dB so the tail does not end audibly abruptly.
    let length = ((rt60_seconds * 80.0 / 60.0) * sample_rate) as usize + 1;
    let decay_per_sample = -6.907_755_3 / (rt60_seconds * sample_rate);
    let mut state = seed | 1;
    let mut spare: Option<f32> = None;
    let mut energy = 0.0_f64;
    let mut ir = Vec::with_capacity(length);
    for index in 0..length {
        let gaussian = match spare.take() {
            Some(value) => value,
            None => {
                let (first, second) = box_muller(&mut state);
                spare = Some(second);
                first
            }
        };
        let sample = gaussian * (decay_per_sample * index as f32).exp();
        energy += f64::from(sample) * f64::from(sample);
        ir.push(sample);
    }
    if energy > 0.0 {
        let scale = (1.0 / energy.sqrt()) as f32;
        for sample in &mut ir {
            *sample *= scale;
        }
    }
    ir
}

/// Convolve `samples` with the impulse response via FFT (full convolution,
/// output length `samples + ir - 1`). FFT block convolution keeps even the
/// 1.5 s RT60 condition cheap: direct convolution would be ~10^10 MACs per
/// corpus capture.
pub fn convolve(samples: &[f32], ir: &[f32]) -> Vec<f32> {
    if samples.is_empty() || ir.is_empty() {
        return samples.to_vec();
    }
    let size = (samples.len() + ir.len() - 1).next_power_of_two();
    let mut planner = FftPlanner::<f32>::new();
    let fft = planner.plan_fft_forward(size);
    let inverse = planner.plan_fft_inverse(size);

    let mut signal: Vec<Complex<f32>> = samples
        .iter()
        .map(|sample| Complex::new(*sample, 0.0))
        .chain(std::iter::repeat(Complex::new(0.0, 0.0)))
        .take(size)
        .collect();
    let mut kernel: Vec<Complex<f32>> = ir
        .iter()
        .map(|sample| Complex::new(*sample, 0.0))
        .chain(std::iter::repeat(Complex::new(0.0, 0.0)))
        .take(size)
        .collect();
    fft.process(&mut signal);
    fft.process(&mut kernel);
    for (signal, kernel) in signal.iter_mut().zip(&kernel) {
        *signal *= kernel;
    }
    inverse.process(&mut signal);

    let scale = 1.0 / size as f32;
    signal[..samples.len() + ir.len() - 1]
        .iter()
        .map(|bin| bin.re * scale)
        .collect()
}

/// Mix `samples` with their reverberated copy at `wet_db` relative to the
/// dry RMS. Output length matches the input: the tail beyond the capture is
/// truncated (captures end with enough silence margin in the corpus).
pub fn apply_reverb(samples: &[f32], ir: &[f32], wet_db: f32) -> Vec<f32> {
    let wet = convolve(samples, ir);
    let dry_rms = rms(samples);
    let wet_rms = rms(&wet[..samples.len().min(wet.len())]);
    if dry_rms <= 0.0 || wet_rms <= 0.0 {
        return samples.to_vec();
    }
    let wet_gain = dry_rms * 10.0_f32.powf(wet_db / 20.0) / wet_rms;
    samples
        .iter()
        .zip(&wet)
        .map(|(dry, wet)| dry + wet_gain * wet)
        .collect()
}

/// Deterministic per-capture, per-condition seed (FNV-1a over the capture id
/// and the RT60 bits), matching the SNR grid's seeding style.
pub fn reverb_seed(capture_id: &str, rt60_seconds: f32) -> u64 {
    let mut hash = 0xcbf2_9ce4_8422_2325_u64;
    for byte in capture_id
        .as_bytes()
        .iter()
        .chain(rt60_seconds.to_bits().to_le_bytes().iter())
    {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
    }
    hash
}

fn rms(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }
    (samples.iter().map(|sample| sample * sample).sum::<f32>() / samples.len() as f32).sqrt()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn impulse_response_is_deterministic() {
        assert_eq!(
            synthesize_impulse_response(0.8, 48_000.0, 42),
            synthesize_impulse_response(0.8, 48_000.0, 42)
        );
    }

    #[test]
    fn impulse_response_decays_to_rt60() {
        let sample_rate = 48_000.0;
        let ir = synthesize_impulse_response(0.5, sample_rate, 7);
        // Energy in the first RT60 must dominate the tail beyond it.
        let rt60_samples = (0.5 * sample_rate) as usize;
        let early: f32 = ir[..rt60_samples].iter().map(|s| s * s).sum();
        let late: f32 = ir[rt60_samples..].iter().map(|s| s * s).sum();
        assert!(
            early > 20.0 * late,
            "energy past RT60 should be under 5 %: early {early}, late {late}"
        );
        // Unit total energy (normalized).
        let total: f32 = ir.iter().map(|s| s * s).sum();
        assert!((total - 1.0).abs() < 1e-3, "IR energy {total} must be ~1");
    }

    #[test]
    fn convolution_of_delta_returns_the_ir() {
        let ir = synthesize_impulse_response(0.1, 48_000.0, 3);
        let mut delta = vec![0.0_f32; 2_048];
        delta[10] = 1.0;
        let out = convolve(&delta, &ir);
        for (index, expected) in ir.iter().enumerate() {
            assert!(
                (out[index + 10] - expected).abs() < 1e-6,
                "convolved delta must reproduce the IR at {index}"
            );
        }
    }

    #[test]
    fn convolution_of_constant_signal_matches_direct_sum() {
        // A 100-sample box convolved with a 30-sample IR, checked against a
        // naive direct convolution at a few lags.
        let signal = vec![1.0_f32; 100];
        let ir: Vec<f32> = (0..30).map(|i| 1.0 - i as f32 / 30.0).collect();
        let fft_out = convolve(&signal, &ir);
        for lag in [0, 15, 50, 99, 110, 128] {
            let direct: f32 = (0..=lag.min(99))
                .filter(|k| lag - k < ir.len())
                .map(|k| ir[lag - k])
                .sum();
            assert!(
                (fft_out[lag] - direct).abs() < 1e-4,
                "lag {lag}: fft {} vs direct {direct}",
                fft_out[lag]
            );
        }
    }

    #[test]
    fn wet_mix_respects_the_requested_db() {
        let sample_rate = 48_000.0;
        let samples: Vec<f32> = (0..24_000)
            .map(|i| 0.4 * (std::f32::consts::TAU * 220.0 * i as f32 / sample_rate).sin())
            .collect();
        let ir = synthesize_impulse_response(0.8, sample_rate, 11);
        let out = apply_reverb(&samples, &ir, -12.0);
        // The wet-only difference should sit ~12 dB under the dry signal.
        let diff: Vec<f32> = out.iter().zip(&samples).map(|(o, d)| o - d).collect();
        let ratio = 20.0 * (rms(&samples) / rms(&diff)).log10();
        assert!(
            (ratio - 12.0).abs() < 1.5,
            "wet level should be ~-12 dB relative to dry, measured -{ratio} dB"
        );
    }

    #[test]
    fn seeds_decorrelate_conditions() {
        assert_ne!(
            synthesize_impulse_response(0.3, 48_000.0, reverb_seed("guitar-e2", 0.3)),
            synthesize_impulse_response(0.3, 48_000.0, reverb_seed("guitar-e2", 0.8))
        );
    }
}
