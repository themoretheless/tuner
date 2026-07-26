mod config;
mod frame;
mod signal_health;
mod stream;

use self::config::{NativeAudioConfig, SharedNativeAudioSettings};
use std::sync::{mpsc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, State};

struct NativeAudioControl {
    stop: mpsc::Sender<()>,
    stopped: mpsc::Receiver<()>,
}

#[derive(Default)]
pub struct NativeAudioState {
    control: Mutex<Option<NativeAudioControl>>,
    settings: SharedNativeAudioSettings,
}

impl NativeAudioState {
    fn stop_with_timeout(&self, timeout: Duration) -> Result<(), String> {
        let mut control = self
            .control
            .lock()
            .map_err(|_| "Native audio state lock failed")?;
        let Some(active) = control.as_ref() else {
            return Ok(());
        };

        let _ = active.stop.send(());
        match active.stopped.recv_timeout(timeout) {
            Ok(()) | Err(mpsc::RecvTimeoutError::Disconnected) => {
                *control = None;
                Ok(())
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {
                Err("Native audio backend did not stop in time".to_string())
            }
        }
    }
}

#[tauri::command]
pub fn native_audio_available() -> bool {
    audio_input::default_input_available()
}

#[tauri::command]
pub fn start_native_audio(
    app: AppHandle,
    state: State<'_, NativeAudioState>,
    config: NativeAudioConfig,
) -> Result<(), String> {
    set_config(&state, config)?;

    let mut control = state
        .control
        .lock()
        .map_err(|_| "Native audio state lock failed")?;
    if control.is_some() {
        return Ok(());
    }

    let shared_settings = state.settings.clone();
    let (stop_tx, stop_rx) = mpsc::channel();
    let (stopped_tx, stopped_rx) = mpsc::channel();
    let (ready_tx, ready_rx) = mpsc::channel();
    thread::spawn(move || {
        run_audio_thread(app, shared_settings, stop_rx, ready_tx);
        let _ = stopped_tx.send(());
    });

    match ready_rx.recv_timeout(Duration::from_secs(2)) {
        Ok(Ok(())) => {
            *control = Some(NativeAudioControl {
                stop: stop_tx,
                stopped: stopped_rx,
            });
            Ok(())
        }
        Ok(Err(error)) => Err(error),
        Err(_) => {
            let _ = stop_tx.send(());
            Err("Native audio backend did not start in time".to_string())
        }
    }
}

fn run_audio_thread(
    app: AppHandle,
    shared_settings: SharedNativeAudioSettings,
    stop_rx: mpsc::Receiver<()>,
    ready_tx: mpsc::Sender<Result<(), String>>,
) {
    let mut runtime = match stream::NativeAudioRuntime::create(app, shared_settings) {
        Ok(runtime) => runtime,
        Err(error) => {
            let _ = ready_tx.send(Err(error));
            return;
        }
    };

    if let Err(error) = runtime.play() {
        let _ = ready_tx.send(Err(error));
        runtime.stop();
        return;
    }

    let _ = ready_tx.send(Ok(()));
    let _ = stop_rx.recv();
    runtime.stop();
}

#[tauri::command]
pub fn stop_native_audio(state: State<'_, NativeAudioState>) -> Result<(), String> {
    state.stop_with_timeout(Duration::from_secs(2))
}

#[tauri::command]
pub fn configure_native_audio(
    state: State<'_, NativeAudioState>,
    config: NativeAudioConfig,
) -> Result<(), String> {
    set_config(&state, config)
}

fn set_config(
    state: &State<'_, NativeAudioState>,
    config: NativeAudioConfig,
) -> Result<(), String> {
    state
        .settings
        .lock()
        .map_err(|_| "Native audio settings lock failed")?
        .update(config);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn timed_out_stop_keeps_control_for_retry() {
        let state = NativeAudioState::default();
        let (stop_tx, _stop_rx) = mpsc::channel();
        let (stopped_tx, stopped_rx) = mpsc::channel();
        *state.control.lock().expect("state lock") = Some(NativeAudioControl {
            stop: stop_tx,
            stopped: stopped_rx,
        });

        assert_eq!(
            state.stop_with_timeout(Duration::ZERO),
            Err("Native audio backend did not stop in time".to_string()),
        );
        assert!(state.control.lock().expect("state lock").is_some());

        stopped_tx.send(()).expect("stop acknowledgement");
        assert_eq!(state.stop_with_timeout(Duration::ZERO), Ok(()));
        assert!(state.control.lock().expect("state lock").is_none());
    }
}
