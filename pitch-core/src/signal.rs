#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;

fn compute_rms_volume_impl(buffer: &[f32]) -> f32 {
    if buffer.is_empty() || buffer.iter().any(|sample| !sample.is_finite()) {
        return 0.0;
    }
    let mut sum = 0.0;
    for &v in buffer {
        sum += v * v;
    }
    (sum / buffer.len() as f32).sqrt()
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn compute_rms_volume(buffer: &[f32]) -> f32 {
    compute_rms_volume_impl(buffer)
}

#[cfg(not(feature = "wasm"))]
pub fn compute_rms_volume(buffer: &[f32]) -> f32 {
    compute_rms_volume_impl(buffer)
}

pub(crate) fn normalize_level_impl(rms: f32) -> f32 {
    // Typical mic guitar signal after gate is ~0.01-0.2 rms.
    if !rms.is_finite() {
        return 0.0;
    }
    (rms * 18.0).clamp(0.0, 1.0)
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn normalize_level(rms: f32) -> f32 {
    normalize_level_impl(rms)
}

#[cfg(not(feature = "wasm"))]
pub fn normalize_level(rms: f32) -> f32 {
    normalize_level_impl(rms)
}

fn downsample_for_pitch_impl(buffer: &[f32], factor: usize) -> Vec<f32> {
    if factor <= 1 {
        return buffer.to_vec();
    }

    // Average each decimation block before retaining a sample. This boxcar
    // low-pass is intentionally small and allocation-free beyond the output,
    // but unlike point sampling it suppresses content above the new Nyquist
    // frequency instead of folding it into the pitch band.
    buffer
        .chunks_exact(factor)
        .map(|chunk| chunk.iter().sum::<f32>() / factor as f32)
        .collect()
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn downsample_for_pitch(buffer: &[f32], factor: usize) -> Vec<f32> {
    downsample_for_pitch_impl(buffer, factor)
}

#[cfg(not(feature = "wasm"))]
pub fn downsample_for_pitch(buffer: &[f32], factor: usize) -> Vec<f32> {
    downsample_for_pitch_impl(buffer, factor)
}
