use crate::{note_to_midi, DetectionFrame};
use wasm_bindgen::prelude::*;

#[wasm_bindgen(js_name = TunerFrame)]
pub struct WasmDetectionFrame {
    adaptive_gate_open: bool,
    arbitration: String,
    cents: f32,
    confidence: f32,
    decision: String,
    freq: f32,
    fixed_gate_open: bool,
    gate_threshold: f32,
    harmonic_1: f32,
    harmonic_2: f32,
    harmonic_3: f32,
    harmonic_4: f32,
    harmonic_5: f32,
    held: bool,
    raw_freq: f32,
    has_frequency: bool,
    has_raw_frequency: bool,
    has_secondary_candidate: bool,
    has_selected_candidate: bool,
    has_spectral_evidence: bool,
    has_target: bool,
    has_yin_candidate: bool,
    in_tune: bool,
    is_power: bool,
    level: f32,
    noise_floor: f32,
    note: String,
    octave_active: i8,
    octave_base_frequency: f32,
    octave_center_score: f32,
    octave_down_score: f32,
    octave_pending: i8,
    octave_up_score: f32,
    rms: f32,
    sample_rate: f32,
    secondary_confidence: f32,
    secondary_frequency: f32,
    selected_confidence: f32,
    selected_frequency: f32,
    target_frequency: f32,
    target_midi: i32,
    tracked: bool,
    window_samples: u32,
    yin_confidence: f32,
    yin_frequency: f32,
}

#[wasm_bindgen(js_class = TunerFrame)]
impl WasmDetectionFrame {
    #[wasm_bindgen(getter)]
    pub fn adaptive_gate_open(&self) -> bool {
        self.adaptive_gate_open
    }

    #[wasm_bindgen(getter)]
    pub fn arbitration(&self) -> String {
        self.arbitration.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn cents(&self) -> f32 {
        self.cents
    }

    #[wasm_bindgen(getter)]
    pub fn confidence(&self) -> f32 {
        self.confidence
    }

    #[wasm_bindgen(getter)]
    pub fn decision(&self) -> String {
        self.decision.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn freq(&self) -> f32 {
        self.freq
    }

    #[wasm_bindgen(getter)]
    pub fn fixed_gate_open(&self) -> bool {
        self.fixed_gate_open
    }

    #[wasm_bindgen(getter)]
    pub fn gate_threshold(&self) -> f32 {
        self.gate_threshold
    }

    #[wasm_bindgen(getter)]
    pub fn harmonic_1(&self) -> f32 {
        self.harmonic_1
    }

    #[wasm_bindgen(getter)]
    pub fn harmonic_2(&self) -> f32 {
        self.harmonic_2
    }

    #[wasm_bindgen(getter)]
    pub fn harmonic_3(&self) -> f32 {
        self.harmonic_3
    }

    #[wasm_bindgen(getter)]
    pub fn harmonic_4(&self) -> f32 {
        self.harmonic_4
    }

    #[wasm_bindgen(getter)]
    pub fn harmonic_5(&self) -> f32 {
        self.harmonic_5
    }

    #[wasm_bindgen(getter)]
    pub fn held(&self) -> bool {
        self.held
    }

    #[wasm_bindgen(getter)]
    pub fn raw_freq(&self) -> f32 {
        self.raw_freq
    }

    #[wasm_bindgen(getter)]
    pub fn has_frequency(&self) -> bool {
        self.has_frequency
    }

    #[wasm_bindgen(getter)]
    pub fn has_raw_frequency(&self) -> bool {
        self.has_raw_frequency
    }

    #[wasm_bindgen(getter)]
    pub fn has_secondary_candidate(&self) -> bool {
        self.has_secondary_candidate
    }

    #[wasm_bindgen(getter)]
    pub fn has_selected_candidate(&self) -> bool {
        self.has_selected_candidate
    }

    #[wasm_bindgen(getter)]
    pub fn has_spectral_evidence(&self) -> bool {
        self.has_spectral_evidence
    }

    #[wasm_bindgen(getter)]
    pub fn has_target(&self) -> bool {
        self.has_target
    }

    #[wasm_bindgen(getter)]
    pub fn has_yin_candidate(&self) -> bool {
        self.has_yin_candidate
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
    pub fn noise_floor(&self) -> f32 {
        self.noise_floor
    }

    #[wasm_bindgen(getter)]
    pub fn note(&self) -> String {
        self.note.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn octave_active(&self) -> i8 {
        self.octave_active
    }

    #[wasm_bindgen(getter)]
    pub fn octave_base_frequency(&self) -> f32 {
        self.octave_base_frequency
    }

    #[wasm_bindgen(getter)]
    pub fn octave_center_score(&self) -> f32 {
        self.octave_center_score
    }

    #[wasm_bindgen(getter)]
    pub fn octave_down_score(&self) -> f32 {
        self.octave_down_score
    }

    #[wasm_bindgen(getter)]
    pub fn octave_pending(&self) -> i8 {
        self.octave_pending
    }

    #[wasm_bindgen(getter)]
    pub fn octave_up_score(&self) -> f32 {
        self.octave_up_score
    }

    #[wasm_bindgen(getter)]
    pub fn rms(&self) -> f32 {
        self.rms
    }

    #[wasm_bindgen(getter)]
    pub fn sample_rate(&self) -> f32 {
        self.sample_rate
    }

    #[wasm_bindgen(getter)]
    pub fn secondary_confidence(&self) -> f32 {
        self.secondary_confidence
    }

    #[wasm_bindgen(getter)]
    pub fn secondary_frequency(&self) -> f32 {
        self.secondary_frequency
    }

    #[wasm_bindgen(getter)]
    pub fn selected_confidence(&self) -> f32 {
        self.selected_confidence
    }

    #[wasm_bindgen(getter)]
    pub fn selected_frequency(&self) -> f32 {
        self.selected_frequency
    }

    #[wasm_bindgen(getter)]
    pub fn target_frequency(&self) -> f32 {
        self.target_frequency
    }

    #[wasm_bindgen(getter)]
    pub fn target_midi(&self) -> i32 {
        self.target_midi
    }

    #[wasm_bindgen(getter)]
    pub fn tracked(&self) -> bool {
        self.tracked
    }

    #[wasm_bindgen(getter)]
    pub fn window_samples(&self) -> u32 {
        self.window_samples
    }

    #[wasm_bindgen(getter)]
    pub fn yin_confidence(&self) -> f32 {
        self.yin_confidence
    }

    #[wasm_bindgen(getter)]
    pub fn yin_frequency(&self) -> f32 {
        self.yin_frequency
    }
}

impl From<DetectionFrame> for WasmDetectionFrame {
    fn from(frame: DetectionFrame) -> Self {
        let has_frequency = frame.freq.is_some();
        let has_raw_frequency = frame.raw_freq.is_some();
        let pipeline = frame.pipeline;
        let has_yin_candidate = pipeline.yin.is_some();
        let has_secondary_candidate = pipeline.secondary.is_some();
        let has_selected_candidate = pipeline.selected.is_some();
        let has_spectral_evidence = pipeline.spectral.is_some();
        let spectral = pipeline.spectral.unwrap_or_default();
        let (has_target, target_midi, target_frequency) =
            frame.target.as_ref().map_or((false, -1, 0.0), |target| {
                (
                    true,
                    note_to_midi(target.name, target.octave),
                    target.frequency,
                )
            });
        Self {
            adaptive_gate_open: pipeline.adaptive_gate_open,
            arbitration: pipeline.arbitration.as_str().to_string(),
            cents: frame.cents,
            confidence: frame.confidence,
            decision: pipeline.decision.as_str().to_string(),
            freq: frame.freq.unwrap_or(0.0),
            fixed_gate_open: pipeline.fixed_gate_open,
            gate_threshold: pipeline.gate_threshold,
            harmonic_1: spectral.harmonics[0],
            harmonic_2: spectral.harmonics[1],
            harmonic_3: spectral.harmonics[2],
            harmonic_4: spectral.harmonics[3],
            harmonic_5: spectral.harmonics[4],
            held: pipeline.held,
            raw_freq: frame.raw_freq.unwrap_or(0.0),
            has_frequency,
            has_raw_frequency,
            has_secondary_candidate,
            has_selected_candidate,
            has_spectral_evidence,
            has_target,
            has_yin_candidate,
            in_tune: frame.in_tune,
            is_power: frame.is_power,
            level: frame.level,
            noise_floor: pipeline.noise_floor,
            note: frame.note,
            octave_active: spectral.active_octave,
            octave_base_frequency: spectral.base_frequency,
            octave_center_score: spectral.octave_scores[1],
            octave_down_score: spectral.octave_scores[0],
            octave_pending: spectral.pending_octave,
            octave_up_score: spectral.octave_scores[2],
            rms: frame.rms,
            sample_rate: pipeline.sample_rate,
            secondary_confidence: pipeline.secondary.map_or(0.0, |value| value.confidence),
            secondary_frequency: pipeline.secondary.map_or(0.0, |value| value.frequency),
            selected_confidence: pipeline.selected.map_or(0.0, |value| value.confidence),
            selected_frequency: pipeline.selected.map_or(0.0, |value| value.frequency),
            target_frequency,
            target_midi,
            tracked: pipeline.tracked,
            window_samples: pipeline.window_samples,
            yin_confidence: pipeline.yin.map_or(0.0, |value| value.confidence),
            yin_frequency: pipeline.yin.map_or(0.0, |value| value.frequency),
        }
    }
}
