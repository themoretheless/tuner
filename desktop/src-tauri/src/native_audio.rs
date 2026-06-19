use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{FromSample, Sample, SampleFormat, SizedSample, Stream, StreamConfig};
use serde::{Deserialize, Serialize};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};

const PITCH_WINDOW_SIZE: usize = 4096;
const EVENT_NAME: &str = "native-audio-frame";

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeAudioRange {
    min_frequency: f32,
    max_frequency: f32,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeAudioFrame {
    frequency: Option<f32>,
    level: f32,
}

#[derive(Default)]
pub struct NativeAudioState {
    stop_signal: Mutex<Option<mpsc::Sender<()>>>,
    range: Arc<Mutex<NativeAudioRange>>,
}

impl Default for NativeAudioRange {
    fn default() -> Self {
        Self {
            min_frequency: 24.0,
            max_frequency: 1200.0,
        }
    }
}

#[tauri::command]
pub fn native_audio_available() -> bool {
    cpal::default_host().default_input_device().is_some()
}

#[tauri::command]
pub fn start_native_audio(
    app: AppHandle,
    state: State<'_, NativeAudioState>,
    range: NativeAudioRange,
) -> Result<(), String> {
    set_range(&state, range);

    if state.stop_signal.lock().map_err(|_| "Native audio state lock failed")?.is_some() {
        return Ok(());
    }

    let shared_range = state.range.clone();
    let (stop_tx, stop_rx) = mpsc::channel::<()>();
    let (ready_tx, ready_rx) = mpsc::channel::<Result<(), String>>();

    thread::spawn(move || {
        run_audio_thread(app, shared_range, stop_rx, ready_tx);
    });

    match ready_rx.recv_timeout(Duration::from_secs(2)) {
        Ok(Ok(())) => {
            *state.stop_signal.lock().map_err(|_| "Native audio state lock failed")? = Some(stop_tx);
            Ok(())
        }
        Ok(Err(error)) => Err(error),
        Err(_) => Err("Native audio backend did not start in time".to_string()),
    }
}

fn run_audio_thread(
    app: AppHandle,
    shared_range: Arc<Mutex<NativeAudioRange>>,
    stop_rx: mpsc::Receiver<()>,
    ready_tx: mpsc::Sender<Result<(), String>>,
) {
    let result = create_input_stream(app, shared_range);
    let stream = match result {
        Ok(stream) => stream,
        Err(error) => {
            let _ = ready_tx.send(Err(error));
            return;
        }
    };

    if let Err(error) = stream.play() {
        let _ = ready_tx.send(Err(format!("Could not start microphone stream: {error}")));
        return;
    }

    let _ = ready_tx.send(Ok(()));
    let _ = stop_rx.recv();
    drop(stream);
}

fn create_input_stream(
    app: AppHandle,
    shared_range: Arc<Mutex<NativeAudioRange>>,
) -> Result<Stream, String> {
    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or_else(|| "No input microphone found".to_string())?;
    let supported_config = device
        .default_input_config()
        .map_err(|error| format!("Could not read microphone config: {error}"))?;
    let sample_format = supported_config.sample_format();
    let config: StreamConfig = supported_config.into();
    let sample_rate = config.sample_rate.0 as f32;

    match sample_format {
        SampleFormat::I8 => build_typed_input_stream::<i8>(&device, &config, sample_rate, app, shared_range),
        SampleFormat::I16 => build_typed_input_stream::<i16>(&device, &config, sample_rate, app, shared_range),
        SampleFormat::I32 => build_typed_input_stream::<i32>(&device, &config, sample_rate, app, shared_range),
        SampleFormat::I64 => build_typed_input_stream::<i64>(&device, &config, sample_rate, app, shared_range),
        SampleFormat::U8 => build_typed_input_stream::<u8>(&device, &config, sample_rate, app, shared_range),
        SampleFormat::U16 => build_typed_input_stream::<u16>(&device, &config, sample_rate, app, shared_range),
        SampleFormat::U32 => build_typed_input_stream::<u32>(&device, &config, sample_rate, app, shared_range),
        SampleFormat::U64 => build_typed_input_stream::<u64>(&device, &config, sample_rate, app, shared_range),
        SampleFormat::F32 => build_typed_input_stream::<f32>(&device, &config, sample_rate, app, shared_range),
        SampleFormat::F64 => build_typed_input_stream::<f64>(&device, &config, sample_rate, app, shared_range),
        sample_format => Err(format!("Unsupported microphone sample format: {sample_format}")),
    }
}

fn build_typed_input_stream<T>(
    device: &cpal::Device,
    config: &StreamConfig,
    sample_rate: f32,
    app: AppHandle,
    shared_range: Arc<Mutex<NativeAudioRange>>,
) -> Result<Stream, String>
where
    T: Sample + SizedSample,
    f32: FromSample<T>,
{
    let mut buffer = Vec::<f32>::with_capacity(PITCH_WINDOW_SIZE * 2);
    let mut last_emit = Instant::now() - Duration::from_millis(33);
    device.build_input_stream(
            &config,
            move |data: &[T], _| {
                buffer.extend(data.iter().map(|sample| f32::from_sample(*sample)));
                if buffer.len() > PITCH_WINDOW_SIZE * 2 {
                    buffer.drain(..buffer.len() - PITCH_WINDOW_SIZE);
                }
                if buffer.len() < PITCH_WINDOW_SIZE || last_emit.elapsed() < Duration::from_millis(33) {
                    return;
                }

                last_emit = Instant::now();
                let window = &buffer[buffer.len() - PITCH_WINDOW_SIZE..];
                let level = normalize_level(window);
                let range = shared_range.lock().map(|range| *range).unwrap_or_default();
                let frequency = detect_pitch_yin(window, sample_rate, range.min_frequency, range.max_frequency);
                let _ = app.emit(EVENT_NAME, NativeAudioFrame { frequency, level });
            },
            |error| eprintln!("native audio input error: {error}"),
            None,
        )
        .map_err(|error| format!("Could not create microphone stream: {error}"))
}

#[tauri::command]
pub fn stop_native_audio(state: State<'_, NativeAudioState>) -> Result<(), String> {
    if let Some(stop) = state.stop_signal.lock().map_err(|_| "Native audio state lock failed")?.take() {
        let _ = stop.send(());
    }
    Ok(())
}

#[tauri::command]
pub fn set_native_audio_range(
    state: State<'_, NativeAudioState>,
    range: NativeAudioRange,
) -> Result<(), String> {
    set_range(&state, range);
    Ok(())
}

fn set_range(state: &State<'_, NativeAudioState>, range: NativeAudioRange) {
    if let Ok(mut current) = state.range.lock() {
        current.min_frequency = range.min_frequency.clamp(20.0, 600.0);
        current.max_frequency = range.max_frequency.clamp(80.0, 1800.0);
        if current.max_frequency <= current.min_frequency * 1.2 {
            *current = NativeAudioRange::default();
        }
    }
}

fn normalize_level(buffer: &[f32]) -> f32 {
    let rms = (buffer.iter().map(|sample| sample * sample).sum::<f32>() / buffer.len() as f32).sqrt();
    (rms * 18.0).clamp(0.0, 1.0)
}

fn detect_pitch_yin(buffer: &[f32], sample_rate: f32, min_frequency: f32, max_frequency: f32) -> Option<f32> {
    let size = buffer.len();
    let half = size / 2;
    if half < 64 {
        return None;
    }

    let rms = (buffer.iter().map(|sample| sample * sample).sum::<f32>() / size as f32).sqrt();
    let max_abs = buffer.iter().fold(0.0_f32, |max, sample| max.max(sample.abs()));
    if rms < 0.0025 || max_abs < 0.012 {
        return None;
    }

    let min_tau = (sample_rate / max_frequency.max(80.0)).max(1.0) as usize;
    let max_tau = ((sample_rate / min_frequency.max(20.0)) as usize).min(half);
    if max_tau <= min_tau + 2 {
        return None;
    }

    let mut diff = vec![0.0; half];
    for tau in min_tau..max_tau {
        let mut sum = 0.0;
        for index in 0..half {
            let delta = buffer[index] - buffer[index + tau];
            sum += delta * delta;
        }
        diff[tau] = sum;
    }

    let mut yin = vec![0.0; half];
    yin[0] = 1.0;
    let mut running_sum = 0.0;
    for tau in min_tau..max_tau {
        running_sum += diff[tau];
        yin[tau] = if running_sum > 0.0 {
            diff[tau] * (tau as f32 / running_sum)
        } else {
            1.0
        };
    }

    let mut estimate = None;
    for tau in min_tau..max_tau {
        if yin[tau] < 0.12 {
            let mut best = tau;
            while best + 1 < max_tau && yin[best + 1] < yin[best] {
                best += 1;
            }
            estimate = Some(best);
            break;
        }
    }

    let tau = match estimate {
        Some(tau) => tau,
        None => {
            let mut min_value = f32::INFINITY;
            let mut best = min_tau;
            for tau in min_tau..max_tau {
                if yin[tau] < min_value {
                    min_value = yin[tau];
                    best = tau;
                }
            }
            if min_value > 0.35 {
                return None;
            }
            best
        }
    };

    if tau < 2 || tau >= half - 1 {
        return None;
    }

    let (x0, x1, x2) = (yin[tau - 1], yin[tau], yin[tau + 1]);
    let denominator = 2.0 * x1 - x0 - x2;
    let better_tau = if denominator.abs() > 1e-9 {
        tau as f32 + (x2 - x0) / (2.0 * denominator)
    } else {
        tau as f32
    };
    let frequency = sample_rate / better_tau;

    if frequency >= min_frequency && frequency <= max_frequency {
        Some(frequency)
    } else {
        None
    }
}
