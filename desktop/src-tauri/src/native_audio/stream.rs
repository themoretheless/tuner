use super::frame::{NativeAudioRange, NativeFrameProcessor, EVENT_NAME};
use audio_input::{InputConfig, InputStream};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

pub(crate) struct NativeAudioRuntime {
    input: InputStream,
}

impl NativeAudioRuntime {
    pub(crate) fn create(
        app: AppHandle,
        shared_range: Arc<Mutex<NativeAudioRange>>,
    ) -> Result<Self, String> {
        let initial_range = shared_range.lock().map(|range| *range).unwrap_or_default();
        let mut processor = NativeFrameProcessor::new(initial_range);
        let input = InputStream::open(
            InputConfig::default(),
            move |samples, sample_rate| {
                let range = shared_range.lock().map(|range| *range).unwrap_or_default();
                let frame = processor.process(samples, sample_rate, range);
                let _ = app.emit(EVENT_NAME, frame);
            },
            |error| eprintln!("native audio input error: {error}"),
        )?;
        Ok(Self { input })
    }

    pub(crate) fn play(&self) -> Result<(), String> {
        self.input.play()
    }

    pub(crate) fn stop(&mut self) {
        self.input.stop();
    }
}
