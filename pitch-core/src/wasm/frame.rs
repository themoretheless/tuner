use crate::{note_to_midi, DetectionFrame};
use wasm_bindgen::prelude::*;

#[wasm_bindgen(js_name = TunerFrame)]
pub struct WasmDetectionFrame {
    cents: f32,
    confidence: f32,
    freq: f32,
    has_frequency: bool,
    has_target: bool,
    in_tune: bool,
    is_power: bool,
    level: f32,
    note: String,
    rms: f32,
    target_frequency: f32,
    target_midi: i32,
}

#[wasm_bindgen(js_class = TunerFrame)]
impl WasmDetectionFrame {
    #[wasm_bindgen(getter)]
    pub fn cents(&self) -> f32 {
        self.cents
    }

    #[wasm_bindgen(getter)]
    pub fn confidence(&self) -> f32 {
        self.confidence
    }

    #[wasm_bindgen(getter)]
    pub fn freq(&self) -> f32 {
        self.freq
    }

    #[wasm_bindgen(getter)]
    pub fn has_frequency(&self) -> bool {
        self.has_frequency
    }

    #[wasm_bindgen(getter)]
    pub fn has_target(&self) -> bool {
        self.has_target
    }

    #[wasm_bindgen(getter)]
    pub fn in_tune(&self) -> bool {
        self.in_tune
    }

    #[wasm_bindgen(getter)]
    pub fn is_power(&self) -> bool {
        self.is_power
    }

    #[wasm_bindgen(getter)]
    pub fn level(&self) -> f32 {
        self.level
    }

    #[wasm_bindgen(getter)]
    pub fn note(&self) -> String {
        self.note.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn rms(&self) -> f32 {
        self.rms
    }

    #[wasm_bindgen(getter)]
    pub fn target_frequency(&self) -> f32 {
        self.target_frequency
    }

    #[wasm_bindgen(getter)]
    pub fn target_midi(&self) -> i32 {
        self.target_midi
    }
}

impl From<DetectionFrame> for WasmDetectionFrame {
    fn from(frame: DetectionFrame) -> Self {
        let has_frequency = frame.freq.is_some();
        let (has_target, target_midi, target_frequency) =
            frame.target.as_ref().map_or((false, -1, 0.0), |target| {
                (
                    true,
                    note_to_midi(target.name, target.octave),
                    target.frequency,
                )
            });
        Self {
            cents: frame.cents,
            confidence: frame.confidence,
            freq: frame.freq.unwrap_or(0.0),
            has_frequency,
            has_target,
            in_tune: frame.in_tune,
            is_power: frame.is_power,
            level: frame.level,
            note: frame.note,
            rms: frame.rms,
            target_frequency,
            target_midi,
        }
    }
}
