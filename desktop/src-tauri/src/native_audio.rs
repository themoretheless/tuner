use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{FromSample, Sample, SampleFormat, SizedSample, Stream, StreamConfig};
use pitch_core::{compute_rms_volume, detect_pitch_in_range, frequency_to_note, normalize_level};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};

const PITCH_WINDOW_SIZE: usize = 4096;
const EVENT_NAME: &str = "native-audio-frame";
const ERROR_EVENT_NAME: &str = "native-audio-error";
const FRAME_INTERVAL: Duration = Duration::from_millis(33);
const WORKER_POLL_INTERVAL: Duration = Duration::from_millis(8);

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeAudioRange {
    min_frequency: f32,
    max_frequency: f32,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeAudioFrame {
    freq: Option<f32>,
    frequency: Option<f32>,
    confidence: f32,
    rms: f32,
    level: f32,
    cents: f32,
    note: String,
    target: Option<NativeAudioNote>,
    in_tune: bool,
    is_power: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeAudioNote {
    name: String,
    octave: i32,
    frequency: f32,
}

pub struct NativeAudioState {
    active_session: Arc<Mutex<Option<NativeAudioSession>>>,
    next_session_id: AtomicU64,
    range: Arc<Mutex<NativeAudioRange>>,
}

struct NativeAudioSession {
    id: u64,
    stop: mpsc::Sender<()>,
}

struct LatestAudioWindow {
    samples: Vec<f32>,
    sample_rate: f32,
    generation: u64,
}

impl LatestAudioWindow {
    fn new(size: usize) -> Self {
        Self {
            samples: Vec::with_capacity(size),
            sample_rate: 0.0,
            generation: 0,
        }
    }
}

struct MonoRingBuffer {
    samples: Vec<f32>,
    write_index: usize,
    full: bool,
}

impl MonoRingBuffer {
    fn new(size: usize) -> Self {
        Self {
            samples: vec![0.0; size],
            write_index: 0,
            full: false,
        }
    }

    fn push(&mut self, sample: f32) {
        self.samples[self.write_index] = sample;
        self.write_index += 1;
        if self.write_index == self.samples.len() {
            self.write_index = 0;
            self.full = true;
        }
    }

    fn copy_latest_into(&self, output: &mut Vec<f32>) -> bool {
        if !self.full {
            return false;
        }
        output.clear();
        output.reserve(self.samples.len());
        output.extend_from_slice(&self.samples[self.write_index..]);
        output.extend_from_slice(&self.samples[..self.write_index]);
        true
    }
}

impl Default for NativeAudioState {
    fn default() -> Self {
        Self {
            active_session: Arc::new(Mutex::new(None)),
            next_session_id: AtomicU64::new(1),
            range: Arc::new(Mutex::new(NativeAudioRange::default())),
        }
    }
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

    let mut active_session = state
        .active_session
        .lock()
        .map_err(|_| "Native audio state lock failed")?;
    if active_session.is_some() {
        return Ok(());
    }

    let session_id = state.next_session_id.fetch_add(1, Ordering::Relaxed);
    let shared_range = state.range.clone();
    let (stop_tx, stop_rx) = mpsc::channel::<()>();
    let (ready_tx, ready_rx) = mpsc::channel::<Result<(), String>>();
    *active_session = Some(NativeAudioSession {
        id: session_id,
        stop: stop_tx.clone(),
    });
    drop(active_session);

    let sessions = state.active_session.clone();

    thread::spawn(move || {
        run_audio_thread(app, shared_range, stop_rx, ready_tx);
        clear_session(&sessions, session_id);
    });

    match ready_rx.recv_timeout(Duration::from_secs(2)) {
        Ok(Ok(())) => Ok(()),
        Ok(Err(error)) => {
            let _ = stop_tx.send(());
            clear_session(&state.active_session, session_id);
            Err(error)
        }
        Err(mpsc::RecvTimeoutError::Timeout) => {
            let _ = stop_tx.send(());
            clear_session(&state.active_session, session_id);
            Err("Native audio backend did not start in time".to_string())
        }
        Err(mpsc::RecvTimeoutError::Disconnected) => {
            clear_session(&state.active_session, session_id);
            Err("Native audio backend exited during startup".to_string())
        }
    }
}

fn clear_session(sessions: &Arc<Mutex<Option<NativeAudioSession>>>, session_id: u64) {
    let Ok(mut active) = sessions.lock() else {
        return;
    };
    if active
        .as_ref()
        .is_some_and(|session| session.id == session_id)
    {
        active.take();
    }
}

fn run_audio_thread(
    app: AppHandle,
    shared_range: Arc<Mutex<NativeAudioRange>>,
    stop_rx: mpsc::Receiver<()>,
    ready_tx: mpsc::Sender<Result<(), String>>,
) {
    let latest_window = Arc::new(Mutex::new(LatestAudioWindow::new(PITCH_WINDOW_SIZE)));
    let (runtime_error_tx, runtime_error_rx) = mpsc::channel::<String>();
    let stream = match create_input_stream(latest_window.clone(), runtime_error_tx) {
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
    let mut generation = 0;
    let mut samples = Vec::with_capacity(PITCH_WINDOW_SIZE);
    loop {
        match stop_rx.recv_timeout(WORKER_POLL_INTERVAL) {
            Ok(()) | Err(mpsc::RecvTimeoutError::Disconnected) => break,
            Err(mpsc::RecvTimeoutError::Timeout) => {}
        }

        if let Ok(error) = runtime_error_rx.try_recv() {
            let _ = app.emit(ERROR_EVENT_NAME, error);
            break;
        }

        let sample_rate = latest_window.lock().ok().and_then(|latest| {
            if latest.generation == generation {
                return None;
            }
            samples.clear();
            samples.extend_from_slice(&latest.samples);
            generation = latest.generation;
            Some(latest.sample_rate)
        });
        if let Some(sample_rate) = sample_rate {
            let range = shared_range.lock().map(|range| *range).unwrap_or_default();
            let frame = make_native_audio_frame(&samples, sample_rate, range);
            let _ = app.emit(EVENT_NAME, frame);
        }
    }
    drop(stream);
}

fn create_input_stream(
    latest_window: Arc<Mutex<LatestAudioWindow>>,
    runtime_error_tx: mpsc::Sender<String>,
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
        SampleFormat::I8 => build_typed_input_stream::<i8>(
            &device,
            &config,
            sample_rate,
            latest_window,
            runtime_error_tx,
        ),
        SampleFormat::I16 => build_typed_input_stream::<i16>(
            &device,
            &config,
            sample_rate,
            latest_window,
            runtime_error_tx,
        ),
        SampleFormat::I32 => build_typed_input_stream::<i32>(
            &device,
            &config,
            sample_rate,
            latest_window,
            runtime_error_tx,
        ),
        SampleFormat::I64 => build_typed_input_stream::<i64>(
            &device,
            &config,
            sample_rate,
            latest_window,
            runtime_error_tx,
        ),
        SampleFormat::U8 => build_typed_input_stream::<u8>(
            &device,
            &config,
            sample_rate,
            latest_window,
            runtime_error_tx,
        ),
        SampleFormat::U16 => build_typed_input_stream::<u16>(
            &device,
            &config,
            sample_rate,
            latest_window,
            runtime_error_tx,
        ),
        SampleFormat::U32 => build_typed_input_stream::<u32>(
            &device,
            &config,
            sample_rate,
            latest_window,
            runtime_error_tx,
        ),
        SampleFormat::U64 => build_typed_input_stream::<u64>(
            &device,
            &config,
            sample_rate,
            latest_window,
            runtime_error_tx,
        ),
        SampleFormat::F32 => build_typed_input_stream::<f32>(
            &device,
            &config,
            sample_rate,
            latest_window,
            runtime_error_tx,
        ),
        SampleFormat::F64 => build_typed_input_stream::<f64>(
            &device,
            &config,
            sample_rate,
            latest_window,
            runtime_error_tx,
        ),
        sample_format => Err(format!(
            "Unsupported microphone sample format: {sample_format}"
        )),
    }
}

fn build_typed_input_stream<T>(
    device: &cpal::Device,
    config: &StreamConfig,
    sample_rate: f32,
    latest_window: Arc<Mutex<LatestAudioWindow>>,
    runtime_error_tx: mpsc::Sender<String>,
) -> Result<Stream, String>
where
    T: Sample + SizedSample + Copy,
    f32: FromSample<T>,
{
    let channels = usize::from(config.channels);
    if channels == 0 {
        return Err("Microphone reported zero input channels".to_string());
    }
    let mut ring = MonoRingBuffer::new(PITCH_WINDOW_SIZE);
    let mut last_publish = Instant::now() - FRAME_INTERVAL;
    device
        .build_input_stream(
            config,
            move |data: &[T], _| {
                for frame in data.chunks_exact(channels) {
                    ring.push(downmix_frame(frame));
                }
                if !ring.full || last_publish.elapsed() < FRAME_INTERVAL {
                    return;
                }

                // A single replaceable slot gives bounded latest-wins semantics.
                // try_lock keeps the realtime callback from waiting on DSP work.
                if let Ok(mut latest) = latest_window.try_lock() {
                    if ring.copy_latest_into(&mut latest.samples) {
                        latest.sample_rate = sample_rate;
                        latest.generation = latest.generation.wrapping_add(1);
                        last_publish = Instant::now();
                    }
                }
            },
            move |error| {
                let _ = runtime_error_tx.send(format!("Native audio input error: {error}"));
            },
            None,
        )
        .map_err(|error| format!("Could not create microphone stream: {error}"))
}

fn downmix_frame<T>(frame: &[T]) -> f32
where
    T: Sample + Copy,
    f32: FromSample<T>,
{
    if frame.is_empty() {
        return 0.0;
    }
    let sum = frame
        .iter()
        .map(|sample| {
            let sample = f32::from_sample(*sample);
            if sample.is_finite() {
                sample
            } else {
                0.0
            }
        })
        .sum::<f32>();
    sum / frame.len() as f32
}

#[tauri::command]
pub fn stop_native_audio(state: State<'_, NativeAudioState>) -> Result<(), String> {
    if let Some(session) = state
        .active_session
        .lock()
        .map_err(|_| "Native audio state lock failed")?
        .take()
    {
        let _ = session.stop.send(());
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
        *current = sanitize_range(range);
    }
}

fn sanitize_range(range: NativeAudioRange) -> NativeAudioRange {
    if !range.min_frequency.is_finite() || !range.max_frequency.is_finite() {
        return NativeAudioRange::default();
    }
    let range = NativeAudioRange {
        min_frequency: range.min_frequency.clamp(20.0, 600.0),
        max_frequency: range.max_frequency.clamp(80.0, 1800.0),
    };
    if range.max_frequency <= range.min_frequency * 1.2 {
        NativeAudioRange::default()
    } else {
        range
    }
}

fn make_native_audio_frame(
    buffer: &[f32],
    sample_rate: f32,
    range: NativeAudioRange,
) -> NativeAudioFrame {
    let rms = compute_rms_volume(buffer);
    let level = normalize_level(rms);
    let detection = detect_pitch_in_range(
        buffer,
        sample_rate,
        range.min_frequency,
        range.max_frequency,
    );
    let (freq, confidence) = detection.unwrap_or((0.0, 0.0));
    let freq = if freq > 0.0 { Some(freq) } else { None };
    let (note, cents) = freq
        .map(|frequency| frequency_to_note(frequency, 440.0))
        .unwrap_or_else(|| ("—".to_string(), 0.0));

    NativeAudioFrame {
        freq,
        frequency: freq,
        confidence,
        rms,
        level,
        cents,
        note,
        target: None,
        in_tune: freq.is_some() && cents.abs() <= 5.0,
        is_power: false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn downmixes_interleaved_frames_to_mono() {
        assert!((downmix_frame(&[1.0_f32, 0.0]) - 0.5).abs() < f32::EPSILON);
        assert!((downmix_frame(&[-0.5_f32, 0.5])).abs() < f32::EPSILON);
        assert_eq!(downmix_frame::<f32>(&[]), 0.0);
    }

    #[test]
    fn ring_buffer_returns_samples_in_time_order() {
        let mut ring = MonoRingBuffer::new(4);
        for sample in 1..=6 {
            ring.push(sample as f32);
        }
        let mut output = Vec::new();
        assert!(ring.copy_latest_into(&mut output));
        assert_eq!(output, vec![3.0, 4.0, 5.0, 6.0]);
    }

    #[test]
    fn empty_frame_is_safe_and_silent() {
        let frame = make_native_audio_frame(&[], 48000.0, NativeAudioRange::default());
        assert_eq!(frame.freq, None);
        assert_eq!(frame.rms, 0.0);
        assert_eq!(frame.level, 0.0);
    }

    #[test]
    fn native_frame_detects_high_notes() {
        let sample_rate = 48000.0;
        let frequency = 659.255;
        let samples: Vec<f32> = (0..PITCH_WINDOW_SIZE)
            .map(|index| {
                (2.0 * std::f32::consts::PI * frequency * index as f32 / sample_rate).sin()
            })
            .collect();
        let frame = make_native_audio_frame(&samples, sample_rate, NativeAudioRange::default());
        assert!((frame.freq.unwrap_or_default() - frequency).abs() < 3.0);
    }

    #[test]
    fn invalid_ranges_fall_back_to_defaults() {
        let range = sanitize_range(NativeAudioRange {
            min_frequency: f32::NAN,
            max_frequency: 100.0,
        });
        assert_eq!(range.min_frequency, 24.0);
        assert_eq!(range.max_frequency, 1200.0);
    }
}
