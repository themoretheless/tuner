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
