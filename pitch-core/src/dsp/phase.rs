//! Phase-domain refinement of a chosen time-domain period.
//!
//! YIN/MPM pick an integer lag and nudge it with parabolic interpolation of
//! the CMNDF/NSDF curve. That interpolation has a small systematic bias —
//! on high notes, where one lag quantum is a large fraction of the period,
//! the bias reaches a few cents. The phase of the fundamental and its low
//! harmonics carries much finer frequency information: across two windows
//! shifted by `D` samples the phase of a tone at `f` advances by exactly
//! `2*pi*f*D/sr`, so the residual between the measured and the predicted
//! phase advance directly measures the frequency error.
//!
//! The refinement probes the fundamental with a complex single-frequency
//! DFT ([`spectral::windowed_probe`]) on both windows and converts the phase
//! residual into a frequency correction. Safety gates:
//!
//! - frames below [`MIN_CONFIDENCE`] keep the time-domain value untouched
//!   (noisy phases would degrade them);
//! - harmonics much weaker than the fundamental are skipped (their phase is
//!   noise-dominated);
//! - the total correction is clamped to [`MAX_CORRECTION_CENTS`], so even a
//!   pathological frame can only nudge, never jump.
//!
//! Cost: at most six O(N) probes per frame — the same order as the existing
//! Goertzel octave probes — and no allocation.

use super::{spectral, PitchEstimate};

/// Low-SNR frames keep the raw time-domain estimate: their phase residuals
/// are noise, and refining them would add jitter instead of removing bias.
const MIN_CONFIDENCE: f32 = 0.8;

/// Hard clamp on the total correction. The biases being removed are a few
/// cents; anything larger is a measurement artifact, not a refinement.
const MAX_CORRECTION_CENTS: f32 = 6.0;

/// The two shifted windows must carry nearly the same loudness; a larger
/// mismatch marks an attack/decay transient whose phase advance no longer
/// measures frequency alone.
const MAX_RMS_DEVIATION: f32 = 0.10;

/// Harmonics probed in addition to the fundamental.
const MAX_HARMONIC: u32 = 3;

/// Skip probe frequencies above this fraction of the sample rate (matches
/// the octave disambiguator's probe limit).
const MAX_PROBE_NYQUIST_FRACTION: f32 = 0.45;

/// Need enough samples for a shifted pair of Hann windows to be meaningful.
const MIN_BUFFER_SAMPLES: usize = 512;

/// Stateless phase-domain refiner. Kept as a struct (like the other DSP
/// stages) so a scratch buffer can be added later without API churn.
pub struct PhaseRefiner;

impl Default for PhaseRefiner {
    fn default() -> Self {
        Self::new()
    }
}

impl PhaseRefiner {
    pub fn new() -> Self {
        Self
    }

    /// Returns `estimate` with its frequency nudged by the phase-residual
    /// correction, or unchanged when any gate fails.
    pub fn refine(
        &mut self,
        buffer: &[f32],
        sample_rate: f32,
        estimate: PitchEstimate,
    ) -> PitchEstimate {
        let refined = self.refined_frequency(buffer, sample_rate, estimate);
        PitchEstimate {
            frequency: refined,
            ..estimate
        }
    }

    fn refined_frequency(
        &mut self,
        buffer: &[f32],
        sample_rate: f32,
        estimate: PitchEstimate,
    ) -> f32 {
        let frequency = estimate.frequency;
        if buffer.len() < MIN_BUFFER_SAMPLES
            || !sample_rate.is_finite()
            || sample_rate <= 0.0
            || !frequency.is_finite()
            || frequency <= 0.0
            || estimate.confidence < MIN_CONFIDENCE
        {
            return frequency;
        }

        // A quarter-window shift: large enough for a sensitive phase slope,
        // small enough that a decaying string keeps its amplitude across
        // both windows and the unambiguous correction range (sr/(2D) Hz)
        // stays well above the clamp.
        let shift = buffer.len() / 4;
        let length = buffer.len() - shift;
        let first = &buffer[..length];
        let second = &buffer[shift..];
        debug_assert_eq!(first.len(), second.len());

        // Stationarity gate: during attack or fast decay the amplitude (and
        // on real strings, the spectrum) changes between the two windows,
        // and the phase advance stops measuring pure frequency. Real-corpus
        // captures showed exactly those frames being pushed a few cents off,
        // so only refine frames whose loudness is steady.
        let rms_first = rms(first);
        let rms_second = rms(second);
        let louder = rms_first.max(rms_second);
        if louder <= 0.0 || (rms_first - rms_second).abs() > MAX_RMS_DEVIATION * louder {
            return frequency;
        }

        // Probe the fundamental and the next two harmonics and average their
        // phase-slope corrections weighted by squared magnitude. One hard
        // gate keeps the average honest: the fundamental must be the
        // strongest partial. On strings whose second or third harmonic
        // dominates (common on low guitar and bass notes) inharmonicity
        // stretches those partials sharp of the true period, and their phase
        // slopes pulled the estimate systematically off by about a cent on
        // the real corpus — those frames keep the time-domain estimate
        // untouched. Squared weights then anchor the correction to the
        // dominant coherent partial.
        let mut probes: [(f64, f64, f64, f64); MAX_HARMONIC as usize] =
            [(0.0, 0.0, 0.0, 0.0); MAX_HARMONIC as usize];
        let mut magnitudes = [0.0_f64; MAX_HARMONIC as usize];
        for (harmonic, (probe_out, magnitude_out)) in
            probes.iter_mut().zip(magnitudes.iter_mut()).enumerate()
        {
            let harmonic = harmonic as u32 + 1;
            let probe = frequency * harmonic as f32;
            if probe >= sample_rate * MAX_PROBE_NYQUIST_FRACTION {
                break;
            }
            let (re_a, im_a) = spectral::windowed_probe(first, sample_rate, probe);
            let (re_b, im_b) = spectral::windowed_probe(second, sample_rate, probe);
            *probe_out = (re_a, im_a, re_b, im_b);
            *magnitude_out = re_a.hypot(im_a);
        }
        if magnitudes[0] <= 0.0
            || magnitudes[1..]
                .iter()
                .any(|magnitude| *magnitude > magnitudes[0])
        {
            return frequency;
        }

        let mut weighted_correction = 0.0_f64;
        let mut total_weight = 0.0_f64;
        for (harmonic, ((re_a, im_a, re_b, im_b), magnitude)) in
            probes.iter().zip(magnitudes.iter()).enumerate()
        {
            let harmonic = harmonic as u32 + 1;
            if *magnitude <= 0.0 {
                continue;
            }
            // phase(z_b * conj(z_a)) minus the advance the current estimate
            // predicts, wrapped to +-pi.
            let measured = (im_b * re_a - re_b * im_a).atan2(re_b * re_a + im_b * im_a);
            let expected =
                std::f64::consts::TAU * f64::from(frequency * harmonic as f32) * shift as f64
                    / f64::from(sample_rate);
            let residual = wrap_phase(measured - expected);
            let correction = residual * f64::from(sample_rate)
                / (std::f64::consts::TAU * shift as f64 * harmonic as f64);
            let weight = magnitude * magnitude;
            weighted_correction += correction * weight;
            total_weight += weight;
        }
        if total_weight <= 0.0 {
            return frequency;
        }
        let correction = (weighted_correction / total_weight) as f32;
        let clamp = frequency * (2.0_f32.powf(MAX_CORRECTION_CENTS / 1_200.0) - 1.0);
        frequency + correction.clamp(-clamp, clamp)
    }
}

fn rms(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }
    (samples.iter().map(|sample| sample * sample).sum::<f32>() / samples.len() as f32).sqrt()
}

fn wrap_phase(phase: f64) -> f64 {
    (phase + std::f64::consts::PI).rem_euclid(std::f64::consts::TAU) - std::f64::consts::PI
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tone(frequency: f32, sample_rate: f32, samples: usize) -> Vec<f32> {
        (0..samples)
            .map(|index| {
                let t = index as f32 / sample_rate;
                0.3 * (std::f32::consts::TAU * frequency * t).sin()
                    + 0.15 * (std::f32::consts::TAU * 2.0 * frequency * t).sin()
            })
            .collect()
    }

    #[test]
    fn exact_estimate_is_unchanged() {
        let sample_rate = 48_000.0;
        let buffer = tone(440.0, sample_rate, 8_192);
        let mut refiner = PhaseRefiner::new();
        let estimate = PitchEstimate {
            confidence: 0.95,
            frequency: 440.0,
        };
        let refined = refiner.refine(&buffer, sample_rate, estimate);
        let cents = 1_200.0 * (refined.frequency / 440.0).log2().abs();
        assert!(
            cents < 0.5,
            "exact estimate must stay put, moved {cents} cents"
        );
    }

    #[test]
    fn biased_estimate_is_pulled_toward_the_true_frequency() {
        let sample_rate = 48_000.0;
        let buffer = tone(1_318.5, sample_rate, 8_192);
        let mut refiner = PhaseRefiner::new();
        let estimate = PitchEstimate {
            confidence: 0.95,
            frequency: 1_318.5 * 2.0_f32.powf(3.0 / 1_200.0), // +3 cents
        };
        let refined = refiner.refine(&buffer, sample_rate, estimate);
        let before = 1_200.0 * (estimate.frequency / 1_318.5).log2().abs();
        let after = 1_200.0 * (refined.frequency / 1_318.5).log2().abs();
        assert!(
            after < before * 0.5,
            "refinement must at least halve the bias: {before} -> {after} cents"
        );
    }

    #[test]
    fn low_confidence_frames_are_not_touched() {
        let sample_rate = 48_000.0;
        let buffer = tone(440.0, sample_rate, 8_192);
        let mut refiner = PhaseRefiner::new();
        let estimate = PitchEstimate {
            confidence: 0.5,
            frequency: 441.0,
        };
        let refined = refiner.refine(&buffer, sample_rate, estimate);
        assert_eq!(refined.frequency, 441.0);
    }
}
