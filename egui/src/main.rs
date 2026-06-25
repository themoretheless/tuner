use eframe::egui;

#[cfg(not(target_arch = "wasm32"))]
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
#[cfg(not(target_arch = "wasm32"))]
use cpal::{Stream, StreamConfig};

#[cfg(not(target_arch = "wasm32"))]
type AudioStream = Stream;
#[cfg(target_arch = "wasm32")]
type AudioStream = ();

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

use std::collections::VecDeque;
use std::sync::{Arc, Mutex};

use pitch_core::{
    compute_rms_volume, normalize_level,
    get_tunings, Tuning, TunerEngine, TunerUpdate,
};

#[cfg(target_arch = "wasm32")]
static WEB_ENGINE: std::sync::OnceLock<std::sync::Arc<std::sync::Mutex<TunerEngine>>> = std::sync::OnceLock::new();

#[cfg(target_arch = "wasm32")]
static WEB_STATE: std::sync::OnceLock<std::sync::Arc<std::sync::Mutex<State>>> = std::sync::OnceLock::new();

// Use shared Smoother from pitch-core
// (native Rust, no WASM)

#[derive(Clone, Default)]
struct State { 
    freq: Option<f32>, 
    note: Option<String>, 
    cents: f32,
    spectrum: Vec<f32>,  // magnitude spectrum, normalized 0..1
    level: f32, // input level 0..1
    confidence: f32,
    is_power: bool,
    waveform: Vec<f32>,
}

/// Extracted from god App to handle all audio input/output concerns.
/// Owns device enumeration, stream management (native cpal), and feeding samples (wasm).
struct AudioManager {
    input_devices: Vec<String>,
    selected_input_device: Option<String>,

    #[cfg(not(target_arch = "wasm32"))]
    inp: Option<Stream>,
    #[cfg(not(target_arch = "wasm32"))]
    out: Option<Stream>,
}

impl Default for AudioManager {
    fn default() -> Self {
        Self {
            input_devices: vec![],
            selected_input_device: None,
            #[cfg(not(target_arch = "wasm32"))]
            inp: None,
            #[cfg(not(target_arch = "wasm32"))]
            out: None,
        }
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

    // start_mic / toggle logic will be called from App with engine/st refs
    // wasm feed is on App or here
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
struct VizManager {
    cents_history: Vec<f32>,
    spectrogram_history: std::collections::VecDeque<Vec<f32>>,
    show_spectrogram: bool,
}

impl Default for VizManager {
    fn default() -> Self {
        Self {
            cents_history: vec![],
            spectrogram_history: std::collections::VecDeque::new(),
            show_spectrogram: false,
        }
    }
}

impl VizManager {
    fn clear(&mut self) {
        self.cents_history.clear();
        self.spectrogram_history.clear();
    }
}

impl Default for App {
    fn default() -> Self {
        Self {
            st: Arc::new(Mutex::new(State::default())),
            tunings: get_tunings(), t_idx:0, a4:440.0,
            listen:false, ref_on:false,
            engine: Arc::new(Mutex::new(TunerEngine::new(440.0))),
            spec:false,
            audio: AudioManager::default(),
            viz: VizManager::default(),
        }
    }
}

impl eframe::App for App {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        ctx.request_repaint();
        ctx.set_visuals(egui::Visuals::dark());

        let s = self.st.lock().unwrap().clone();

        self.viz.cents_history.push(s.cents);
        if self.viz.cents_history.len() > 300 {
            self.viz.cents_history.remove(0);
        }

        if !s.spectrum.is_empty() {
            self.viz.spectrogram_history.push_back(s.spectrum.clone());
            if self.viz.spectrogram_history.len() > 150 {
                self.viz.spectrogram_history.pop_front();
            }
        }

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
                if let Some(f) = s.freq { ui.label(format!("{:.1} Hz", f)); }
                ui.label(format!("{:.1} ¢  conf {:.0}%", s.cents, s.confidence * 100.0));
                if s.is_power { ui.label(egui::RichText::new("power chord").small()); }

                // input level
                ui.add(egui::ProgressBar::new(s.level).text("Input level").desired_width(200.0));

                // Basic waveform (port in progress)
                if !s.waveform.is_empty() {
                    ui.add_space(4.0);
                    let w = 430.0; let h = 30.0;
                    let (rect, _) = ui.allocate_exact_size(egui::vec2(w, h), egui::Sense::hover());
                    let painter = ui.painter();
                    painter.rect_filled(rect, 2.0, egui::Color32::from_gray(30));
                    let n = s.waveform.len() as f32;
                    for (i, &v) in s.waveform.iter().enumerate() {
                        let x = rect.min.x + (i as f32 / n) * w;
                        let y = rect.center().y - v * (h / 2.0) * 2.0;
                        let y = y.clamp(rect.min.y, rect.max.y);
                        painter.circle_filled(egui::pos2(x, y), 0.5, egui::Color32::from_rgb(100, 200, 150));
                    }
                }

                let w=430.0; let r=ui.allocate_exact_size(egui::vec2(w,18.0),egui::Sense::hover()).0;
                let p=ui.painter(); p.rect_filled(r,4.0,egui::Color32::from_gray(48));
                let cx=r.center().x; let px=(cx + s.cents/50.0*w*0.5).clamp(r.min.x,r.max.x);
                p.circle_filled(egui::pos2(px,r.center().y),7.0, if s.cents.abs()<5.0 {egui::Color32::GREEN} else {egui::Color32::RED});

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
                egui::ComboBox::from_label("Tuning").selected_text(self.tunings[self.t_idx].name)
                    .show_ui(ui, |ui|{
                        for (i,t) in self.tunings.iter().enumerate() {
                            if ui.selectable_value(&mut self.t_idx, i, t.name).clicked() {
                                let t = self.tunings[self.t_idx].clone();
                                if let Ok(mut e) = self.engine.lock() { e.set_tuning(t); }
                            }
                        }
                    });

                ui.collapsing("Edit current tuning", |ui| {
                    let tuning = &mut self.tunings[self.t_idx];
                    for s in &mut tuning.strings {
                        ui.horizontal(|ui| {
                            ui.label(format!("{} {}", s.name, s.octave));
                            if ui.add(egui::Slider::new(&mut s.frequency, 40.0..=400.0).text("Hz")).changed() {
                                if let Ok(mut e) = self.engine.lock() { e.reset(); }
                            }
                        });
                    }
                });

                if ui.button(if self.ref_on {"■ Stop Ref"} else {"▶ Play Ref"}).clicked() { self.toggle_ref(); }
                // Input device selection (delegated to AudioManager)
                ui.horizontal(|ui| {
                    ui.label("Input:");
                    if self.audio.input_devices.is_empty() && ui.button("Detect devices").clicked() {
                        self.audio.refresh();
                    }

                    let prev_dev = self.audio.selected_input_device.clone();

                    egui::ComboBox::from_id_source("input_device")
                        .selected_text(
                            self.audio.selected_input_device.clone().unwrap_or_else(|| "Default".to_string())
                        )
                        .show_ui(ui, |ui| {
                            ui.selectable_value(&mut self.audio.selected_input_device, None, "Default (system)");
                            for name in &self.audio.input_devices {
                                let n = name.clone();
                                ui.selectable_value(&mut self.audio.selected_input_device, Some(n), name);
                            }
                        });

                    if self.audio.selected_input_device != prev_dev && self.listen {
                        self.toggle_mic(ctx);
                        self.toggle_mic(ctx);
                    }

                    if ui.button("↻").clicked() {
                        self.audio.refresh();
                    }
                });

                if ui.button(if self.listen {"Stop Mic"} else {"Start Mic"}).clicked() { self.toggle_mic(ctx); }

                if self.listen {
                    let dev_name = self.audio.selected_input_device.clone().unwrap_or_else(|| "default".to_string());
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
                        let (rect, _) = ui.allocate_exact_size(egui::vec2(total_w, max_h), egui::Sense::hover());
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
                            painter.rect_filled(bar_rect, 0.0, egui::Color32::from_rgb(80, 200, 120));
                            // subtle top highlight (no fat extrusion that blurs)
                            if h > 3.0 {
                                let top_rect = egui::Rect::from_min_max(
                                    egui::pos2(x, rect.max.y - h),
                                    egui::pos2(x + bw, rect.max.y - h + 1.5),
                                );
                                painter.rect_filled(top_rect, 0.0, egui::Color32::from_rgb(134, 239, 172));
                            }
                        }

                        // Harmonics
                        if let Some(f) = s.freq {
                            let sr = 44100.0;
                            for harm in 2..=5 {
                                let hf = f * harm as f32;
                                let bin = ((hf / (sr / 2048.0)) as usize).min(max_bins - 1);
                                let x = (rect.min.x + bin as f32 * bar_width).round() + 0.5;
                                painter.vline(
                                    x,
                                    rect.y_range(),
                                    egui::Stroke::new(1.0_f32, egui::Color32::from_rgb(255, 220, 80)),
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
                        let (rect, _) = ui.allocate_exact_size(egui::vec2(w, h), egui::Sense::hover());
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
                    if ui.add(egui::Slider::new(&mut self.a4, 420.0..=460.0).text("Hz")).changed() {
                        if let Ok(mut e) = self.engine.lock() { e.set_a4(self.a4); }
                    }
                });
                ui.label(format!("YIN + smoothing + cpal output"));
            });
        });
    }

    fn save(&mut self, storage: &mut dyn eframe::Storage) {
        storage.set_string("a4", self.a4.to_string());
        storage.set_string("t_idx", self.t_idx.to_string());
        storage.set_string("spec", self.spec.to_string());
        storage.set_string("input_device", self.audio.selected_input_device.clone().unwrap_or_default());
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
    fn toggle_mic(&mut self, ctx:&egui::Context) {
        if self.listen {
            self.audio.inp = None;
            self.listen = false;
            if let Ok(mut e) = self.engine.lock() { e.reset(); }
            self.viz.clear();
            return;
        }

        if self.audio.input_devices.is_empty() {
            self.audio.refresh();
        }

        let st=self.st.clone(); let ctx2=ctx.clone();
        let engine_for_cb = self.engine.clone();
        let h=cpal::default_host();

        let selected = self.audio.selected_input_device.as_ref().and_then(|name| {
            h.input_devices().ok().and_then(|mut devs| {
                devs.find(|dev| dev.name().map(|n| &n == name).unwrap_or(false))
            })
        });
        let d = match selected.or_else(|| h.default_input_device()) {
            Some(d) => d,
            None => { eprintln!("[mic] no input device available"); self.listen = false; return; }
        };

        let cf: StreamConfig = match d.default_input_config() {
            Ok(c) => c.into(),
            Err(e) => { eprintln!("[mic] no input config: {}", e); self.listen = false; return; }
        };
        let sr = cf.sample_rate.0 as f32;
        let mut b:Vec<f32>=vec![];
        let stream = match d.build_input_stream(&cf, move |d:&[f32],_|{
            b.extend_from_slice(d); if b.len()>4096 { b.drain(..b.len()-2048); }
            if b.len()>=2048 {
                let window = &b[b.len()-2048..];

                // Drive through shared engine
                let update = {
                    if let Ok(mut eng) = engine_for_cb.lock() {
                        eng.process(window, sr)
                    } else {
                        TunerUpdate::default()
                    }
                };

                // Single lock + single repaint per frame (was 3x lock, 3x repaint).
                // Reuse the waveform Vec capacity instead of reallocating each callback.
                if let Ok(mut g)=st.lock() {
                    g.freq = update.freq;
                    g.cents = update.cents;
                    g.confidence = update.confidence;
                    g.is_power = update.is_power;
                    g.level = normalize_level(update.rms);
                    g.note = Some(update.note);
                    g.waveform.clear();
                    g.waveform.extend_from_slice(window);
                    if !update.spectrum.is_empty() {
                        g.spectrum = update.spectrum;
                    }
                }
                ctx2.request_repaint();
            }
        }, |e|eprintln!("{}",e), None) {
            Ok(s) => s,
            Err(e) => { eprintln!("[mic] build input stream failed: {}", e); self.listen = false; return; }
        };
        if let Err(e) = stream.play() {
            eprintln!("[mic] stream play failed: {}", e); self.listen = false; return;
        }
        self.audio.inp = Some(stream); self.listen = true;
    }

    #[cfg(not(target_arch = "wasm32"))]
    fn toggle_ref(&mut self) {
        if self.ref_on { self.audio.out=None; self.ref_on=false; return; }
        let f = self.tunings[self.t_idx].strings[0].frequency;
        let h=cpal::default_host();
        let d = match h.default_output_device() {
            Some(d) => d,
            None => { eprintln!("[ref] no output device"); return; }
        };
        let cf:StreamConfig = match d.default_output_config() {
            Ok(c) => c.into(),
            Err(e) => { eprintln!("[ref] no output config: {}", e); return; }
        };
        let sr=cf.sample_rate.0 as f32;
        let mut ph=0.0f32;
        let s = match d.build_output_stream(&cf, move |data:&mut [f32],_| {
            for s in data { *s = (2.0*std::f32::consts::PI*f*ph/sr).sin()*0.18; ph=(ph+1.0)%sr; }
        }, |e|eprintln!("{}",e), None) {
            Ok(s) => s,
            Err(e) => { eprintln!("[ref] build output stream failed: {}", e); return; }
        };
        if let Err(e) = s.play() { eprintln!("[ref] play failed: {}", e); return; }
        self.audio.out=Some(s); self.ref_on=true;
    }

    #[cfg(not(target_arch = "wasm32"))]
    fn play_random_string(&mut self) {
        let strings = &self.tunings[self.t_idx].strings;
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let idx = (nanos % strings.len() as u128) as usize;
        let f = strings[idx].frequency;
        // stop previous
        self.audio.out = None;
        let h=cpal::default_host();
        let d = match h.default_output_device() {
            Some(d) => d,
            None => { eprintln!("[random] no output device"); return; }
        };
        let cf:StreamConfig = match d.default_output_config() {
            Ok(c) => c.into(),
            Err(e) => { eprintln!("[random] no output config: {}", e); return; }
        };
        let sr=cf.sample_rate.0 as f32;
        let mut ph=0.0f32;
        let s = match d.build_output_stream(&cf, move |data:&mut [f32],_| {
            for s in data { *s = (2.0*std::f32::consts::PI*f*ph/sr).sin()*0.18; ph=(ph+1.0)%sr; }
        }, |e|eprintln!("{}",e), None) {
            Ok(s) => s,
            Err(e) => { eprintln!("[random] build output stream failed: {}", e); return; }
        };
        if let Err(e) = s.play() { eprintln!("[random] play failed: {}", e); return; }
        self.audio.out=Some(s);
        // auto stop after 1.5s
        let out_clone = self.audio.out.take(); // to stop later? simple, let it drop after timeout but for simplicity keep short
        // For simplicity, let user stop or add timer later
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

// Free function for web audio feed (exported for JS)
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn feed_audio_samples(samples: &[f32]) {
    if samples.len() < 2048 {
        return;
    }
    let window = &samples[0..2048];
    let sr = 48000.0;

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
            g.freq = update.freq;
            g.note = Some(update.note.clone());
            g.cents = update.cents;
            g.confidence = update.confidence;
            g.is_power = update.is_power;
            g.waveform = window.to_vec();
            g.level = normalize_level(update.rms);
            if !update.spectrum.is_empty() {
                g.spectrum = update.spectrum.clone();
            }
        }
    }
}



#[cfg(not(target_arch = "wasm32"))]
fn main() -> eframe::Result<()> {
    let opt = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default().with_inner_size([700.0, 620.0]).with_min_inner_size([500.0, 550.0]),
        ..Default::default()
    };
    eframe::run_native("Guitar Tuner (egui)", opt, Box::new(|cc| {
        let mut app = App::default();
        if let Some(storage) = cc.storage {
            if let Some(s) = storage.get_string("a4") {
                if let Ok(v) = s.parse() { app.a4 = v; }
            }
            if let Some(s) = storage.get_string("t_idx") {
                if let Ok(v) = s.parse() { app.t_idx = v; }
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
        app.audio.refresh();
        Box::new(app)
    }))
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen::prelude::wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();

    // init shared state for web audio feed
    let _ = WEB_ENGINE.get_or_init(|| {
        std::sync::Arc::new(std::sync::Mutex::new(TunerEngine::new(440.0)))
    });
    let _ = WEB_STATE.get_or_init(|| {
        std::sync::Arc::new(std::sync::Mutex::new(State::default()))
    });

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
                    Box::new(app)
                }),
            )
            .await
            .expect("failed to start eframe");
    });
}

#[cfg(target_arch = "wasm32")]
fn main() {}