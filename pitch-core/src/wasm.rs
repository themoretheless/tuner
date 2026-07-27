mod frame;
mod processor;

pub use frame::WasmDetectionFrame;
pub use processor::WasmTunerProcessor;

use crate::{
    compute_rms_volume, detect_pitch, downsample_for_pitch, gate, is_likely_power_chord_native,
    normalize_level, DetectorConfig, HybridPitchDetector, MpmDetector, PitchDetector, Smoother,
    YinDetector, DEFAULT_YIN_THRESHOLD, MIN_USABLE_CONFIDENCE,
};
use wasm_bindgen::prelude::*;

/// Canonical silence/gate thresholds of the pitch-core pipeline.
///
/// Single source of truth for every host layer: the web fallback mirrors
/// these values through `web/src/generated/gateThresholds.ts` (kept in
/// lockstep by `scripts/generate-gate-thresholds.mjs --check`), and hosts
/// with the WASM module loaded can read them at runtime instead of
/// hard-coding their own numbers.
#[wasm_bindgen]
pub struct CoreGateThresholds {
    pub rms_gate: f32,
    pub peak_gate: f32,
    pub min_usable_confidence: f32,
    pub yin_threshold: f32,
    pub adaptive_calibration_frames: u8,
    pub adaptive_close_confirm_frames: u8,
    pub adaptive_open_noise_ratio: f32,
    pub adaptive_close_noise_ratio: f32,
    pub adaptive_open_base_rms_factor: f32,
    pub adaptive_close_base_rms_factor: f32,
    pub adaptive_close_peak_factor: f32,
    pub adaptive_strong_attack_rms: f32,
    pub adaptive_strong_attack_peak: f32,
    pub adaptive_onset_ratio: f32,
    pub adaptive_onset_rms_delta: f32,
    pub adaptive_universal_confidence: f32,
    pub adaptive_target_confidence: f32,
    pub adaptive_target_distance_cents: f32,
    pub adaptive_noise_floor_decay: f32,
    pub adaptive_noise_floor_update_weight: f32,
    pub adaptive_noise_floor_cap_factor: f32,
}

/// Canonical analysis window lanes (ascending sample counts) every shipped
/// host runs. Single source of truth:
/// [`crate::STANDARD_ANALYSIS_WINDOWS`]; the TypeScript fallback mirrors the
/// same value through `web/src/generated/analysisWindows.ts` (kept in
/// lockstep by `scripts/generate-analysis-windows.mjs --check`), and hosts
/// with the WASM module loaded can read it here at runtime instead of
/// hard-coding their own lane list.
#[wasm_bindgen(js_name = standardAnalysisWindows)]
pub fn standard_analysis_windows() -> Vec<u32> {
    crate::STANDARD_ANALYSIS_WINDOWS
        .iter()
        .map(|&window| window as u32)
        .collect()
}

#[wasm_bindgen(js_name = coreGateThresholds)]
pub fn core_gate_thresholds() -> CoreGateThresholds {
    let config = DetectorConfig::default();
    CoreGateThresholds {
        rms_gate: config.rms_gate,
        peak_gate: config.peak_gate,
        min_usable_confidence: MIN_USABLE_CONFIDENCE,
        yin_threshold: DEFAULT_YIN_THRESHOLD,
        adaptive_calibration_frames: gate::CALIBRATION_FRAMES,
        adaptive_close_confirm_frames: gate::CLOSE_CONFIRM_FRAMES,
        adaptive_open_noise_ratio: gate::OPEN_NOISE_RATIO,
        adaptive_close_noise_ratio: gate::CLOSE_NOISE_RATIO,
        adaptive_open_base_rms_factor: gate::OPEN_BASE_RMS_FACTOR,
        adaptive_close_base_rms_factor: gate::CLOSE_BASE_RMS_FACTOR,
        adaptive_close_peak_factor: gate::CLOSE_PEAK_FACTOR,
        adaptive_strong_attack_rms: gate::STRONG_ATTACK_RMS,
        adaptive_strong_attack_peak: gate::STRONG_ATTACK_PEAK,
        adaptive_onset_ratio: gate::ONSET_RATIO,
        adaptive_onset_rms_delta: gate::ONSET_RMS_DELTA,
        adaptive_universal_confidence: gate::UNIVERSAL_CONFIDENCE,
        adaptive_target_confidence: gate::TARGET_CONFIDENCE,
        adaptive_target_distance_cents: gate::TARGET_DISTANCE_CENTS,
        adaptive_noise_floor_decay: gate::NOISE_FLOOR_DECAY,
        adaptive_noise_floor_update_weight: gate::NOISE_FLOOR_UPDATE_WEIGHT,
        adaptive_noise_floor_cap_factor: gate::NOISE_FLOOR_CAP_FACTOR,
    }
}

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
pub struct WasmPitchDetector {
    inner: HybridPitchDetector,
}

#[wasm_bindgen]
impl WasmPitchDetector {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: HybridPitchDetector::new(DetectorConfig::default()),
        }
    }

    pub fn set_frequency_range(&mut self, min_frequency: f32, max_frequency: f32) {
        self.inner.set_frequency_range(min_frequency, max_frequency);
    }

    pub fn detect(&mut self, buffer: &[f32], sample_rate: f32) -> Option<PitchDetection> {
        self.inner
            .detect(buffer, sample_rate)
            .map(|estimate| PitchDetection::new(estimate.frequency, estimate.confidence))
    }
}

impl Default for WasmPitchDetector {
    fn default() -> Self {
        Self::new()
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stateful_detector_reuses_configuration_and_honors_range() {
        let sample_rate = 48_000.0;
        let samples: Vec<f32> = (0..4096)
            .map(|index| (std::f32::consts::TAU * 440.0 * index as f32 / sample_rate).sin())
            .collect();
        let mut detector = WasmPitchDetector::new();
        detector.set_frequency_range(400.0, 500.0);

        let result = detector
            .detect(&samples, sample_rate)
            .expect("440 Hz detection");

        assert!((result.freq - 440.0).abs() < 2.0);
        assert!(result.confidence > 0.5);
    }

    #[test]
    fn exported_gate_thresholds_match_core_defaults() {
        let thresholds = core_gate_thresholds();
        let config = DetectorConfig::default();
        assert_eq!(thresholds.rms_gate, config.rms_gate);
        assert_eq!(thresholds.peak_gate, config.peak_gate);
        assert_eq!(thresholds.min_usable_confidence, config.min_confidence);
        assert_eq!(thresholds.yin_threshold, config.yin_threshold);
    }

    #[test]
    fn exported_standard_windows_match_the_canonical_set() {
        assert_eq!(standard_analysis_windows(), vec![2_048, 8_192]);
    }
}
