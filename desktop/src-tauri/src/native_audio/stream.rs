use super::config::SharedNativeAudioSettings;
use super::frame::{NativeAudioError, NativeFrameProcessor, ERROR_EVENT_NAME, EVENT_NAME};
use audio_input::{InputConfig, InputStream};
use tauri::{AppHandle, Emitter};

pub(crate) struct NativeAudioRuntime {
    input: InputStream,
}

impl NativeAudioRuntime {
    pub(crate) fn create(
        app: AppHandle,
        shared_settings: SharedNativeAudioSettings,
    ) -> Result<Self, String> {
        let (mut revision, initial_config) = shared_settings
            .lock()
            .map(|settings| settings.snapshot())
            .unwrap_or_default();
        let mut processor = NativeFrameProcessor::new(initial_config);
        let error_app = app.clone();
        let input = InputStream::open(
            InputConfig::default(),
            move |samples, sample_rate| {
                let changed = shared_settings
                    .lock()
                    .ok()
                    .and_then(|settings| settings.snapshot_after(revision));
                if let Some((next_revision, config)) = changed {
                    revision = next_revision;
                    processor.update_config(config);
                }
                let frame = processor.process(samples, sample_rate);
                let _ = app.emit(EVENT_NAME, frame);
            },
            move |error| {
                let _ = error_app.emit(ERROR_EVENT_NAME, NativeAudioError::new(error));
            },
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
