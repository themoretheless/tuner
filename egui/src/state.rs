use pitch_core::DetectionFrame;
use std::sync::{Arc, Mutex};

pub(crate) type SharedTunerState = Arc<Mutex<TunerViewState>>;

#[derive(Clone, Default)]
pub(crate) struct TunerViewState {
    pub(crate) cents: f32,
    pub(crate) confidence: f32,
    pub(crate) error: Option<String>,
    pub(crate) frame_id: u64,
    pub(crate) frequency: Option<f32>,
    pub(crate) is_power: bool,
    pub(crate) level: f32,
    pub(crate) note: Option<String>,
    pub(crate) sample_rate: f32,
    pub(crate) spectrum: Vec<f32>,
    pub(crate) waveform: Vec<f32>,
}

impl TunerViewState {
    pub(crate) fn apply(&mut self, frame: DetectionFrame, waveform: &[f32], sample_rate: f32) {
        self.cents = frame.cents;
        self.confidence = frame.confidence;
        self.error = None;
        self.frame_id = self.frame_id.wrapping_add(1);
        self.frequency = frame.freq;
        self.is_power = frame.is_power;
        self.level = frame.level;
        self.note = Some(frame.note);
        self.sample_rate = sample_rate;
        self.spectrum = frame.spectrum;
        self.waveform.clear();
        self.waveform.extend_from_slice(waveform);
    }

    pub(crate) fn clear_detection(&mut self) {
        self.cents = 0.0;
        self.confidence = 0.0;
        self.frequency = None;
        self.is_power = false;
        self.level = 0.0;
        self.note = None;
        self.spectrum.clear();
        self.waveform.clear();
    }
}
