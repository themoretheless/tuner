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
    for i in 0..out_len {
        out[i] = buffer[i * factor];
    }
    out
}
