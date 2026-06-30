use crate::domain::Note;

#[derive(Default, Clone, Debug, PartialEq)]
pub struct DetectionFrame {
    pub freq: Option<f32>,
    pub confidence: f32,
    pub rms: f32,
    pub level: f32,
    pub cents: f32,
    pub note: String,
    pub target: Option<Note>,
    pub in_tune: bool,
    pub is_power: bool,
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
