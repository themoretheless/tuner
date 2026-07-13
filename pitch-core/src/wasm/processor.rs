use super::WasmDetectionFrame;
use crate::{note_name_from_midi, octave_from_midi, EngineConfig, FrameContext, Note, TunerEngine};
use wasm_bindgen::prelude::*;

/// High-level browser processor. It owns the same detector, smoother and frame
/// resolver as native consumers, so JavaScript receives an already-resolved
/// frame instead of rebuilding tuner policy around raw pitch estimates.
#[wasm_bindgen(js_name = TunerProcessor)]
pub struct WasmTunerProcessor {
    inner: TunerEngine,
}

#[wasm_bindgen(js_class = TunerProcessor)]
impl WasmTunerProcessor {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: TunerEngine::with_config(EngineConfig {
                spectrum_bins: 0,
                ..EngineConfig::default()
            }),
        }
    }

    pub fn set_frequency_range(&mut self, min_frequency: f32, max_frequency: f32) {
        self.inner.set_detection_range(min_frequency, max_frequency);
    }

    #[allow(clippy::too_many_arguments)]
    pub fn set_frame_context(
        &mut self,
        a4: f32,
        display_midis: &[i32],
        display_frequencies: &[f32],
        tuning_midis: &[i32],
        tuning_frequencies: &[f32],
        selected_midi: i32,
        selected_frequency: f32,
        idle_midi: i32,
        idle_frequency: f32,
        in_tune_enter_cents: f32,
        in_tune_exit_cents: f32,
    ) {
        self.inner.set_frame_context(Some(FrameContext {
            a4,
            display_targets: notes_from_parts(display_midis, display_frequencies),
            tuning_targets: notes_from_parts(tuning_midis, tuning_frequencies),
            selected_target: note_from_parts(selected_midi, selected_frequency),
            idle_target: note_from_parts(idle_midi, idle_frequency),
            in_tune_enter_cents,
            in_tune_exit_cents,
        }));
    }

    pub fn clear_frame_context(&mut self) {
        self.inner.set_frame_context(None);
    }

    pub fn process(&mut self, buffer: &[f32], sample_rate: f32) -> WasmDetectionFrame {
        self.inner.process(buffer, sample_rate).into()
    }

    pub fn reset(&mut self) {
        self.inner.reset();
    }
}

impl Default for WasmTunerProcessor {
    fn default() -> Self {
        Self::new()
    }
}

fn notes_from_parts(midis: &[i32], frequencies: &[f32]) -> Vec<Note> {
    midis
        .iter()
        .copied()
        .zip(frequencies.iter().copied())
        .filter_map(|(midi, frequency)| note_from_parts(midi, frequency))
        .collect()
}

fn note_from_parts(midi: i32, frequency: f32) -> Option<Note> {
    ((0..=127).contains(&midi) && frequency.is_finite() && frequency > 0.0).then(|| Note {
        name: note_name_from_midi(midi),
        octave: octave_from_midi(midi),
        frequency,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tuner_processor_emits_resolved_frames_and_resets_on_silence() {
        let sample_rate = 48_000.0;
        let samples: Vec<f32> = (0..4096)
            .map(|index| (std::f32::consts::TAU * 440.0 * index as f32 / sample_rate).sin())
            .collect();
        let mut processor = WasmTunerProcessor::new();
        processor.set_frequency_range(180.0, 500.0);
        processor.set_frame_context(
            440.0,
            &[69],
            &[440.0],
            &[],
            &[],
            69,
            440.0,
            69,
            440.0,
            5.0,
            7.0,
        );

        assert!(!processor.process(&samples, sample_rate).has_frequency());
        let frame = processor.process(&samples, sample_rate);
        assert!(frame.has_frequency());
        assert!((frame.freq() - 440.0).abs() < 2.0);
        assert!(frame.confidence() > 0.5);
        assert_eq!(frame.note(), "A4");
        assert_eq!(frame.target_midi(), 69);
        assert!(frame.in_tune());

        processor.reset();
        let lower_samples: Vec<f32> = (0..4096)
            .map(|index| (std::f32::consts::TAU * 220.0 * index as f32 / sample_rate).sin())
            .collect();
        assert!(!processor
            .process(&lower_samples, sample_rate)
            .has_frequency());
        let after_reset = processor.process(&lower_samples, sample_rate);
        assert!((after_reset.freq() - 220.0).abs() < 2.0);

        let silent = processor.process(&vec![0.0; samples.len()], sample_rate);
        assert!(!silent.has_frequency());
        assert_eq!(silent.confidence(), 0.0);
        assert_eq!(silent.note(), "—");
        assert_eq!(silent.target_midi(), 69);
        assert!(!silent.in_tune());
    }
}
