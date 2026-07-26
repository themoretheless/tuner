use super::config::SharedNativeAudioSettings;
use super::frame::{
    NativeAudioError, NativeAudioRecovery, NativeFrameProcessor, ERROR_EVENT_NAME, EVENT_NAME,
    RECOVERY_EVENT_NAME,
};
use audio_input::{InputConfig, RecoveryEvent, RecoveryPolicy, SupervisedInputStream};
use tauri::{AppHandle, Emitter};

pub(crate) struct NativeAudioRuntime {
    input: SupervisedInputStream,
}

impl NativeAudioRuntime {
    /// Open the supervised input stream. The stream starts playing inside
    /// `SupervisedInputStream::open`; on stream loss the supervisor reopens it
    /// with backoff (bounded attempts) and emits typed recovery telemetry on
    /// `native-audio-recovery` without restarting the listening session. A
    /// fatal recovery failure also surfaces as a typed `native-audio-error`.
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
        let recovery_app = app.clone();
        let input = SupervisedInputStream::open(
            InputConfig::default(),
            RecoveryPolicy::default(),
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
            move |event: RecoveryEvent| {
                if let RecoveryEvent::Failed { reason, .. } = &event {
                    let _ = recovery_app.emit(
                        ERROR_EVENT_NAME,
                        NativeAudioError::recovery_failed(reason.clone()),
                    );
                }
                let _ =
                    recovery_app.emit(RECOVERY_EVENT_NAME, NativeAudioRecovery::from_event(&event));
            },
        )?;
        Ok(Self { input })
    }

    pub(crate) fn stop(&mut self) {
        self.input.stop();
    }
}
