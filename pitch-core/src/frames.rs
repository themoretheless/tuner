use crate::{domain::Note, PipelineTelemetry};

#[derive(Default, Clone, Debug, PartialEq)]
pub struct DetectionFrame {
    pub freq: Option<f32>,
    /// The detector's own per-frame estimate before any suppression,
    /// smoothing, or hold logic. Diagnostic: comparing it against `freq`
    /// shows whether instability comes from the raw detector or from the
    /// stabilization layers.
    pub raw_freq: Option<f32>,
    pub confidence: f32,
    pub rms: f32,
    pub level: f32,
    pub cents: f32,
    pub note: String,
    pub target: Option<Note>,
    pub in_tune: bool,
    pub is_power: bool,
    pub pipeline: PipelineTelemetry,
    pub spectrum: Vec<f32>,
}

#[derive(Default, Clone, Debug, PartialEq)]
pub struct SpectrumFrame {
    pub bins: Vec<f32>,
    pub sample_rate: f32,
}

#[derive(Default, Clone, Debug, PartialEq)]
pub struct WaveformFrame {
    pub samples: Vec<f32>,
    pub sample_rate: f32,
}

pub type TunerUpdate = DetectionFrame;
