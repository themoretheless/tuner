use crate::state::TunerViewState;
use eframe::egui;
use std::collections::VecDeque;

const CENTS_HISTORY_LIMIT: usize = 300;
const SPECTROGRAM_HISTORY_LIMIT: usize = 150;

#[derive(Default)]
pub(crate) struct VisualizationHistory {
    cents: VecDeque<f32>,
    last_frame_id: u64,
    spectrogram: VecDeque<Vec<f32>>,
    pub(crate) show_spectrogram: bool,
}

impl VisualizationHistory {
    pub(crate) fn capture(&mut self, state: &TunerViewState, listening: bool) {
        if !listening || state.frame_id == self.last_frame_id {
            return;
        }
        self.last_frame_id = state.frame_id;
        push_bounded(&mut self.cents, state.cents, CENTS_HISTORY_LIMIT);
        if self.show_spectrogram && !state.spectrum.is_empty() {
            push_bounded(
                &mut self.spectrogram,
                state.spectrum.clone(),
                SPECTROGRAM_HISTORY_LIMIT,
            );
        }
    }

    pub(crate) fn clear(&mut self) {
        self.cents.clear();
        self.spectrogram.clear();
    }

    pub(crate) fn clear_spectrogram(&mut self) {
        self.spectrogram.clear();
    }

    pub(crate) fn draw_primary(&self, ui: &mut egui::Ui, state: &TunerViewState) {
        draw_waveform(ui, &state.waveform);
        draw_cents_gauge(ui, state.cents);
        draw_cents_history(ui, &self.cents);
    }

    pub(crate) fn draw_spectrum(
        &self,
        ui: &mut egui::Ui,
        state: &TunerViewState,
        sample_rate: f32,
    ) {
        draw_spectrum(ui, &state.spectrum, state.frequency, sample_rate);
    }

    pub(crate) fn draw_spectrogram(&self, ui: &mut egui::Ui) {
        draw_spectrogram(ui, &self.spectrogram);
    }
}

fn push_bounded<T>(history: &mut VecDeque<T>, value: T, limit: usize) {
    if history.len() == limit {
        history.pop_front();
    }
    history.push_back(value);
}

fn draw_waveform(ui: &mut egui::Ui, samples: &[f32]) {
    if samples.is_empty() {
        return;
    }
    ui.add_space(4.0);
    let size = egui::vec2(ui.available_width().min(520.0), 36.0);
    let (rect, _) = ui.allocate_exact_size(size, egui::Sense::hover());
    let painter = ui.painter();
    painter.rect_filled(rect, 2.0, egui::Color32::from_gray(30));

    let point_count = (rect.width() as usize).clamp(2, samples.len());
    let points = (0..point_count)
        .map(|index| {
            let sample_index = index * (samples.len() - 1) / (point_count - 1);
            let x = egui::lerp(rect.x_range(), index as f32 / (point_count - 1) as f32);
            let y = (rect.center().y - samples[sample_index] * rect.height() * 0.45)
                .clamp(rect.min.y, rect.max.y);
            egui::pos2(x, y)
        })
        .collect();
    painter.add(egui::Shape::line(
        points,
        egui::Stroke::new(1.0, egui::Color32::from_rgb(100, 210, 160)),
    ));
}

fn draw_cents_gauge(ui: &mut egui::Ui, cents: f32) {
    let size = egui::vec2(ui.available_width().min(520.0), 18.0);
    let (rect, _) = ui.allocate_exact_size(size, egui::Sense::hover());
    let painter = ui.painter();
    painter.rect_filled(rect, 4.0, egui::Color32::from_gray(48));
    painter.vline(
        rect.center().x,
        rect.y_range(),
        egui::Stroke::new(1.0, egui::Color32::from_gray(130)),
    );
    let x = (rect.center().x + cents / 50.0 * rect.width() * 0.5).clamp(rect.min.x, rect.max.x);
    let color = if cents.abs() < 5.0 {
        egui::Color32::from_rgb(52, 211, 153)
    } else {
        egui::Color32::from_rgb(251, 191, 36)
    };
    painter.circle_filled(egui::pos2(x, rect.center().y), 7.0, color);
}

fn draw_cents_history(ui: &mut egui::Ui, history: &VecDeque<f32>) {
    if history.len() < 2 {
        return;
    }
    ui.add_space(4.0);
    let size = egui::vec2(ui.available_width().min(520.0), 44.0);
    let (rect, _) = ui.allocate_exact_size(size, egui::Sense::hover());
    let painter = ui.painter();
    painter.rect_filled(rect, 2.0, egui::Color32::from_gray(30));
    painter.hline(
        rect.x_range(),
        rect.center().y,
        egui::Stroke::new(1.0, egui::Color32::from_gray(65)),
    );
    let denominator = (history.len() - 1) as f32;
    let points = history
        .iter()
        .enumerate()
        .map(|(index, cents)| {
            let x = egui::lerp(rect.x_range(), index as f32 / denominator);
            let y = (rect.center().y - cents / 50.0 * rect.height() * 0.5)
                .clamp(rect.min.y, rect.max.y);
            egui::pos2(x, y)
        })
        .collect();
    painter.add(egui::Shape::line(
        points,
        egui::Stroke::new(1.25, egui::Color32::from_rgb(110, 231, 183)),
    ));
}

fn draw_spectrum(ui: &mut egui::Ui, spectrum: &[f32], frequency: Option<f32>, sample_rate: f32) {
    if spectrum.is_empty() {
        return;
    }
    ui.add_space(4.0);
    ui.label("Spectrum");
    let bin_count = spectrum.len().min(200);
    let size = egui::vec2(ui.available_width().min(600.0), 84.0);
    let (rect, _) = ui.allocate_exact_size(size, egui::Sense::hover());
    let painter = ui.painter();
    painter.rect_filled(rect, 2.0, egui::Color32::from_gray(30));
    let bar_width = rect.width() / bin_count as f32;
    for (index, magnitude) in spectrum.iter().take(bin_count).enumerate() {
        let height = magnitude * rect.height();
        let left = rect.min.x + index as f32 * bar_width;
        painter.rect_filled(
            egui::Rect::from_min_max(
                egui::pos2(left, rect.max.y - height),
                egui::pos2(left + (bar_width - 1.0).max(1.0), rect.max.y),
            ),
            0.0,
            egui::Color32::from_rgb(80, 200, 120),
        );
    }

    if let Some(frequency) = frequency {
        let fft_size = spectrum.len() * 4;
        for harmonic in 2..=5 {
            let bin = ((frequency * harmonic as f32 / (sample_rate / fft_size as f32)) as usize)
                .min(bin_count - 1);
            let x = rect.min.x + bin as f32 * bar_width;
            painter.vline(
                x,
                rect.y_range(),
                egui::Stroke::new(1.0, egui::Color32::from_rgb(255, 220, 80)),
            );
        }
    }
}

fn draw_spectrogram(ui: &mut egui::Ui, history: &VecDeque<Vec<f32>>) {
    if history.is_empty() {
        return;
    }
    ui.add_space(4.0);
    ui.label("Spectrogram");
    let frequency_bins = 80;
    let size = egui::vec2(ui.available_width().min(520.0), 72.0);
    let (rect, _) = ui.allocate_exact_size(size, egui::Sense::hover());
    let painter = ui.painter();
    painter.rect_filled(rect, 2.0, egui::Color32::from_gray(15));
    let step_width = rect.width() / history.len() as f32;
    let bin_height = rect.height() / frequency_bins as f32;
    for (time, frame) in history.iter().enumerate() {
        let x = rect.min.x + time as f32 * step_width;
        for bin in 0..frequency_bins {
            let value = frame.get(bin).copied().unwrap_or(0.0);
            let y = rect.max.y - (bin + 1) as f32 * bin_height;
            let color = egui::Color32::from_rgb(
                (value * 255.0).clamp(0.0, 255.0) as u8,
                (value.sqrt() * 210.0).clamp(0.0, 255.0) as u8,
                (40.0 + value * 50.0).clamp(0.0, 255.0) as u8,
            );
            painter.rect_filled(
                egui::Rect::from_min_size(
                    egui::pos2(x, y),
                    egui::vec2(step_width.max(0.8), bin_height),
                ),
                0.0,
                color,
            );
        }
    }
}
