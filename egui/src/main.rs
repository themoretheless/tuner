use eframe::egui;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Stream, StreamConfig};
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use rustfft::{FftPlanner, num_complex::Complex};
use pitch_core::{detect_pitch_native, is_likely_power_chord_native};

const A4: f32 = 440.0;
const NOTE_NAMES: [&str; 12] = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

#[derive(Clone)]
struct Note { name: &'static str, octave: i32, frequency: f32 }
#[derive(Clone)]
struct Tuning { name: &'static str, strings: Vec<Note> }

fn get_tunings() -> Vec<Tuning> {
    vec![
        Tuning { name: "Standard (EADGBE)", strings: vec![
            Note{name:"E",octave:2,frequency:82.41}, Note{name:"A",octave:2,frequency:110.0},
            Note{name:"D",octave:3,frequency:146.83}, Note{name:"G",octave:3,frequency:196.0},
            Note{name:"B",octave:3,frequency:246.94}, Note{name:"E",octave:4,frequency:329.63},
        ]},
        Tuning { name: "Drop D", strings: vec![
            Note{name:"D",octave:2,frequency:73.42}, Note{name:"A",octave:2,frequency:110.0},
            Note{name:"D",octave:3,frequency:146.83}, Note{name:"G",octave:3,frequency:196.0},
            Note{name:"B",octave:3,frequency:246.94}, Note{name:"E",octave:4,frequency:329.63},
        ]},
        Tuning { name: "DADGAD", strings: vec![
            Note{name:"D",octave:2,frequency:73.42}, Note{name:"A",octave:2,frequency:110.0},
            Note{name:"D",octave:3,frequency:146.83}, Note{name:"G",octave:3,frequency:196.0},
            Note{name:"A",octave:3,frequency:220.0}, Note{name:"D",octave:4,frequency:293.66},
        ]},
        Tuning { name: "Open G", strings: vec![
            Note{name:"D",octave:2,frequency:73.42}, Note{name:"G",octave:2,frequency:98.0},
            Note{name:"D",octave:3,frequency:146.83}, Note{name:"G",octave:3,frequency:196.0},
            Note{name:"B",octave:3,frequency:246.94}, Note{name:"D",octave:4,frequency:293.66},
        ]},
        Tuning { name: "Drop C", strings: vec![
            Note{name:"C",octave:2,frequency:65.41}, Note{name:"G",octave:2,frequency:98.0},
            Note{name:"C",octave:3,frequency:130.81}, Note{name:"F",octave:3,frequency:174.61},
            Note{name:"A",octave:3,frequency:220.0}, Note{name:"D",octave:4,frequency:293.66},
        ]},
    ]
}

fn frequency_to_note(freq: f32, a4: f32) -> (String, f32) {
    if freq < 20.0 { return ("—".to_string(), 0.0); }
    let midi = 69.0 + 12.0 * (freq / a4).log2();
    let r = midi.round() as i32;
    let idx = ((r % 12 + 12) % 12) as usize;
    let oct = r / 12 - 1;
    let target = a4 * 2f32.powf((r - 69) as f32 / 12.0);
    let cents = 1200.0 * (freq / target).log2();
    (format!("{}{}", NOTE_NAMES[idx], oct), cents)
}

struct Smoother { ema: Option<f32>, hist: Vec<f32>, alpha: f32, maxh: usize }
impl Smoother { 
    fn new() -> Self { Self{ema:None, hist:vec![], alpha:0.35, maxh:6} }
    fn add(&mut self, f: Option<f32>) -> Option<f32> {
        if let Some(v) = f { 
            self.ema = Some(self.ema.map_or(v, |e| self.alpha*v + (1.0-self.alpha)*e));
            if let Some(e) = self.ema { self.hist.push(e); if self.hist.len()>self.maxh {self.hist.remove(0);} }
        }
        if self.hist.is_empty() { return self.ema; }
        let mut s = self.hist.clone(); s.sort_by(|a,b|a.partial_cmp(b).unwrap());
        let m = s.len()/2; Some(if s.len()%2==1 {s[m]} else {(s[m-1]+s[m])*0.5})
    }
    fn reset(&mut self){self.ema=None; self.hist.clear();}
}

#[derive(Clone, Default)]
struct State { 
    freq: Option<f32>, 
    note: Option<String>, 
    cents: f32,
    spectrum: Vec<f32>,  // magnitude spectrum, normalized 0..1
    level: f32, // input level 0..1
    confidence: f32,
    is_power: bool,
}

struct App {
    st: Arc<Mutex<State>>,
    tunings: Vec<Tuning>,
    t_idx: usize,
    a4: f32,
    listen: bool,
    inp: Option<Stream>,
    out: Option<Stream>,
    ref_on: bool,
    sm: Smoother,
    hist: VecDeque<f32>,
    spec: bool,

}

impl Default for App {
    fn default() -> Self {
        Self {
            st: Arc::new(Mutex::new(State::default())),
            tunings: get_tunings(), t_idx:0, a4:440.0,
            listen:false, inp:None, out:None, ref_on:false,
            sm: Smoother::new(), hist: VecDeque::with_capacity(80), spec:false,
        }
    }
}

impl eframe::App for App {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        let s = self.st.lock().unwrap().clone();

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

                let w=430.0; let r=ui.allocate_exact_size(egui::vec2(w,18.0),egui::Sense::hover()).0;
                let p=ui.painter(); p.rect_filled(r,4.0,egui::Color32::from_gray(48));
                let cx=r.center().x; let px=(cx + s.cents/50.0*w*0.5).clamp(r.min.x,r.max.x);
                p.circle_filled(egui::pos2(px,r.center().y),7.0, if s.cents.abs()<5.0 {egui::Color32::GREEN} else {egui::Color32::RED});

                if !self.hist.is_empty() {
                    ui.add_space(4.0);
                    ui.label(format!("Recent deviation: {:.1} ¢", self.hist.back().unwrap_or(&0.0)));
                }

                ui.add_space(10.0);
                egui::ComboBox::from_label("Tuning").selected_text(self.tunings[self.t_idx].name)
                    .show_ui(ui, |ui|{
                        for (i,t) in self.tunings.iter().enumerate() {
                            if ui.selectable_value(&mut self.t_idx, i, t.name).clicked() { self.sm.reset(); }
                        }
                    });

                ui.collapsing("Edit current tuning", |ui| {
                    let tuning = &mut self.tunings[self.t_idx];
                    for s in &mut tuning.strings {
                        ui.horizontal(|ui| {
                            ui.label(format!("{} {}", s.name, s.octave));
                            if ui.add(egui::Slider::new(&mut s.frequency, 40.0..=400.0).text("Hz")).changed() {
                                self.sm.reset();
                            }
                        });
                    }
                });

                if ui.button(if self.ref_on {"■ Stop Ref"} else {"▶ Play Ref"}).clicked() { self.toggle_ref(); }
                if ui.button(if self.listen {"Stop Mic"} else {"Start Mic"}).clicked() { self.toggle_mic(ctx); }
                if ui.button("Play Random String (ear training)").clicked() {
                    self.play_random_string();
                }
                ui.checkbox(&mut self.spec, "Spectrum");

                if self.spec {
                    ui.add_space(4.0);
                    ui.label("Spectrum (FFT)");
                    let spec = &s.spectrum;
                    if !spec.is_empty() {
                        let max_bins = 200; // ~0-4300 Hz at 44.1kHz
                        let bar_width = 2.5;
                        let max_h = 80.0;
                        let total_w = max_bins as f32 * bar_width;
                        let (rect, _) = ui.allocate_exact_size(egui::vec2(total_w, max_h), egui::Sense::hover());
                        let painter = ui.painter();
                        painter.rect_filled(rect, 2.0, egui::Color32::from_gray(30));
                        for (i, &mag) in spec.iter().enumerate().take(max_bins) {
                            let h = mag * max_h;
                            let x = rect.min.x + i as f32 * bar_width;
                            let bar_rect = egui::Rect::from_min_max(
                                egui::pos2(x, rect.max.y - h),
                                egui::pos2(x + bar_width - 0.5, rect.max.y),
                            );
                            painter.rect_filled(bar_rect, 0.0, egui::Color32::from_rgb(80, 200, 120));
                        }
                    }
                }

                ui.add_space(6.0);
                ui.horizontal(|ui| {
                    ui.label("A4:");
                    if ui.add(egui::Slider::new(&mut self.a4, 420.0..=460.0).text("Hz")).changed() {
                        self.sm.reset();
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
    }
}

impl App {
    fn toggle_mic(&mut self, ctx:&egui::Context) {
        if self.listen { self.inp=None; self.listen=false; self.sm.reset(); return; }
        let st=self.st.clone(); let ctx2=ctx.clone(); let a4=self.a4;
        let h=cpal::default_host(); let d=h.default_input_device().expect("no mic");
        let cf:StreamConfig = d.default_input_config().unwrap().into(); let sr = cf.sample_rate.0 as f32;
        let mut b:Vec<f32>=vec![];
        let mut fft_planner = FftPlanner::new();
        let fft = fft_planner.plan_fft_forward(2048);
        let mut spectrum_buffer: Vec<Complex<f32>> = vec![Complex::new(0.0, 0.0); 2048];
        let s = d.build_input_stream(&cf, move |d:&[f32],_|{
            b.extend_from_slice(d); if b.len()>4096 { b.drain(..b.len()-2048); }
            if b.len()>=2048 {
                let window = &b[b.len()-2048..];
                if let Some((f, conf)) = detect_pitch_native(window, sr) {
                    let (n, cc) = frequency_to_note(f, a4);
                    let power = is_likely_power_chord_native(window, sr, f);
                    if let Ok(mut g)=st.lock() { g.freq=Some(f); g.note=Some(n); g.cents=cc; g.confidence = conf; g.is_power = power; }
                    ctx2.request_repaint();
                }
                // input level
                let rms: f32 = window.iter().map(|&x| x*x).sum::<f32>().sqrt() / window.len() as f32;
                let level = (rms * 12.0).clamp(0.0, 1.0);
                if let Ok(mut g)=st.lock() { g.level = level; ctx2.request_repaint(); }
                // Compute FFT spectrum occasionally
                if b.len() % 512 == 0 {  // every ~ few frames
                    for (i, &sample) in window.iter().enumerate() {
                        spectrum_buffer[i] = Complex::new(sample * 0.5, 0.0); // windowing simple
                    }
                    fft.process(&mut spectrum_buffer);
                    let mut mags = vec![0.0f32; 512]; // take first half, downsample
                    for i in 0..512 {
                        let re = spectrum_buffer[i].re;
                        let im = spectrum_buffer[i].im;
                        mags[i] = (re*re + im*im).sqrt();
                    }
                    // normalize
                    let max_mag = mags.iter().cloned().fold(0.0, f32::max).max(1e-6);
                    for m in &mut mags { *m /= max_mag; }
                    if let Ok(mut g) = st.lock() {
                        g.spectrum = mags;
                    }
                    ctx2.request_repaint();
                }
            }
        }, |e|eprintln!("{}",e), None).unwrap();
        s.play().unwrap(); self.inp=Some(s); self.listen=true;
    }

    fn toggle_ref(&mut self) {
        if self.ref_on { self.out=None; self.ref_on=false; return; }
        let f = self.tunings[self.t_idx].strings[0].frequency;
        let h=cpal::default_host(); let d=h.default_output_device().expect("no speaker");
        let cf:StreamConfig = d.default_output_config().unwrap().into(); let sr=cf.sample_rate.0 as f32;
        let mut ph=0.0f32;
        let s = d.build_output_stream(&cf, move |data:&mut [f32],_| {
            for s in data { *s = (2.0*std::f32::consts::PI*f*ph/sr).sin()*0.18; ph=(ph+1.0)%sr; }
        }, |e|eprintln!("{}",e), None).unwrap();
        s.play().unwrap(); self.out=Some(s); self.ref_on=true;
    }

    fn play_random_string(&mut self) {
        let strings = &self.tunings[self.t_idx].strings;
        let idx = (std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos() % strings.len() as u128) as usize;
        let f = strings[idx].frequency;
        // stop previous
        self.out = None;
        let h=cpal::default_host(); let d=h.default_output_device().expect("no speaker");
        let cf:StreamConfig = d.default_output_config().unwrap().into(); let sr=cf.sample_rate.0 as f32;
        let mut ph=0.0f32;
        let s = d.build_output_stream(&cf, move |data:&mut [f32],_| {
            for s in data { *s = (2.0*std::f32::consts::PI*f*ph/sr).sin()*0.18; ph=(ph+1.0)%sr; }
        }, |e|eprintln!("{}",e), None).unwrap();
        s.play().unwrap(); self.out=Some(s);
        // auto stop after 1.5s
        let out_clone = self.out.take(); // to stop later? simple, let it drop after timeout but for simplicity keep short
        // For simplicity, let user stop or add timer later
    }
}

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
        }
        Box::new(app)
    }))
}