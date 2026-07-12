use crate::audio::AudioManager;
use crate::state::{SharedTunerState, TunerViewState};
use crate::visualization::VisualizationHistory;
use eframe::egui;
use pitch_core::{format_freq, get_note_display, get_tunings, EngineConfig, TunerEngine, Tuning};
use std::sync::{Arc, Mutex};

pub(crate) struct App {
    a4: f32,
    audio: AudioManager,
    engine: Arc<Mutex<TunerEngine>>,
    listening: bool,
    show_spectrum: bool,
    state: SharedTunerState,
    tuning_index: usize,
    tunings: Vec<Tuning>,
    visualization: VisualizationHistory,
}

impl Default for App {
    fn default() -> Self {
        Self {
            a4: 440.0,
            audio: AudioManager::default(),
            engine: Arc::new(Mutex::new(TunerEngine::with_config(EngineConfig {
                spectrum_bins: 0,
                ..EngineConfig::default()
            }))),
            listening: false,
            show_spectrum: false,
            state: Arc::new(Mutex::new(TunerViewState::default())),
            tuning_index: 0,
            tunings: get_tunings(),
            visualization: VisualizationHistory::default(),
        }
    }
}

impl App {
    #[cfg(not(target_arch = "wasm32"))]
    pub(crate) fn restore(&mut self, storage: Option<&dyn eframe::Storage>) {
        let Some(storage) = storage else { return };
        self.a4 = parse_or(storage, "a4", self.a4).clamp(420.0, 460.0);
        self.tuning_index = parse_or(storage, "tuning_index", parse_or(storage, "t_idx", 0_usize))
            .min(self.tunings.len().saturating_sub(1));
        self.show_spectrum = parse_bool(storage, "show_spectrum") || parse_bool(storage, "spec");
        self.visualization.show_spectrogram = parse_bool(storage, "show_spectrogram");
        self.audio.selected_input_device = storage
            .get_string("input_device")
            .filter(|name| !name.is_empty());
        if let Ok(mut engine) = self.engine.lock() {
            engine.set_a4(self.a4);
            if let Some(tuning) = self.tunings.get(self.tuning_index).cloned() {
                engine.set_tuning(tuning);
            }
            engine.set_spectrum_enabled(self.show_spectrum || self.visualization.show_spectrogram);
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    pub(crate) fn refresh_devices(&mut self) {
        self.audio.refresh();
    }

    #[cfg(target_arch = "wasm32")]
    pub(crate) fn use_shared_state(
        &mut self,
        state: SharedTunerState,
        engine: Arc<Mutex<TunerEngine>>,
    ) {
        self.state = state;
        self.engine = engine;
        if let Ok(mut engine) = self.engine.lock() {
            engine.set_spectrum_enabled(self.show_spectrum || self.visualization.show_spectrogram);
        }
    }

    fn toggle_mic(&mut self, context: &egui::Context) {
        if self.listening {
            self.audio.stop_input();
            self.listening = false;
            self.visualization.clear();
            if let Ok(mut engine) = self.engine.lock() {
                engine.reset();
            }
            if let Ok(mut state) = self.state.lock() {
                state.clear_detection();
            }
            return;
        }

        if self.audio.input_devices.is_empty() {
            self.audio.refresh();
        }
        match self
            .audio
            .start_input(self.state.clone(), self.engine.clone(), context.clone())
        {
            Ok(()) => self.listening = true,
            Err(error) => {
                if let Ok(mut state) = self.state.lock() {
                    state.error = Some(error);
                }
            }
        }
    }

    fn restart_mic(&mut self, context: &egui::Context) {
        if !self.listening {
            return;
        }
        self.audio.stop_input();
        self.listening = false;
        self.toggle_mic(context);
    }

    fn toggle_reference_tone(&mut self) {
        if self.audio_is_playing_tone() {
            self.audio.stop_tone();
            return;
        }
        let Some(frequency) = self
            .tunings
            .get(self.tuning_index)
            .and_then(|tuning| tuning.strings.first())
            .map(|note| note.frequency)
        else {
            return;
        };
        self.play_tone(frequency);
    }

    fn play_random_string(&mut self) {
        let Some(strings) = self
            .tunings
            .get(self.tuning_index)
            .map(|tuning| tuning.strings.as_slice())
            .filter(|strings| !strings.is_empty())
        else {
            return;
        };
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        self.play_tone(strings[nanos as usize % strings.len()].frequency);
    }

    fn play_tone(&mut self, frequency: f32) {
        if let Err(error) = self.audio.play_tone(frequency) {
            if let Ok(mut state) = self.state.lock() {
                state.error = Some(error);
            }
        }
    }

    fn audio_is_playing_tone(&self) -> bool {
        self.audio.is_tone_playing()
    }

    fn handle_shortcuts(&mut self, context: &egui::Context) {
        if context
            .input(|input| input.key_pressed(egui::Key::Space) || input.key_pressed(egui::Key::M))
        {
            self.toggle_mic(context);
        }
        if context.input(|input| input.key_pressed(egui::Key::R)) {
            self.toggle_reference_tone();
        }
    }

    fn draw_header(&self, ui: &mut egui::Ui, state: &TunerViewState) {
        ui.heading("Guitar Tuner");
        ui.label(
            egui::RichText::new(state.note.as_deref().unwrap_or("—"))
                .size(72.0)
                .strong(),
        );
        if let Some(frequency) = state.frequency {
            ui.label(format!("{} Hz", format_freq(frequency)));
        }
        ui.label(format!(
            "{:.1} cents  ·  confidence {:.0}%",
            state.cents,
            state.confidence * 100.0,
        ));
        if state.is_power {
            ui.small("Power chord detected");
        }
        ui.add(
            egui::ProgressBar::new(state.level)
                .text("Input level")
                .desired_width(ui.available_width().min(260.0)),
        );
        if let Some(error) = &state.error {
            ui.colored_label(egui::Color32::from_rgb(248, 113, 113), error);
        }
    }

    fn draw_controls(&mut self, ui: &mut egui::Ui, context: &egui::Context) {
        let previous_tuning = self.tuning_index;
        egui::ComboBox::from_label("Tuning")
            .selected_text(
                self.tunings
                    .get(self.tuning_index)
                    .map(|tuning| tuning.name)
                    .unwrap_or("Unknown"),
            )
            .show_ui(ui, |ui| {
                for (index, tuning) in self.tunings.iter().enumerate() {
                    ui.selectable_value(&mut self.tuning_index, index, tuning.name);
                }
            });
        if self.tuning_index != previous_tuning {
            if let (Some(tuning), Ok(mut engine)) = (
                self.tunings.get(self.tuning_index).cloned(),
                self.engine.lock(),
            ) {
                engine.set_tuning(tuning);
            }
        }

        ui.collapsing("Edit current tuning", |ui| {
            let Some(tuning) = self.tunings.get_mut(self.tuning_index) else {
                return;
            };
            let mut changed = false;
            for string in &mut tuning.strings {
                ui.horizontal(|ui| {
                    ui.label(get_note_display(string));
                    changed |= ui
                        .add(egui::Slider::new(&mut string.frequency, 20.0..=1_200.0).text("Hz"))
                        .changed();
                });
            }
            if changed {
                if let Ok(mut engine) = self.engine.lock() {
                    engine.set_tuning(tuning.clone());
                }
            }
        });

        ui.horizontal(|ui| {
            ui.label("Input");
            let previous = self.audio.selected_input_device.clone();
            egui::ComboBox::from_id_source("input_device")
                .selected_text(
                    self.audio
                        .selected_input_device
                        .as_deref()
                        .unwrap_or("System default"),
                )
                .show_ui(ui, |ui| {
                    ui.selectable_value(
                        &mut self.audio.selected_input_device,
                        None,
                        "System default",
                    );
                    for name in &self.audio.input_devices {
                        ui.selectable_value(
                            &mut self.audio.selected_input_device,
                            Some(name.clone()),
                            name,
                        );
                    }
                });
            if ui.button("Refresh").clicked() {
                self.audio.refresh();
            }
            if self.audio.selected_input_device != previous {
                self.restart_mic(context);
            }
        });

        ui.horizontal(|ui| {
            if ui
                .button(if self.listening {
                    "Stop mic"
                } else {
                    "Start mic"
                })
                .clicked()
            {
                self.toggle_mic(context);
            }
            if ui.button("Reference tone").clicked() {
                self.toggle_reference_tone();
            }
            if ui.button("Ear-training note").clicked() {
                self.play_random_string();
            }
        });
        let spectrum_was_enabled = self.show_spectrum || self.visualization.show_spectrogram;
        ui.horizontal(|ui| {
            ui.checkbox(&mut self.show_spectrum, "Spectrum");
            ui.checkbox(&mut self.visualization.show_spectrogram, "Spectrogram");
        });
        let spectrum_is_enabled = self.show_spectrum || self.visualization.show_spectrogram;
        if spectrum_is_enabled != spectrum_was_enabled {
            if let Ok(mut engine) = self.engine.lock() {
                engine.set_spectrum_enabled(spectrum_is_enabled);
            }
            if !self.visualization.show_spectrogram {
                self.visualization.clear_spectrogram();
            }
        }
        ui.horizontal(|ui| {
            ui.label("A4");
            if ui
                .add(egui::Slider::new(&mut self.a4, 420.0..=460.0).text("Hz"))
                .changed()
            {
                if let Ok(mut engine) = self.engine.lock() {
                    engine.set_a4(self.a4);
                }
            }
        });
    }
}

impl eframe::App for App {
    fn update(&mut self, context: &egui::Context, _frame: &mut eframe::Frame) {
        context.set_visuals(egui::Visuals::dark());
        self.handle_shortcuts(context);
        let state = self
            .state
            .lock()
            .map(|state| state.clone())
            .unwrap_or_default();
        self.visualization.capture(&state, self.listening);

        egui::CentralPanel::default().show(context, |ui| {
            egui::ScrollArea::vertical()
                .auto_shrink([false, false])
                .show(ui, |ui| {
                    ui.vertical_centered(|ui| {
                        self.draw_header(ui, &state);
                        self.visualization.draw_primary(ui, &state);
                        self.draw_controls(ui, context);
                        if self.show_spectrum {
                            self.visualization.draw_spectrum(
                                ui,
                                &state,
                                state.sample_rate.max(1.0),
                            );
                        }
                        if self.visualization.show_spectrogram {
                            self.visualization.draw_spectrogram(ui);
                        }
                    });
                });
        });
    }

    fn save(&mut self, storage: &mut dyn eframe::Storage) {
        storage.set_string("a4", self.a4.to_string());
        storage.set_string("tuning_index", self.tuning_index.to_string());
        storage.set_string("show_spectrum", self.show_spectrum.to_string());
        storage.set_string(
            "input_device",
            self.audio.selected_input_device.clone().unwrap_or_default(),
        );
        storage.set_string(
            "show_spectrogram",
            self.visualization.show_spectrogram.to_string(),
        );
    }
}

#[cfg(not(target_arch = "wasm32"))]
fn parse_or<T>(storage: &dyn eframe::Storage, key: &str, fallback: T) -> T
where
    T: std::str::FromStr,
{
    storage
        .get_string(key)
        .and_then(|value| value.parse().ok())
        .unwrap_or(fallback)
}

#[cfg(not(target_arch = "wasm32"))]
fn parse_bool(storage: &dyn eframe::Storage, key: &str) -> bool {
    storage.get_string(key).as_deref() == Some("true")
}
