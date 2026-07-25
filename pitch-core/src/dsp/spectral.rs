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
