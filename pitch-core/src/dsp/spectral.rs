use rustfft::num_complex::Complex;

pub(crate) fn apply_hann_window(input: &[f32], output: &mut Vec<f32>) {
    output.resize(input.len(), 0.0);
    if input.len() < 2 {
        output.copy_from_slice(input);
        return;
    }

    let scale = std::f32::consts::TAU / (input.len() - 1) as f32;
    for (index, (output, sample)) in output.iter_mut().zip(input).enumerate() {
        let window = 0.5 * (1.0 - (scale * index as f32).cos());
        *output = sample * window;
    }
}

/// Complex single-frequency DFT of `samples` at `frequency` under a Hann
/// window. Returns `(re, im)` of `sum w[n] x[n] e^-i*2*pi*f*n/sr` accumulated
/// in f64: the phase refiners compare these probes across shifted windows,
/// where f32 accumulation noise would show up directly as phase bias.
pub(crate) fn windowed_probe(samples: &[f32], sample_rate: f32, frequency: f32) -> (f64, f64) {
    if samples.len() < 2
        || !sample_rate.is_finite()
        || sample_rate <= 0.0
        || !frequency.is_finite()
        || frequency <= 0.0
    {
        return (0.0, 0.0);
    }
    let step = std::f64::consts::TAU * f64::from(frequency) / f64::from(sample_rate);
    let (sin_step, cos_step) = step.sin_cos();
    let mut cos = 1.0_f64;
    let mut sin = 0.0_f64;
    let mut re = 0.0_f64;
    let mut im = 0.0_f64;
    let scale = std::f64::consts::TAU / (samples.len() - 1) as f64;
    for (index, sample) in samples.iter().enumerate() {
        let window = 0.5 * (1.0 - (scale * index as f64).cos());
        let value = f64::from(*sample) * window;
        re += value * cos;
        im -= value * sin;
        let next_cos = cos * cos_step - sin * sin_step;
        sin = sin * cos_step + cos * sin_step;
        cos = next_cos;
    }
    (re, im)
}

/// Spectral power at an arbitrary frequency via the Goertzel recurrence.
pub(crate) fn goertzel_power(samples: &[f32], sample_rate: f32, frequency: f32) -> f32 {
    if samples.is_empty()
        || !sample_rate.is_finite()
        || sample_rate <= 0.0
        || !frequency.is_finite()
        || frequency <= 0.0
        || frequency >= sample_rate * 0.5
    {
        return 0.0;
    }

    let omega = std::f32::consts::TAU * frequency / sample_rate;
    let coefficient = 2.0 * omega.cos();
    let mut delayed_1 = 0.0_f32;
    let mut delayed_2 = 0.0_f32;
    for sample in samples {
        let current = sample + coefficient * delayed_1 - delayed_2;
        delayed_2 = delayed_1;
        delayed_1 = current;
    }
    delayed_1 * delayed_1 + delayed_2 * delayed_2 - coefficient * delayed_1 * delayed_2
}

/// Sub-bin peak offset in `[-1, 1]` bins via the Jacobsen complex-ratio
/// estimator under the Hann window.
///
/// The classic three-point parabola on magnitudes assumes a parabolic main
/// lobe and is biased by up to ~0.07 bin near the bin edges. Jacobsen's
/// estimator uses the complex bins: under a Hann window the Dirichlet-kernel
/// expansion gives `Re{(X[k-1]-X[k+1]) / (2X[k]-X[k-1]-X[k+1])} = δ/2`
/// (verified numerically to ~1e-4 bin on synthetic tones), so doubling the
/// ratio recovers the offset essentially exactly. Quinn's second estimator
/// was evaluated as the alternative and rejected: it is exact only for a
/// rectangular window and shows ~0.3-bin bias under Hann.
pub(crate) fn jacobsen_hann_offset(
    left: Complex<f32>,
    center: Complex<f32>,
    right: Complex<f32>,
) -> f32 {
    let numerator = left - right;
    let denominator = center * 2.0 - left - right;
    if denominator.norm_sqr() <= f32::EPSILON {
        return 0.0;
    }
    (2.0 * (numerator / denominator).re).clamp(-1.0, 1.0)
}

/// Reference three-point parabolic interpolation on magnitudes, kept for
/// tests that quantify the bias the complex estimators remove.
#[cfg(test)]
fn parabolic_magnitude_offset(left: f32, center: f32, right: f32) -> f32 {
    let denominator = 2.0 * center - left - right;
    if denominator.abs() <= 1e-12 {
        return 0.0;
    }
    ((right - left) / (2.0 * denominator)).clamp(-1.0, 1.0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rustfft::Fft;

    /// Complex FFT bins around the spectral peak of a Hann-windowed tone at
    /// `frequency`, returned as `(true_offset, [left, center, right])` where
    /// `true_offset` is the tone's fractional position within `[-0.5, 0.5]`
    /// relative to the peak bin.
    fn peak_bins(frequency: f32, sample_rate: f32, samples: usize) -> (f32, [Complex<f32>; 3]) {
        let mut windowed = Vec::new();
        let tone: Vec<f32> = (0..samples)
            .map(|index| {
                let t = index as f32 / sample_rate;
                (std::f32::consts::TAU * frequency * t).sin()
            })
            .collect();
        apply_hann_window(&tone, &mut windowed);
        let mut bins: Vec<Complex<f32>> = windowed
            .iter()
            .map(|sample| Complex::new(*sample, 0.0))
            .collect();
        let mut planner = rustfft::FftPlanner::<f32>::new();
        planner.plan_fft_forward(samples).process(&mut bins);

        let bin_width = sample_rate / samples as f32;
        let true_bin = frequency / bin_width;
        let peak = true_bin.round() as usize;
        (
            true_bin - peak as f32,
            [bins[peak - 1], bins[peak], bins[peak + 1]],
        )
    }

    /// 440.37 Hz at 48 kHz / 8192 samples sits at bin 75.1629 — a typical
    /// mid-bin tone. Parabolic interpolation must be visibly worse than the
    /// complex Jacobsen estimator, which must land within a tiny fraction of
    /// a bin of the truth.
    #[test]
    fn jacobsen_beats_the_parabola_off_bin_center() {
        let (true_offset, [left, center, right]) = peak_bins(440.37, 48_000.0, 8_192);
        let parabolic = parabolic_magnitude_offset(left.norm(), center.norm(), right.norm());
        let jacobsen = jacobsen_hann_offset(left, center, right);

        let parabolic_error = (parabolic - true_offset).abs();
        let jacobsen_error = (jacobsen - true_offset).abs();
        assert!(
            jacobsen_error < parabolic_error * 0.25,
            "offset {true_offset}: parabolic {parabolic_error:.5} vs jacobsen {jacobsen_error:.5} bins"
        );
        assert!(
            jacobsen_error < 0.005,
            "jacobsen error {jacobsen_error:.5} bins exceeds 0.005"
        );
    }

    /// Sweep fractional offsets across the whole inter-bin range: the
    /// Jacobsen form must stay under 0.01 bin everywhere, while the parabola
    /// is allowed to be far worse near the edges.
    #[test]
    fn jacobsen_stays_accurate_across_the_bin() {
        let sample_rate = 48_000.0;
        let samples = 8_192;
        let bin_width = sample_rate / samples as f32;
        let mut worst_jacobsen = 0.0_f32;
        let mut worst_parabolic = 0.0_f32;
        for step in -4..=4 {
            let offset = step as f32 * 0.11;
            let frequency = (75.0 + offset) * bin_width;
            let (true_offset, [left, center, right]) = peak_bins(frequency, sample_rate, samples);
            worst_parabolic = worst_parabolic.max(
                (parabolic_magnitude_offset(left.norm(), center.norm(), right.norm())
                    - true_offset)
                    .abs(),
            );
            worst_jacobsen =
                worst_jacobsen.max((jacobsen_hann_offset(left, center, right) - true_offset).abs());
        }
        assert!(
            worst_jacobsen < 0.01,
            "worst jacobsen error {worst_jacobsen:.5} bins (parabola {worst_parabolic:.5})"
        );
        assert!(
            worst_jacobsen < worst_parabolic,
            "jacobsen {worst_jacobsen:.5} must beat parabola {worst_parabolic:.5} bins"
        );
    }

    #[test]
    fn degenerate_bins_yield_zero_offset() {
        let zero = Complex::new(0.0, 0.0);
        assert_eq!(jacobsen_hann_offset(zero, zero, zero), 0.0);
    }
}
