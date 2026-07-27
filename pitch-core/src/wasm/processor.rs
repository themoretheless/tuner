use super::WasmDetectionFrame;
use crate::{
    note_name_from_midi, octave_from_midi, AnalysisWindowSet, EngineConfig, FrameContext, Note,
    PipelineConfig, TunerEngine,
};
use wasm_bindgen::prelude::*;

/// High-level browser processor. It owns the same detector, smoother and frame
/// resolver as native consumers, so JavaScript receives an already-resolved
/// frame instead of rebuilding tuner policy around raw pitch estimates.
///
/// Lane layout: the processor starts on the canonical
/// [`crate::STANDARD_ANALYSIS_WINDOWS`] dual-lane set. The web adapter
/// re-asserts the same set from its generated mirror
/// (`web/src/generated/analysisWindows.ts`) via `set_analysis_windows`, so
/// the WASM and TypeScript fallback paths always run identical lanes.
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
                analysis_windows: AnalysisWindowSet::standard(),
                spectrum_bins: 0,
                ..EngineConfig::default()
            }),
        }
    }

    /// Replaces the analysis window lanes (ascending sample counts). The web
    /// adapter passes the generated mirror of
    /// [`crate::STANDARD_ANALYSIS_WINDOWS`] here right after construction.
    pub fn set_analysis_windows(&mut self, windows: &[u32]) {
        self.inner.set_analysis_windows(AnalysisWindowSet::new(
            windows.iter().map(|&window| window as usize),
        ));
    }

    pub fn set_frequency_range(&mut self, min_frequency: f32, max_frequency: f32) {
        self.inner.set_detection_range(min_frequency, max_frequency);
    }

    #[allow(clippy::too_many_arguments)]
    pub fn set_pipeline_config(
        &mut self,
        adaptive_gate_enabled: bool,
        dc_removal_enabled: bool,
        fixed_gate_enabled: bool,
        harmonic_enabled: bool,
        hold_enabled: bool,
        octave_enabled: bool,
        power_chord_enabled: bool,
        secondary_detector_enabled: bool,
        tracking_enabled: bool,
        yin_enabled: bool,
    ) {
        self.inner.set_pipeline_config(PipelineConfig {
            adaptive_gate_enabled,
            dc_removal_enabled,
            fixed_gate_enabled,
            harmonic_enabled,
            hold_enabled,
            octave_enabled,
            power_chord_enabled,
            secondary_detector_enabled,
            tracking_enabled,
            yin_enabled,
        });
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
        let detuned_samples: Vec<f32> = (0..4096)
            .map(|index| (std::f32::consts::TAU * 430.0 * index as f32 / sample_rate).sin())
            .collect();
        assert!(!processor
            .process(&detuned_samples, sample_rate)
            .has_frequency());
        let after_reset = processor.process(&detuned_samples, sample_rate);
        assert!((after_reset.freq() - 430.0).abs() < 2.0);

        let silent = processor.process(&vec![0.0; samples.len()], sample_rate);
        assert!(!silent.has_frequency());
        assert_eq!(silent.confidence(), 0.0);
        assert_eq!(silent.note(), "—");
        assert_eq!(silent.target_midi(), 69);
        assert!(!silent.in_tune());
    }

    #[test]
    fn tuner_processor_accepts_runtime_lane_updates() {
        // The web adapter re-asserts the canonical lane set right after
        // construction; switching lanes at runtime must rebuild detectors in
        // place and keep processing without panics.
        let mut processor = WasmTunerProcessor::new();
        let sample_rate = 48_000.0;
        let samples = vec![0.0_f32; 8_192];
        processor.process(&samples, sample_rate);
        processor.set_analysis_windows(&[8_192]);
        processor.process(&samples, sample_rate);
        processor.set_analysis_windows(&[2_048, 8_192]);
        processor.process(&samples, sample_rate);
        assert!(processor.inner.history_sample_count() <= 12);
    }

    #[test]
    fn tuner_processor_applies_runtime_pipeline_switches() {
        let sample_rate = 48_000.0;
        let samples: Vec<f32> = (0..4096)
            .map(|index| (std::f32::consts::TAU * 220.0 * index as f32 / sample_rate).sin())
            .collect();
        let mut processor = WasmTunerProcessor::new();
        processor.set_frequency_range(180.0, 260.0);
        processor.set_pipeline_config(
            false, true, true, false, false, false, false, true, false, true,
        );

        let frame = processor.process(&samples, sample_rate);
        assert!(frame.has_frequency());
        assert!((frame.freq() - 220.0).abs() < 1.0);
    }
}
