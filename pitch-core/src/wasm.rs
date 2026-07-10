use crate::{
    compute_rms_volume, detect_pitch, downsample_for_pitch, is_likely_power_chord_native,
    normalize_level, MpmDetector, PitchDetector, Smoother, YinDetector,
};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct PitchDetection {
    pub confidence: f32,
    pub freq: f32,
}

#[wasm_bindgen]
impl PitchDetection {
    #[wasm_bindgen(constructor)]
    pub fn new(freq: f32, confidence: f32) -> Self {
        Self { confidence, freq }
    }
}

#[wasm_bindgen]
pub fn detect_pitch_yin(buffer: &[f32], sample_rate: f32) -> Option<PitchDetection> {
    let mut detector = YinDetector::default();
    detector
        .detect(buffer, sample_rate)
        .map(|estimate| PitchDetection::new(estimate.frequency, estimate.confidence))
}

#[wasm_bindgen]
pub fn detect_pitch_mpm(buffer: &[f32], sample_rate: f32) -> Option<PitchDetection> {
    let mut detector = MpmDetector::default();
    detector
        .detect(buffer, sample_rate)
        .map(|estimate| PitchDetection::new(estimate.frequency, estimate.confidence))
}

#[wasm_bindgen]
pub fn detect_pitch_wasm(buffer: &[f32], sample_rate: f32) -> Option<PitchDetection> {
    detect_pitch(buffer, sample_rate)
        .map(|(frequency, confidence)| PitchDetection::new(frequency, confidence))
}

#[wasm_bindgen]
pub fn is_likely_power_chord(buffer: &[f32], sample_rate: f32, fundamental: f32) -> bool {
    is_likely_power_chord_native(buffer, sample_rate, fundamental)
}

#[wasm_bindgen(js_name = compute_rms_volume)]
pub fn compute_rms_volume_wasm(buffer: &[f32]) -> f32 {
    compute_rms_volume(buffer)
}

#[wasm_bindgen(js_name = normalize_level)]
pub fn normalize_level_wasm(rms: f32) -> f32 {
    normalize_level(rms)
}

#[wasm_bindgen(js_name = downsample_for_pitch)]
pub fn downsample_for_pitch_wasm(buffer: &[f32], factor: usize) -> Vec<f32> {
    downsample_for_pitch(buffer, factor)
}

#[wasm_bindgen]
pub struct WasmSmoother {
    inner: Smoother,
}

#[wasm_bindgen]
impl WasmSmoother {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: Smoother::new(),
        }
    }

    pub fn add(&mut self, frequency: Option<f32>) -> Option<f32> {
        self.inner.add(frequency)
    }

    pub fn reset(&mut self) {
        self.inner.reset();
    }
}

impl Default for WasmSmoother {
    fn default() -> Self {
        Self::new()
    }
}
