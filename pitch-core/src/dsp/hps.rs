//! Harmonic product spectrum (HPS) cross-check for octave decisions.
//!
//! The time-domain detectors (YIN/MPM) cannot tell a fundamental from its
//! double or half on their own. The existing Goertzel-based octave fold
//! probes a handful of frequencies; HPS complements it with a full-spectrum
//! vote: the magnitude spectrum is compressed by factors 1, 2 and 3 and the
//! three copies are multiplied bin-by-bin, so the true fundamental — the one
//! frequency whose harmonics all land on top of each other — dominates the
//! product. When the time-domain estimate disagrees with the HPS peak by
//! ~2x or ~0.5x and the HPS peak clearly dominates the estimate's position,
//! the guard votes for the HPS-supported octave.
//!
//! The guard is deliberately conservative: frames with very high confidence
//! (clean, unambiguous periodicity) are never flipped, and lower-confidence
//! frames need a clearly dominant HPS peak. The vote feeds the same
//! consecutive-frame confirmation machinery as the Goertzel fold, so a
//! single borderline frame cannot yank the readout an octave.
//!
//! Cost: one FFT of the analysis window (plus O(N) products) per frame that
//! reaches the guard; frames whose confidence clears
//! [`HPS_SKIP_CONFIDENCE`] skip the FFT entirely.

use rustfft::{num_complex::Complex, Fft};
use std::sync::Arc;

/// Number of spectral compression stages in the product (spectrum, half-rate,
/// third-rate). Two stages leave too many spurious peaks; four attenuate the
/// fundamental of darker instruments whose fourth harmonic is weak.
const HPS_STAGES: usize = 3;

/// Octave agreement tolerance between the HPS peak and the estimate's
/// double/half. 60 cents absorbs the HPS peak's bin quantization and
/// parabolic interpolation error without admitting non-octave relationships
/// (the nearest non-octave ratio, 3x, is 1902 cents away).
const OCTAVE_MATCH_CENTS: f32 = 60.0;

/// Frames at or above this confidence never run the guard: their periodicity
/// is clean enough that the time-domain estimate is trusted outright, and
/// skipping the FFT keeps the steady-state cost of the feature at zero for
/// the signals a tuner actually locks onto.
const HPS_SKIP_CONFIDENCE: f32 = 0.97;

/// Below [`HPS_SKIP_CONFIDENCE`] the guard engages, but the required HPS
/// dominance grows with confidence: a fairly confident frame needs
/// overwhelming spectral evidence to be flipped.
const LOW_CONFIDENCE_DOMINANCE: f32 = 1.8;
const HIGH_CONFIDENCE_DOMINANCE: f32 = 3.0;
const DOMINANCE_CONFIDENCE_SPLIT: f32 = 0.90;

/// Skip HPS bins above this fraction of the sample rate; magnitudes near
/// Nyquist are attenuated by the band-pass preprocessing anyway.
const MAX_PROBE_NYQUIST_FRACTION: f32 = 0.45;

const MIN_FFT_SAMPLES: usize = 256;

/// Which octave the spectrum supports relative to the time-domain estimate.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum HpsVerdict {
    /// HPS peak sits at ~2x the estimate and dominates the estimate's bin.
    Double,
    /// HPS peak sits at ~0.5x the estimate and dominates the estimate's bin.
    Half,
    /// No usable spectrum, no dominant peak, or the peak agrees with the
    /// estimate (or with neither octave).
    Neutral,
}

/// Stateful HPS measurer: caches the FFT plan and scratch buffers across
/// frames so per-frame use does not allocate after warm-up.
pub(crate) struct HpsGuard {
    fft: Option<Arc<dyn Fft<f32>>>,
    fft_size: usize,
    input: Vec<Complex<f32>>,
    magnitudes: Vec<f32>,
    hps: Vec<f32>,
}

impl HpsGuard {
    pub(crate) fn new() -> Self {
        Self {
            fft: None,
            fft_size: 0,
            input: Vec::new(),
            magnitudes: Vec::new(),
            hps: Vec::new(),
        }
    }

    /// The octave the frame's harmonic product spectrum supports relative to
    /// `frequency`, or [`HpsVerdict::Neutral`]. `confidence` is the
    /// time-domain estimate's own score and gates both whether the guard runs
    /// at all and how dominant the HPS peak must be.
    pub(crate) fn verdict(
        &mut self,
        buffer: &[f32],
        sample_rate: f32,
        frequency: f32,
        confidence: f32,
        min_frequency: f32,
        max_frequency: f32,
    ) -> HpsVerdict {
        if buffer.len() < MIN_FFT_SAMPLES
            || !sample_rate.is_finite()
            || sample_rate <= 0.0
            || !frequency.is_finite()
            || frequency <= 0.0
            || !confidence.is_finite()
            || confidence >= HPS_SKIP_CONFIDENCE
        {
            return HpsVerdict::Neutral;
        }
        if !self.measure(buffer) {
            return HpsVerdict::Neutral;
        }

        let bin_width = sample_rate / self.fft_size as f32;
        let probe_limit = sample_rate * MAX_PROBE_NYQUIST_FRACTION;
        let lower_bin = ((min_frequency.max(bin_width * 2.0)) / bin_width) as usize;
        let upper_bin = ((max_frequency.min(probe_limit) / bin_width) as usize).min(self.hps.len());
        if lower_bin + 2 >= upper_bin {
            return HpsVerdict::Neutral;
        }

        let Some((peak_bin, peak_value)) = self.hps[lower_bin..upper_bin]
            .iter()
            .enumerate()
            .max_by(|(_, left), (_, right)| left.total_cmp(right))
            .map(|(index, value)| (index + lower_bin, *value))
        else {
            return HpsVerdict::Neutral;
        };
        if peak_value <= 1e-9 || peak_bin == 0 || peak_bin + 1 >= self.hps.len() {
            return HpsVerdict::Neutral;
        }

        // Parabolic interpolation on the product curve for a sub-bin peak
        // frequency; the OCTAVE_MATCH_CENTS tolerance is wide enough that
        // the residual interpolation error does not matter.
        let left = self.hps[peak_bin - 1];
        let center = self.hps[peak_bin];
        let right = self.hps[peak_bin + 1];
        let denominator = 2.0 * center - left - right;
        let offset = if denominator.abs() > 1e-12 {
            ((right - left) / (2.0 * denominator)).clamp(-1.0, 1.0)
        } else {
            0.0
        };
        let peak_frequency = (peak_bin as f32 + offset) * bin_width;

        let dominance = if confidence >= DOMINANCE_CONFIDENCE_SPLIT {
            HIGH_CONFIDENCE_DOMINANCE
        } else {
            LOW_CONFIDENCE_DOMINANCE
        };
        let estimate_support = self.value_at(frequency / bin_width).max(1e-9);
        if peak_value < dominance * estimate_support {
            return HpsVerdict::Neutral;
        }

        if frequency * 2.0 <= max_frequency
            && cents_distance(peak_frequency, frequency * 2.0) <= OCTAVE_MATCH_CENTS
        {
            return HpsVerdict::Double;
        }
        if frequency * 0.5 >= min_frequency
            && cents_distance(peak_frequency, frequency * 0.5) <= OCTAVE_MATCH_CENTS
        {
            return HpsVerdict::Half;
        }
        HpsVerdict::Neutral
    }

    /// Linearly interpolated HPS product value at a fractional bin.
    fn value_at(&self, bin: f32) -> f32 {
        if self.hps.is_empty() || bin < 0.0 {
            return 0.0;
        }
        let lower = bin.floor() as usize;
        if lower + 1 >= self.hps.len() {
            return 0.0;
        }
        let fraction = bin - lower as f32;
        self.hps[lower] * (1.0 - fraction) + self.hps[lower + 1] * fraction
    }

    /// Recomputes the Hann-windowed magnitude spectrum and the 3-stage
    /// harmonic product, normalized so the largest product value is 1.
    /// Returns false when the frame is unusable.
    fn measure(&mut self, buffer: &[f32]) -> bool {
        let size = buffer.len();
        if size != self.fft_size {
            let mut planner = rustfft::FftPlanner::<f32>::new();
            self.fft = Some(planner.plan_fft_forward(size));
            self.fft_size = size;
        }
        let Some(fft) = self.fft.clone() else {
            return false;
        };

        self.input.resize(size, Complex::new(0.0, 0.0));
        let scale = std::f32::consts::TAU / (size - 1) as f32;
        for (index, (input, sample)) in self.input.iter_mut().zip(buffer).enumerate() {
            let window = 0.5 * (1.0 - (scale * index as f32).cos());
            *input = Complex::new(sample * window, 0.0);
        }
        fft.process(&mut self.input);

        let half = size / 2;
        self.magnitudes.resize(half, 0.0);
        for (magnitude, bin) in self.magnitudes.iter_mut().zip(&self.input[..half]) {
            *magnitude = bin.norm();
        }

        let usable_half = ((MAX_PROBE_NYQUIST_FRACTION * size as f32) as usize).min(half);
        let hps_len = usable_half / HPS_STAGES;
        if hps_len < 4 {
            return false;
        }
        self.hps.resize(hps_len, 0.0);
        let mut maximum = 0.0_f32;
        for index in 0..hps_len {
            let mut product = self.magnitudes[index];
            for stage in 2..=HPS_STAGES {
                product *= self.magnitudes[index * stage];
            }
            self.hps[index] = product;
            maximum = maximum.max(product);
        }
        if maximum <= 1e-12 || !maximum.is_finite() {
            return false;
        }
        for value in &mut self.hps {
            *value /= maximum;
        }
        true
    }
}

fn cents_distance(left: f32, right: f32) -> f32 {
    (1_200.0 * (left / right).log2()).abs()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn harmonic_signal(fundamental: f32, sample_rate: f32, samples: usize) -> Vec<f32> {
        (0..samples)
            .map(|index| {
                let t = index as f32 / sample_rate;
                let mut value = 0.4 * (std::f32::consts::TAU * fundamental * t).sin();
                value += 0.2 * (std::f32::consts::TAU * 2.0 * fundamental * t).sin();
                value += 0.1 * (std::f32::consts::TAU * 3.0 * fundamental * t).sin();
                value
            })
            .collect()
    }

    #[test]
    fn hps_votes_for_the_suboctave_when_estimate_doubled_the_fundamental() {
        let sample_rate = 48_000.0;
        let buffer = harmonic_signal(110.0, sample_rate, 8_192);
        let mut guard = HpsGuard::new();

        // The time-domain detector locked onto 2f0 (220 Hz) with middling
        // confidence; HPS must point back at 110 Hz.
        let verdict = guard.verdict(&buffer, sample_rate, 220.0, 0.85, 30.0, 1_400.0);
        assert_eq!(verdict, HpsVerdict::Half);
    }

    #[test]
    fn hps_votes_for_the_double_when_estimate_halved_the_fundamental() {
        let sample_rate = 48_000.0;
        let buffer = harmonic_signal(220.0, sample_rate, 8_192);
        let mut guard = HpsGuard::new();

        let verdict = guard.verdict(&buffer, sample_rate, 110.0, 0.85, 30.0, 1_400.0);
        assert_eq!(verdict, HpsVerdict::Double);
    }

    #[test]
    fn clean_high_confidence_frames_are_never_flipped() {
        let sample_rate = 48_000.0;
        let buffer = harmonic_signal(110.0, sample_rate, 8_192);
        let mut guard = HpsGuard::new();

        // Same octave-up disagreement as above, but a very confident frame
        // must not be touched.
        let verdict = guard.verdict(&buffer, sample_rate, 220.0, 0.99, 30.0, 1_400.0);
        assert_eq!(verdict, HpsVerdict::Neutral);
    }

    #[test]
    fn agreeing_estimate_stays_neutral() {
        let sample_rate = 48_000.0;
        let buffer = harmonic_signal(110.0, sample_rate, 8_192);
        let mut guard = HpsGuard::new();

        let verdict = guard.verdict(&buffer, sample_rate, 110.0, 0.85, 30.0, 1_400.0);
        assert_eq!(verdict, HpsVerdict::Neutral);
    }
}
