mod config;
mod frame;
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
    let control = state
        .control
        .lock()
        .map_err(|_| "Native audio state lock failed")?
        .take();
    if let Some(control) = control {
        let _ = control.stop.send(());
        control
            .stopped
            .recv_timeout(Duration::from_secs(2))
            .map_err(|_| "Native audio backend did not stop in time")?;
    }
    Ok(())
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
