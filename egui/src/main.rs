use eframe::egui;

#[cfg(not(target_arch = "wasm32"))]
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
#[cfg(not(target_arch = "wasm32"))]
use cpal::{FromSample, Sample, SampleFormat, SizedSample, Stream, StreamConfig};

use std::sync::{Arc, Mutex};
#[cfg(not(target_arch = "wasm32"))]
use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc,
    },
    thread,
    time::{Duration, Instant},
};

use pitch_core::{get_tunings, TunerEngine, TunerUpdate, Tuning};

// Consistent sample rate for audio processing and viz calculations.
// Matches the wasm feed path (48000) and preferred in web.
const PREFERRED_SAMPLE_RATE: f32 = 48000.0;
#[cfg(not(target_arch = "wasm32"))]
const PITCH_WINDOW_SIZE: usize = 4096;
#[cfg(not(target_arch = "wasm32"))]
const INPUT_FRAME_INTERVAL: Duration = Duration::from_millis(33);

#[cfg(target_arch = "wasm32")]
static WEB_ENGINE: std::sync::OnceLock<std::sync::Arc<std::sync::Mutex<TunerEngine>>> =
    std::sync::OnceLock::new();

#[cfg(target_arch = "wasm32")]
static WEB_STATE: std::sync::OnceLock<std::sync::Arc<std::sync::Mutex<State>>> =
    std::sync::OnceLock::new();

// Use shared Smoother from pitch-core
// (native Rust, no WASM)

#[derive(Clone, Default)]
struct State {
    sequence: u64,
    freq: Option<f32>,
    note: Option<String>,
    cents: f32,
    spectrum: Vec<f32>, // magnitude spectrum, normalized 0..1
    level: f32,         // input level 0..1
    confidence: f32,
    is_power: bool,
    waveform: Vec<f32>,
    audio_error: Option<String>,
}

/// Extracted from god App to handle all audio input/output concerns.
/// Owns device enumeration, stream management (native cpal), and feeding samples (wasm).
#[derive(Default)]
struct AudioManager {
    input_devices: Vec<String>,
    selected_input_device: Option<String>,

    #[cfg(not(target_arch = "wasm32"))]
    inp: Option<Stream>,
    #[cfg(not(target_arch = "wasm32"))]
    out: Option<Stream>,
    #[cfg(not(target_arch = "wasm32"))]
    worker_stop: Option<mpsc::Sender<()>>,
    #[cfg(not(target_arch = "wasm32"))]
    worker: Option<thread::JoinHandle<()>>,
    #[cfg(not(target_arch = "wasm32"))]
    input_running: Arc<AtomicBool>,
}

#[cfg(not(target_arch = "wasm32"))]
struct LatestAudioWindow {
    samples: Vec<f32>,
    sample_rate: f32,
    generation: u64,
}

#[cfg(not(target_arch = "wasm32"))]
impl LatestAudioWindow {
    fn new(size: usize) -> Self {
        Self {
            samples: Vec::with_capacity(size),
            sample_rate: 0.0,
            generation: 0,
        }
    }
}

#[cfg(not(target_arch = "wasm32"))]
struct MonoRingBuffer {
    samples: Vec<f32>,
    write_index: usize,
    full: bool,
}

#[cfg(not(target_arch = "wasm32"))]
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

impl AudioManager {
    #[cfg(not(target_arch = "wasm32"))]
    fn refresh(&mut self) {
        let host = cpal::default_host();
        self.input_devices = host
            .input_devices()
            .map(|devs| devs.filter_map(|d| d.name().ok()).collect())
            .unwrap_or_default();
    }

    #[cfg(target_arch = "wasm32")]
    fn refresh(&mut self) {
        // Devices listed via JS if needed; stub for now
    }

    #[cfg(not(target_arch = "wasm32"))]
    fn stop_input(&mut self) {
        drop(self.inp.take());
        self.input_running.store(false, Ordering::Release);
        if let Some(stop) = self.worker_stop.take() {
            let _ = stop.send(());
        }
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
    }

    // start_mic / toggle logic will be called from App with engine/st refs
    // wasm feed is on App or here
}

#[cfg(not(target_arch = "wasm32"))]
fn build_input_stream_for_format(
    device: &cpal::Device,
    config: &StreamConfig,
    sample_format: SampleFormat,
    sample_rate: f32,
    latest_window: Arc<Mutex<LatestAudioWindow>>,
    runtime_error_tx: mpsc::Sender<String>,
    running: Arc<AtomicBool>,
) -> Result<Stream, String> {
    match sample_format {
        SampleFormat::I8 => build_typed_input_stream::<i8>(
            device,
            config,
            sample_rate,
            latest_window,
            runtime_error_tx,
            running,
        ),
        SampleFormat::I16 => build_typed_input_stream::<i16>(
            device,
            config,
            sample_rate,
            latest_window,
            runtime_error_tx,
            running,
        ),
        SampleFormat::I32 => build_typed_input_stream::<i32>(
            device,
            config,
            sample_rate,
            latest_window,
            runtime_error_tx,
            running,
        ),
        SampleFormat::I64 => build_typed_input_stream::<i64>(
            device,
            config,
            sample_rate,
            latest_window,
            runtime_error_tx,
            running,
        ),
        SampleFormat::U8 => build_typed_input_stream::<u8>(
            device,
            config,
            sample_rate,
            latest_window,
            runtime_error_tx,
            running,
        ),
        SampleFormat::U16 => build_typed_input_stream::<u16>(
            device,
            config,
            sample_rate,
            latest_window,
            runtime_error_tx,
            running,
        ),
        SampleFormat::U32 => build_typed_input_stream::<u32>(
            device,
            config,
            sample_rate,
            latest_window,
            runtime_error_tx,
            running,
        ),
        SampleFormat::U64 => build_typed_input_stream::<u64>(
            device,
            config,
            sample_rate,
            latest_window,
            runtime_error_tx,
            running,
        ),
        SampleFormat::F32 => build_typed_input_stream::<f32>(
            device,
            config,
            sample_rate,
            latest_window,
            runtime_error_tx,
            running,
        ),
        SampleFormat::F64 => build_typed_input_stream::<f64>(
            device,
            config,
            sample_rate,
            latest_window,
            runtime_error_tx,
            running,
        ),
        format => Err(format!("Unsupported input sample format: {format}")),
    }
}

#[cfg(not(target_arch = "wasm32"))]
fn build_typed_input_stream<T>(
    device: &cpal::Device,
    config: &StreamConfig,
    sample_rate: f32,
    latest_window: Arc<Mutex<LatestAudioWindow>>,
    runtime_error_tx: mpsc::Sender<String>,
    running: Arc<AtomicBool>,
) -> Result<Stream, String>
where
    T: Sample + SizedSample + Copy,
    f32: FromSample<T>,
{
    let channels = usize::from(config.channels);
    if channels == 0 {
        return Err("Input device reported zero channels".to_string());
    }

    let mut ring = MonoRingBuffer::new(PITCH_WINDOW_SIZE);
    let mut last_publish = Instant::now() - INPUT_FRAME_INTERVAL;
    device
        .build_input_stream(
            config,
            move |data: &[T], _| {
                for frame in data.chunks_exact(channels) {
                    ring.push(downmix_frame(frame));
                }
                if !ring.full || last_publish.elapsed() < INPUT_FRAME_INTERVAL {
                    return;
                }

                // The callback only downmixes and replaces one bounded slot.
                // It never waits for the worker that runs YIN and the FFT.
                if let Ok(mut latest) = latest_window.try_lock() {
                    if ring.copy_latest_into(&mut latest.samples) {
                        latest.sample_rate = sample_rate;
                        latest.generation = latest.generation.wrapping_add(1);
                        last_publish = Instant::now();
                    }
                }
            },
            move |error| {
                running.store(false, Ordering::Release);
                let _ = runtime_error_tx.send(format!("Audio input failed: {error}"));
            },
            None,
        )
        .map_err(|error| format!("Could not create input stream: {error}"))
}

#[cfg(not(target_arch = "wasm32"))]
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

#[cfg(not(target_arch = "wasm32"))]
fn run_input_worker(
    latest_window: Arc<Mutex<LatestAudioWindow>>,
    runtime_error_rx: mpsc::Receiver<String>,
    stop_rx: mpsc::Receiver<()>,
    engine: Arc<Mutex<TunerEngine>>,
    state: Arc<Mutex<State>>,
    context: egui::Context,
    running: Arc<AtomicBool>,
) {
    let mut generation = 0;
    let mut samples = Vec::with_capacity(PITCH_WINDOW_SIZE);
    loop {
        match stop_rx.recv_timeout(Duration::from_millis(8)) {
            Ok(()) | Err(mpsc::RecvTimeoutError::Disconnected) => break,
            Err(mpsc::RecvTimeoutError::Timeout) => {}
        }

        if let Ok(error) = runtime_error_rx.try_recv() {
            if let Ok(mut state) = state.lock() {
                state.audio_error = Some(error);
            }
            running.store(false, Ordering::Release);
            context.request_repaint();
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
        let Some(sample_rate) = sample_rate else {
            continue;
        };

        let update = engine
            .lock()
            .map(|mut engine| engine.process(&samples, sample_rate))
            .unwrap_or_else(|_| TunerUpdate::default());

        if let Ok(mut state) = state.lock() {
            state.sequence = state.sequence.wrapping_add(1);
            state.freq = update.freq;
            state.cents = update.cents;
            state.confidence = update.confidence;
            state.is_power = update.is_power;
            state.level = update.level;
            state.note = Some(update.note);
            state.waveform.clear();
            state.waveform.extend_from_slice(&samples);
            if !update.spectrum.is_empty() {
                state.spectrum = update.spectrum;
            }
        }
        context.request_repaint();
    }
}

#[cfg(not(target_arch = "wasm32"))]
fn create_output_tone(frequency: f32) -> Result<Stream, String> {
    if !frequency.is_finite() || frequency <= 0.0 {
        return Err("Reference frequency must be positive".to_string());
    }
    let device = cpal::default_host()
        .default_output_device()
        .ok_or_else(|| "No output device available".to_string())?;
    let supported_config = device
        .default_output_config()
        .map_err(|error| format!("Could not read output config: {error}"))?;
    let sample_format = supported_config.sample_format();
    let config: StreamConfig = supported_config.into();
    let stream = match sample_format {
        SampleFormat::I8 => build_typed_output_stream::<i8>(&device, &config, frequency),
        SampleFormat::I16 => build_typed_output_stream::<i16>(&device, &config, frequency),
        SampleFormat::I32 => build_typed_output_stream::<i32>(&device, &config, frequency),
        SampleFormat::I64 => build_typed_output_stream::<i64>(&device, &config, frequency),
        SampleFormat::U8 => build_typed_output_stream::<u8>(&device, &config, frequency),
        SampleFormat::U16 => build_typed_output_stream::<u16>(&device, &config, frequency),
        SampleFormat::U32 => build_typed_output_stream::<u32>(&device, &config, frequency),
        SampleFormat::U64 => build_typed_output_stream::<u64>(&device, &config, frequency),
        SampleFormat::F32 => build_typed_output_stream::<f32>(&device, &config, frequency),
        SampleFormat::F64 => build_typed_output_stream::<f64>(&device, &config, frequency),
        format => Err(format!("Unsupported output sample format: {format}")),
    }?;
    stream
        .play()
        .map_err(|error| format!("Could not start output stream: {error}"))?;
    Ok(stream)
}

#[cfg(not(target_arch = "wasm32"))]
fn build_typed_output_stream<T>(
    device: &cpal::Device,
    config: &StreamConfig,
    frequency: f32,
) -> Result<Stream, String>
where
    T: Sample + SizedSample + FromSample<f32>,
{
    let channels = usize::from(config.channels);
    if channels == 0 {
        return Err("Output device reported zero channels".to_string());
    }
    let sample_rate = config.sample_rate.0 as f32;
    let mut phase = 0.0;
    device
        .build_output_stream(
            config,
            move |data: &mut [T], _| {
                fill_tone_buffer(data, channels, frequency, sample_rate, &mut phase);
            },
            |error| eprintln!("audio output error: {error}"),
            None,
        )
        .map_err(|error| format!("Could not create output stream: {error}"))
}

#[cfg(not(target_arch = "wasm32"))]
fn fill_tone_buffer<T>(
    output: &mut [T],
    channels: usize,
    frequency: f32,
    sample_rate: f32,
    phase: &mut f32,
) where
    T: Sample + FromSample<f32>,
{
    let phase_step = frequency / sample_rate;
    for frame in output.chunks_mut(channels.max(1)) {
        let value = (2.0 * std::f32::consts::PI * *phase).sin() * 0.18;
        let value = T::from_sample(value);
        for sample in frame {
            *sample = value;
        }
        *phase = (*phase + phase_step).fract();
    }
}

struct App {
    st: Arc<Mutex<State>>,
    tunings: Vec<Tuning>,
    t_idx: usize,
    a4: f32,
    listen: bool,
    ref_on: bool,
    engine: Arc<Mutex<TunerEngine>>,
    spec: bool,

    audio: AudioManager,

    viz: VizManager,
}

/// Extracted viz data manager to further de-god the App.
#[derive(Default)]
struct VizManager {
    last_sequence: u64,
    cents_history: Vec<f32>,
    spectrogram_history: std::collections::VecDeque<Vec<f32>>,
    show_spectrogram: bool,
}

impl VizManager {
    fn clear(&mut self) {
        self.cents_history.clear();
        self.spectrogram_history.clear();
    }

    fn record_frame(&mut self, state: &State) {
        if state.sequence == self.last_sequence {
            return;
        }
        self.last_sequence = state.sequence;
        self.cents_history.push(state.cents);
        if self.cents_history.len() > 300 {
            self.cents_history.remove(0);
        }

        if !state.spectrum.is_empty() {
            self.spectrogram_history.push_back(state.spectrum.clone());
            if self.spectrogram_history.len() > 150 {
                self.spectrogram_history.pop_front();
            }
        }
    }
}

impl Default for App {
    fn default() -> Self {
        Self {
            st: Arc::new(Mutex::new(State::default())),
            tunings: get_tunings(),
            t_idx: 0,
            a4: 440.0,
            listen: false,
            ref_on: false,
            engine: Arc::new(Mutex::new(TunerEngine::new(440.0))),
            spec: false,
            audio: AudioManager::default(),
            viz: VizManager::default(),
        }
    }
}

impl eframe::App for App {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        ctx.request_repaint_after(std::time::Duration::from_millis(250));
        ctx.set_visuals(egui::Visuals::dark());

        #[cfg(not(target_arch = "wasm32"))]
        if self.listen && !self.audio.input_running.load(Ordering::Acquire) {
            self.audio.stop_input();
            self.listen = false;
            if let Ok(mut engine) = self.engine.lock() {
                engine.reset();
            }
        }

        if !self.tunings.is_empty() {
            self.t_idx = self.t_idx.min(self.tunings.len() - 1);
        }

        let s = self.st.lock().unwrap().clone();

        self.viz.record_frame(&s);

        // Keyboard shortcuts
        if ctx.input(|i| i.key_pressed(egui::Key::Space) || i.key_pressed(egui::Key::M)) {
            self.toggle_mic(ctx);
        }
        if ctx.input(|i| i.key_pressed(egui::Key::R)) {
            self.toggle_ref();
        }
        egui::CentralPanel::default().show(ctx, |ui| {
            ui.vertical_centered(|ui| {
                ui.heading("Guitar Tuner — egui Native");
                let ns = s.note.unwrap_or("—".into());
                ui.label(egui::RichText::new(ns).size(78.0).strong());
                if let Some(f) = s.freq {
                    ui.label(format!("{:.1} Hz", f));
                }
                ui.label(format!(
                    "{:.1} ¢  conf {:.0}%",
                    s.cents,
                    s.confidence * 100.0
                ));
                if let Some(error) = &s.audio_error {
                    ui.label(egui::RichText::new(error).color(egui::Color32::LIGHT_RED));
                }
                if s.is_power {
                    ui.label(egui::RichText::new("power chord").small());
                }

                // input level
                ui.add(
                    egui::ProgressBar::new(s.level)
                        .text("Input level")
                        .desired_width(200.0),
                );

                // Basic waveform (port in progress)
                if !s.waveform.is_empty() {
                    ui.add_space(4.0);
                    let w = 430.0;
                    let h = 30.0;
                    let (rect, _) = ui.allocate_exact_size(egui::vec2(w, h), egui::Sense::hover());
                    let painter = ui.painter();
                    painter.rect_filled(rect, 2.0, egui::Color32::from_gray(30));
                    let n = s.waveform.len() as f32;
                    for (i, &v) in s.waveform.iter().enumerate() {
                        let x = rect.min.x + (i as f32 / n) * w;
                        let y = rect.center().y - v * (h / 2.0) * 2.0;
                        let y = y.clamp(rect.min.y, rect.max.y);
                        painter.circle_filled(
                            egui::pos2(x, y),
                            0.5,
                            egui::Color32::from_rgb(100, 200, 150),
                        );
                    }
                }

                let w = 430.0;
                let r = ui
                    .allocate_exact_size(egui::vec2(w, 18.0), egui::Sense::hover())
                    .0;
                let p = ui.painter();
                p.rect_filled(r, 4.0, egui::Color32::from_gray(48));
                let cx = r.center().x;
                let px = (cx + s.cents / 50.0 * w * 0.5).clamp(r.min.x, r.max.x);
                p.circle_filled(
                    egui::pos2(px, r.center().y),
                    7.0,
                    if s.cents.abs() < 5.0 {
                        egui::Color32::GREEN
                    } else {
                        egui::Color32::RED
                    },
                );

                // (cents history plot coming in viz port)
                if !self.viz.cents_history.is_empty() {
                    ui.add_space(4.0);
                    let hist = &self.viz.cents_history;
                    let w = 430.0;
                    let h = 40.0;
                    let (rect, _) = ui.allocate_exact_size(egui::vec2(w, h), egui::Sense::hover());
                    let painter = ui.painter();
                    painter.rect_filled(rect, 2.0, egui::Color32::from_gray(30));
                    let n = hist.len().min(300) as f32;
                    for (i, &c) in hist.iter().rev().take(300).enumerate() {
                        let x = rect.min.x + (i as f32 / n) * w;
                        let y = rect.center().y - (c / 50.0) * (h / 2.0);
                        let y = y.clamp(rect.min.y, rect.max.y);
                        painter.circle_filled(egui::pos2(x, y), 1.0, egui::Color32::GREEN);
                    }
                }

                ui.add_space(10.0);
                egui::ComboBox::from_label("Tuning")
                    .selected_text(self.tunings[self.t_idx].name)
                    .show_ui(ui, |ui| {
                        for (i, t) in self.tunings.iter().enumerate() {
                            if ui.selectable_value(&mut self.t_idx, i, t.name).clicked() {
                                let t = self.tunings[self.t_idx].clone();
                                if let Ok(mut e) = self.engine.lock() {
                                    e.set_tuning(t);
                                }
                            }
                        }
                    });

                let mut tuning_changed = false;
                ui.collapsing("Edit current tuning", |ui| {
                    let tuning = &mut self.tunings[self.t_idx];
                    for s in &mut tuning.strings {
                        ui.horizontal(|ui| {
                            ui.label(format!("{} {}", s.name, s.octave));
                            if ui
                                .add(egui::Slider::new(&mut s.frequency, 20.0..=1200.0).text("Hz"))
                                .changed()
                            {
                                tuning_changed = true;
                            }
                        });
                    }
                });
                if tuning_changed {
                    let tuning = self.tunings[self.t_idx].clone();
                    if let Ok(mut engine) = self.engine.lock() {
                        engine.set_tuning(tuning);
                    }
                }

                if ui
                    .button(if self.ref_on {
                        "■ Stop Ref"
                    } else {
                        "▶ Play Ref"
                    })
                    .clicked()
                {
                    self.toggle_ref();
                }
                // Input device selection (delegated to AudioManager)
                ui.horizontal(|ui| {
                    ui.label("Input:");
                    if self.audio.input_devices.is_empty() && ui.button("Detect devices").clicked()
                    {
                        self.audio.refresh();
                    }

                    let prev_dev = self.audio.selected_input_device.clone();

                    egui::ComboBox::from_id_source("input_device")
                        .selected_text(
                            self.audio
                                .selected_input_device
                                .clone()
                                .unwrap_or_else(|| "Default".to_string()),
                        )
                        .show_ui(ui, |ui| {
                            ui.selectable_value(
                                &mut self.audio.selected_input_device,
                                None,
                                "Default (system)",
                            );
                            for name in &self.audio.input_devices {
                                let n = name.clone();
                                ui.selectable_value(
                                    &mut self.audio.selected_input_device,
                                    Some(n),
                                    name,
                                );
                            }
                        });

                    if self.audio.selected_input_device != prev_dev && self.listen {
                        // Hack: double-toggle to restart the cpal stream with new device.
                        // This is a smell (see recommendation.md). Should have explicit restart_mic().
                        self.toggle_mic(ctx); // stop current
                        self.toggle_mic(ctx); // start with new device
                    }

                    if ui.button("↻").clicked() {
                        self.audio.refresh();
                    }
                });

                if ui
                    .button(if self.listen { "Stop Mic" } else { "Start Mic" })
                    .clicked()
                {
                    self.toggle_mic(ctx);
                }

                if self.listen {
                    let dev_name = self
                        .audio
                        .selected_input_device
                        .clone()
                        .unwrap_or_else(|| "default".to_string());
                    ui.small(format!("Mic: {}", dev_name));
                }
                if ui.button("Play Random String (ear training)").clicked() {
                    self.play_random_string();
                }
                ui.checkbox(&mut self.spec, "Spectrum");
                ui.checkbox(&mut self.viz.show_spectrogram, "Spectrogram");

                if self.spec {
                    ui.add_space(4.0);
                    ui.label("Spectrum (FFT)");
                    let spec = &s.spectrum;
                    if !spec.is_empty() {
                        let max_bins = 200; // ~0-4300 Hz at 44.1kHz
                        let bar_width = 3.0; // integer-ish for crisp bars
                        let max_h = 80.0;
                        let total_w = max_bins as f32 * bar_width;
                        let (rect, _) = ui
                            .allocate_exact_size(egui::vec2(total_w, max_h), egui::Sense::hover());
                        let painter = ui.painter();
                        painter.rect_filled(rect, 2.0, egui::Color32::from_gray(30));
                        for (i, &mag) in spec.iter().enumerate().take(max_bins) {
                            let h = mag * max_h;
                            let x = (rect.min.x + i as f32 * bar_width).round();
                            let bw = bar_width - 1.0;
                            let bar_rect = egui::Rect::from_min_max(
                                egui::pos2(x, rect.max.y - h),
                                egui::pos2(x + bw, rect.max.y),
                            );
                            painter.rect_filled(
                                bar_rect,
                                0.0,
                                egui::Color32::from_rgb(80, 200, 120),
                            );
                            // subtle top highlight (no fat extrusion that blurs)
                            if h > 3.0 {
                                let top_rect = egui::Rect::from_min_max(
                                    egui::pos2(x, rect.max.y - h),
                                    egui::pos2(x + bw, rect.max.y - h + 1.5),
                                );
                                painter.rect_filled(
                                    top_rect,
                                    0.0,
                                    egui::Color32::from_rgb(134, 239, 172),
                                );
                            }
                        }

                        // Harmonics
                        if let Some(f) = s.freq {
                            // Use consistent sample rate (was hardcoded 44100, mismatched wasm feed at 48000)
                            let sr = PREFERRED_SAMPLE_RATE;
                            for harm in 2..=5 {
                                let hf = f * harm as f32;
                                let bin = ((hf / (sr / 2048.0)) as usize).min(max_bins - 1);
                                let x = (rect.min.x + bin as f32 * bar_width).round() + 0.5;
                                painter.vline(
                                    x,
                                    rect.y_range(),
                                    egui::Stroke::new(
                                        1.0_f32,
                                        egui::Color32::from_rgb(255, 220, 80),
                                    ),
                                );
                            }
                        }
                    }
                }

                if self.viz.show_spectrogram {
                    ui.add_space(4.0);
                    ui.label("Spectrogram");
                    let hist = &self.viz.spectrogram_history;
                    if !hist.is_empty() {
                        let time_steps = hist.len().min(150);
                        let freq_bins = 80; // limit for perf
                        let w = 430.0;
                        let h = 70.0;
                        let (rect, _) =
                            ui.allocate_exact_size(egui::vec2(w, h), egui::Sense::hover());
                        let painter = ui.painter();
                        painter.rect_filled(rect, 2.0, egui::Color32::from_gray(15));
                        let step_w = w / time_steps as f32;
                        let bin_h = h / freq_bins as f32;
                        for (t, frame) in hist.iter().enumerate() {
                            let x = rect.min.x + t as f32 * step_w;
                            for b in 0..freq_bins {
                                let val = *frame.get(b).unwrap_or(&0.0);
                                let y = rect.max.y - (b as f32 + 1.0) * bin_h;
                                let color = if val < 0.25 {
                                    egui::Color32::from_gray((val * 200.0) as u8)
                                } else if val < 0.5 {
                                    egui::Color32::from_rgb(0, (val * 220.0) as u8, 50)
                                } else if val < 0.75 {
                                    egui::Color32::from_rgb((val * 200.0) as u8, 200, 0)
                                } else {
                                    egui::Color32::from_rgb(255, (val * 180.0) as u8, 0)
                                };
                                let r = egui::Rect::from_min_size(
                                    egui::pos2(x, y),
                                    egui::vec2(step_w.max(0.8), bin_h),
                                );
                                painter.rect_filled(r, 0.0, color);
                            }
                        }
                    }
                }

                ui.add_space(6.0);
                ui.horizontal(|ui| {
                    ui.label("A4:");
                    if ui
                        .add(egui::Slider::new(&mut self.a4, 420.0..=460.0).text("Hz"))
                        .changed()
                    {
                        if let Ok(mut e) = self.engine.lock() {
                            e.set_a4(self.a4);
                        }
                    }
                });
                ui.label("YIN + smoothing + cpal output");
            });
        });
    }

    fn save(&mut self, storage: &mut dyn eframe::Storage) {
        storage.set_string("a4", self.a4.to_string());
        storage.set_string("t_idx", self.t_idx.to_string());
        storage.set_string("spec", self.spec.to_string());
        storage.set_string(
            "input_device",
            self.audio.selected_input_device.clone().unwrap_or_default(),
        );
        storage.set_string("show_spectrogram", self.viz.show_spectrogram.to_string());
    }
}

impl App {
    #[cfg(target_arch = "wasm32")]
    fn toggle_mic(&mut self, _ctx: &egui::Context) {
        self.listen = !self.listen;
        if !self.listen {
            self.viz.clear();
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    fn toggle_mic(&mut self, ctx: &egui::Context) {
        if self.listen {
            self.audio.stop_input();
            self.listen = false;
            if let Ok(mut e) = self.engine.lock() {
                e.reset();
            }
            self.viz.clear();
            return;
        }

        if self.audio.input_devices.is_empty() {
            self.audio.refresh();
        }

        let st = self.st.clone();
        let ctx2 = ctx.clone();
        let engine_for_worker = self.engine.clone();
        let h = cpal::default_host();

        let selected = self.audio.selected_input_device.as_ref().and_then(|name| {
            h.input_devices().ok().and_then(|mut devs| {
                devs.find(|dev| dev.name().map(|n| &n == name).unwrap_or(false))
            })
        });
        let d = match selected.or_else(|| h.default_input_device()) {
            Some(d) => d,
            None => {
                self.set_audio_error("No input device available".to_string());
                self.listen = false;
                return;
            }
        };

        let supported_config = match d.default_input_config() {
            Ok(config) => config,
            Err(e) => {
                self.set_audio_error(format!("Could not read input config: {e}"));
                self.listen = false;
                return;
            }
        };
        let sample_format = supported_config.sample_format();
        let cf: StreamConfig = supported_config.into();
        let sr = cf.sample_rate.0 as f32;
        let latest_window = Arc::new(Mutex::new(LatestAudioWindow::new(PITCH_WINDOW_SIZE)));
        let (runtime_error_tx, runtime_error_rx) = mpsc::channel::<String>();
        let running = self.audio.input_running.clone();
        let stream = match build_input_stream_for_format(
            &d,
            &cf,
            sample_format,
            sr,
            latest_window.clone(),
            runtime_error_tx,
            running.clone(),
        ) {
            Ok(s) => s,
            Err(e) => {
                self.set_audio_error(e);
                self.listen = false;
                return;
            }
        };

        let (worker_stop, worker_stop_rx) = mpsc::channel::<()>();
        let worker = thread::spawn(move || {
            run_input_worker(
                latest_window,
                runtime_error_rx,
                worker_stop_rx,
                engine_for_worker,
                st,
                ctx2,
                running,
            );
        });

        self.set_audio_error_clear();
        self.audio.input_running.store(true, Ordering::Release);
        if let Err(e) = stream.play() {
            self.audio.input_running.store(false, Ordering::Release);
            let _ = worker_stop.send(());
            let _ = worker.join();
            self.set_audio_error(format!("Could not start input stream: {e}"));
            self.listen = false;
            return;
        }
        self.audio.inp = Some(stream);
        self.audio.worker_stop = Some(worker_stop);
        self.audio.worker = Some(worker);
        self.listen = true;
    }

    #[cfg(not(target_arch = "wasm32"))]
    fn toggle_ref(&mut self) {
        if self.ref_on {
            self.audio.out = None;
            self.ref_on = false;
            return;
        }
        let Some(frequency) = self
            .tunings
            .get(self.t_idx)
            .and_then(|tuning| tuning.strings.first())
            .map(|string| string.frequency)
        else {
            self.set_audio_error("Current tuning has no strings".to_string());
            return;
        };
        self.audio.out = None;
        let stream = match create_output_tone(frequency) {
            Ok(stream) => stream,
            Err(error) => {
                self.set_audio_error(error);
                return;
            }
        };
        self.audio.out = Some(stream);
        self.ref_on = true;
    }

    #[cfg(not(target_arch = "wasm32"))]
    fn play_random_string(&mut self) {
        let Some(strings) = self.tunings.get(self.t_idx).map(|tuning| &tuning.strings) else {
            return;
        };
        if strings.is_empty() {
            self.set_audio_error("Current tuning has no strings".to_string());
            return;
        }
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let idx = (nanos % strings.len() as u128) as usize;
        let f = strings[idx].frequency;
        self.audio.out = None;
        self.ref_on = false;
        let stream = match create_output_tone(f) {
            Ok(stream) => stream,
            Err(error) => {
                self.set_audio_error(error);
                return;
            }
        };
        self.audio.out = Some(stream);
    }

    fn synchronize_engine_settings(&mut self) {
        if !self.a4.is_finite() || !(420.0..=460.0).contains(&self.a4) {
            self.a4 = 440.0;
        }
        if self.tunings.is_empty() {
            self.t_idx = 0;
            return;
        }
        self.t_idx = self.t_idx.min(self.tunings.len() - 1);
        if let Ok(mut engine) = self.engine.lock() {
            engine.set_a4(self.a4);
            engine.set_tuning(self.tunings[self.t_idx].clone());
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    fn set_audio_error(&self, error: String) {
        if let Ok(mut state) = self.st.lock() {
            state.audio_error = Some(error);
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    fn set_audio_error_clear(&self) {
        if let Ok(mut state) = self.st.lock() {
            state.audio_error = None;
        }
    }

    #[cfg(target_arch = "wasm32")]
    fn toggle_ref(&mut self) {
        self.ref_on = !self.ref_on;
    }

    #[cfg(target_arch = "wasm32")]
    fn play_random_string(&mut self) {
        // TODO: web audio version
    }
}

#[cfg(all(test, not(target_arch = "wasm32")))]
mod tests {
    use super::*;

    fn sine_buffer(frequency: f32, sample_rate: f32, len: usize) -> Vec<f32> {
        (0..len)
            .map(|index| {
                (2.0 * std::f32::consts::PI * frequency * index as f32 / sample_rate).sin()
            })
            .collect()
    }

    #[test]
    fn downmixes_each_interleaved_frame() {
        assert!((downmix_frame(&[1.0_f32, 0.0]) - 0.5).abs() < f32::EPSILON);
        assert!(downmix_frame(&[-0.25_f32, 0.25]).abs() < f32::EPSILON);
    }

    #[test]
    fn output_phase_advances_once_per_multichannel_frame() {
        let mut output = [0.0_f32; 8];
        let mut phase = 0.0;
        fill_tone_buffer(&mut output, 2, 12000.0, 48000.0, &mut phase);
        for frame in output.chunks_exact(2) {
            assert!((frame[0] - frame[1]).abs() < f32::EPSILON);
        }
        assert!((output[2] - 0.18).abs() < 1e-6);
        assert!(output[4].abs() < 1e-6);
        assert!((output[6] + 0.18).abs() < 1e-6);
        assert!(phase.abs() < f32::EPSILON);
    }

    #[test]
    fn restored_settings_are_clamped_and_applied_to_engine() {
        let mut app = App {
            t_idx: usize::MAX,
            a4: 442.0,
            ..App::default()
        };
        app.synchronize_engine_settings();
        assert_eq!(app.t_idx, app.tunings.len() - 1);

        app.t_idx = 1;
        app.synchronize_engine_settings();
        let tuning = app.tunings[app.t_idx].clone();
        let target = tuning.strings[0].frequency * (app.a4 / 440.0);
        let frame = app
            .engine
            .lock()
            .unwrap()
            .process(&sine_buffer(target, 48000.0, 4096), 48000.0);
        assert_eq!(
            frame.target.as_ref().map(|note| note.name),
            Some(tuning.strings[0].name)
        );
        assert!(frame.cents.abs() < 3.0, "cents was {}", frame.cents);

        app.a4 = f32::NAN;
        app.synchronize_engine_settings();
        assert_eq!(app.a4, 440.0);
    }

    #[test]
    fn visualization_history_records_each_audio_frame_once() {
        let mut viz = VizManager::default();
        let mut state = State {
            sequence: 1,
            cents: 3.0,
            spectrum: vec![0.5],
            ..State::default()
        };
        viz.record_frame(&state);
        viz.record_frame(&state);
        assert_eq!(viz.cents_history, vec![3.0]);
        assert_eq!(viz.spectrogram_history.len(), 1);

        state.sequence = 2;
        state.cents = 4.0;
        viz.record_frame(&state);
        assert_eq!(viz.cents_history, vec![3.0, 4.0]);
    }
}

// Free function for web audio feed (exported for JS)
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn feed_audio_samples(samples: &[f32]) {
    if samples.len() < 2048 {
        return;
    }
    let window = &samples[0..2048];
    let sr = PREFERRED_SAMPLE_RATE;

    let update = {
        if let Some(eng) = WEB_ENGINE.get() {
            if let Ok(mut engine) = eng.lock() {
                engine.process(window, sr)
            } else {
                TunerUpdate::default()
            }
        } else {
            TunerUpdate::default()
        }
    };

    if let Some(st) = WEB_STATE.get() {
        if let Ok(mut g) = st.lock() {
            g.sequence = g.sequence.wrapping_add(1);
            g.freq = update.freq;
            g.note = Some(update.note.clone());
            g.cents = update.cents;
            g.confidence = update.confidence;
            g.is_power = update.is_power;
            g.waveform = window.to_vec();
            g.level = update.level;
            if !update.spectrum.is_empty() {
                g.spectrum = update.spectrum.clone();
            }
        }
    }
}

#[cfg(not(target_arch = "wasm32"))]
fn main() -> eframe::Result<()> {
    let opt = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([700.0, 620.0])
            .with_min_inner_size([500.0, 550.0]),
        ..Default::default()
    };
    eframe::run_native(
        "Guitar Tuner (egui)",
        opt,
        Box::new(|cc| {
            let mut app = App::default();
            if let Some(storage) = cc.storage {
                if let Some(s) = storage.get_string("a4") {
                    if let Ok(v) = s.parse() {
                        app.a4 = v;
                    }
                }
                if let Some(s) = storage.get_string("t_idx") {
                    if let Ok(v) = s.parse() {
                        app.t_idx = v;
                    }
                }
                if let Some(s) = storage.get_string("spec") {
                    app.spec = s == "true";
                }
                if let Some(s) = storage.get_string("input_device") {
                    app.audio.selected_input_device = if s.is_empty() { None } else { Some(s) };
                }
                if let Some(s) = storage.get_string("show_spectrogram") {
                    app.viz.show_spectrogram = s == "true";
                }
            }
            app.synchronize_engine_settings();
            app.audio.refresh();
            Box::new(app)
        }),
    )
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen::prelude::wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();

    // init shared state for web audio feed
    let _ = WEB_ENGINE
        .get_or_init(|| std::sync::Arc::new(std::sync::Mutex::new(TunerEngine::new(440.0))));
    let _ = WEB_STATE.get_or_init(|| std::sync::Arc::new(std::sync::Mutex::new(State::default())));

    let web_options = eframe::WebOptions::default();
    wasm_bindgen_futures::spawn_local(async {
        let runner = eframe::WebRunner::new();
        runner
            .start(
                "the_canvas_id",
                web_options,
                Box::new(|_cc| {
                    let mut app = App::default();
                    if let Some(state) = WEB_STATE.get() {
                        app.st = state.clone();
                    }
                    if let Some(eng) = WEB_ENGINE.get() {
                        app.engine = eng.clone();
                    }
                    app.synchronize_engine_settings();
                    Box::new(app)
                }),
            )
            .await
            .expect("failed to start eframe");
    });
}

#[cfg(target_arch = "wasm32")]
fn main() {}
