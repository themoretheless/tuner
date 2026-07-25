pub fn compute_rms_volume(buffer: &[f32]) -> f32 {
    if buffer.is_empty() {
        return 0.0;
    }
    let mut sum = 0.0;
    for &v in buffer {
        sum += v * v;
    }
    (sum / buffer.len() as f32).sqrt()
}

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub(crate) struct SignalStats {
    pub(crate) peak: f32,
    pub(crate) rms: f32,
}

/// Signal level after removing DC. Pitch detectors center their input too;
/// using the same energy model keeps microphone bias from opening the
/// adaptive user-visible gate.
pub(crate) fn compute_centered_signal_stats(buffer: &[f32]) -> SignalStats {
    if buffer.is_empty() {
        return SignalStats::default();
    }
    let mean = buffer.iter().sum::<f32>() / buffer.len() as f32;
    let mut sum_sq = 0.0;
    let mut peak = 0.0_f32;
    for sample in buffer {
        let centered = *sample - mean;
        sum_sq += centered * centered;
        peak = peak.max(centered.abs());
    }
    SignalStats {
        peak,
        rms: (sum_sq / buffer.len() as f32).sqrt(),
    }
}

pub fn normalize_level(rms: f32) -> f32 {
    // Typical mic guitar signal after gate is ~0.01-0.2 rms.
    rms.min(1.0) * 18.0
}

pub fn downsample_for_pitch(buffer: &[f32], factor: usize) -> Vec<f32> {
    if factor <= 1 {
        return buffer.to_vec();
    }
    let out_len = buffer.len() / factor;
    let mut out = vec![0.0; out_len];
    // Anti-aliasing: decimating by `factor` folds everything above
    // `0.5 * sample_rate / factor` back into the band. A two-pole
    // Butterworth low-pass at 0.45 of the *output* rate (0.45 / factor
    // relative to the input rate) removes most of that energy before
    // the decimation picks every `factor`-th sample. The design only
    // needs the normalized ratio, so no absolute sample rate is required.
    let cutoff = 0.45 / factor as f32;
    let mut anti_alias =
        crate::BiquadCoefficients::low_pass(1.0, cutoff, std::f32::consts::FRAC_1_SQRT_2)
            .map(crate::Biquad::new);
    let mut written = 0;
    for (index, &sample) in buffer.iter().enumerate() {
        let filtered = match &mut anti_alias {
            Some(filter) => filter.process(sample),
            None => sample,
        };
        if index % factor == 0 && written < out_len {
            out[written] = filtered;
            written += 1;
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f32::consts::TAU;

    fn goertzel_amplitude(buffer: &[f32], sample_rate: f32, frequency: f32) -> f32 {
        let omega = TAU * frequency / sample_rate;
        let coefficient = 2.0 * omega.cos();
        let (mut s1, mut s2) = (0.0_f32, 0.0_f32);
        for &sample in buffer {
            let s0 = sample + coefficient * s1 - s2;
            s2 = s1;
            s1 = s0;
        }
        let power = s1 * s1 + s2 * s2 - coefficient * s1 * s2;
        2.0 * power.max(0.0).sqrt() / buffer.len() as f32
    }

    #[test]
    fn factor_one_and_below_passes_samples_through() {
        let buffer = vec![0.1, -0.2, 0.3];
        assert_eq!(downsample_for_pitch(&buffer, 0), buffer);
        assert_eq!(downsample_for_pitch(&buffer, 1), buffer);
    }

    #[test]
    fn anti_aliasing_keeps_out_of_band_tone_from_folding_down() {
        let sample_rate = 48_000.0;
        let factor = 4;
        let output_rate = sample_rate / factor as f32; // 12 kHz, Nyquist 6 kHz.
                                                       // 15 kHz is above the output Nyquist; naive decimation folds it
                                                       // to |15 kHz - 12 kHz| = 3 kHz as a false in-band tone.
        let buffer: Vec<f32> = (0..19_200)
            .map(|index| {
                let t = index as f32 / sample_rate;
                (TAU * 1_000.0 * t).sin() + (TAU * 15_000.0 * t).sin()
            })
            .collect();

        let naive: Vec<f32> = buffer.iter().step_by(factor).copied().collect();
        let naive_folded = goertzel_amplitude(&naive, output_rate, 3_000.0);
        let naive_wanted = goertzel_amplitude(&naive, output_rate, 1_000.0);
        assert!(
            naive_folded > naive_wanted * 0.8,
            "sanity: naive decimation must alias 15 kHz to 3 kHz ({naive_folded} vs {naive_wanted})"
        );

        let filtered = downsample_for_pitch(&buffer, factor);
        assert_eq!(filtered.len(), naive.len());
        let folded = goertzel_amplitude(&filtered, output_rate, 3_000.0);
        let wanted = goertzel_amplitude(&filtered, output_rate, 1_000.0);
        assert!(
            folded < wanted * 0.25,
            "anti-aliased output must not contain the folded 3 kHz image ({folded} vs {wanted})"
        );
        assert!(
            wanted > naive_wanted * 0.8,
            "in-band 1 kHz tone must survive ({naive_wanted} -> {wanted})"
        );
    }
}
