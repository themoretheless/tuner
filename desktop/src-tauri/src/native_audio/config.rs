use pitch_core::{canonical_note_name, FrameContext, Note, PipelineConfig};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

const MAX_DISPLAY_TARGETS: usize = 128;
const MAX_TUNING_TARGETS: usize = 24;

#[derive(Clone, Debug, Default, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NativeAudioConfig {
    pub(crate) context: NativeFrameContext,
    #[serde(default)]
    pub(crate) pipeline: NativePipelineConfig,
    pub(crate) range: NativeAudioRange,
}

impl NativeAudioConfig {
    pub(crate) fn normalized(mut self) -> Self {
        self.context = self.context.normalized();
        self.pipeline = self.pipeline.normalized();
        self.range = self.range.normalized();
        self
    }
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub(crate) struct NativePipelineConfig {
    pub(crate) adaptive_gate_enabled: bool,
    pub(crate) dc_removal_enabled: bool,
    pub(crate) fixed_gate_enabled: bool,
    pub(crate) harmonic_enabled: bool,
    pub(crate) hold_enabled: bool,
    pub(crate) octave_enabled: bool,
    pub(crate) power_chord_enabled: bool,
    pub(crate) secondary_detector_enabled: bool,
    pub(crate) tracking_enabled: bool,
    pub(crate) yin_enabled: bool,
}

impl Default for NativePipelineConfig {
    fn default() -> Self {
        Self::from_core(PipelineConfig::default())
    }
}

impl NativePipelineConfig {
    fn normalized(self) -> Self {
        Self::from_core(self.to_core().normalized())
    }

    pub(crate) fn to_core(self) -> PipelineConfig {
        PipelineConfig {
            adaptive_gate_enabled: self.adaptive_gate_enabled,
            dc_removal_enabled: self.dc_removal_enabled,
            fixed_gate_enabled: self.fixed_gate_enabled,
            harmonic_enabled: self.harmonic_enabled,
            hold_enabled: self.hold_enabled,
            octave_enabled: self.octave_enabled,
            power_chord_enabled: self.power_chord_enabled,
            secondary_detector_enabled: self.secondary_detector_enabled,
            tracking_enabled: self.tracking_enabled,
            yin_enabled: self.yin_enabled,
        }
    }

    fn from_core(config: PipelineConfig) -> Self {
        Self {
            adaptive_gate_enabled: config.adaptive_gate_enabled,
            dc_removal_enabled: config.dc_removal_enabled,
            fixed_gate_enabled: config.fixed_gate_enabled,
            harmonic_enabled: config.harmonic_enabled,
            hold_enabled: config.hold_enabled,
            octave_enabled: config.octave_enabled,
            power_chord_enabled: config.power_chord_enabled,
            secondary_detector_enabled: config.secondary_detector_enabled,
            tracking_enabled: config.tracking_enabled,
            yin_enabled: config.yin_enabled,
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NativeAudioRange {
    pub(crate) max_frequency: f32,
    pub(crate) min_frequency: f32,
}

impl Default for NativeAudioRange {
    fn default() -> Self {
        Self {
            min_frequency: 24.0,
            max_frequency: 1_200.0,
        }
    }
}

impl NativeAudioRange {
    pub(crate) fn normalized(self) -> Self {
        let defaults = Self::default();
        let min_frequency =
            finite_or(self.min_frequency, defaults.min_frequency).clamp(20.0, 600.0);
        let max_frequency =
            finite_or(self.max_frequency, defaults.max_frequency).clamp(80.0, 1_800.0);
        if max_frequency <= min_frequency * 1.2 {
            Self::default()
        } else {
            Self {
                max_frequency,
                min_frequency,
            }
        }
    }
}

#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NativeFrameContext {
    pub(crate) a4: f32,
    pub(crate) display_targets: Vec<NativeAudioNote>,
    pub(crate) idle_target: Option<NativeAudioNote>,
    pub(crate) in_tune_enter_cents: f32,
    pub(crate) in_tune_exit_cents: f32,
    pub(crate) selected_target: Option<NativeAudioNote>,
    pub(crate) tuning_targets: Vec<NativeAudioNote>,
}

impl Default for NativeFrameContext {
    fn default() -> Self {
        Self {
            a4: 440.0,
            display_targets: Vec::new(),
            idle_target: None,
            in_tune_enter_cents: 5.0,
            in_tune_exit_cents: 7.0,
            selected_target: None,
            tuning_targets: Vec::new(),
        }
    }
}

impl NativeFrameContext {
    fn normalized(mut self) -> Self {
        self.a4 = finite_or(self.a4, 440.0).clamp(420.0, 460.0);
        self.in_tune_enter_cents = finite_or(self.in_tune_enter_cents, 5.0).clamp(0.1, 25.0);
        self.in_tune_exit_cents =
            finite_or(self.in_tune_exit_cents, 7.0).clamp(self.in_tune_enter_cents, 30.0);
        self.display_targets = normalize_notes(self.display_targets, MAX_DISPLAY_TARGETS);
        self.tuning_targets = normalize_notes(self.tuning_targets, MAX_TUNING_TARGETS);
        self.selected_target = self.selected_target.and_then(NativeAudioNote::normalized);
        self.idle_target = self.idle_target.and_then(NativeAudioNote::normalized);
        self
    }

    pub(crate) fn to_core(&self) -> FrameContext {
        FrameContext {
            a4: self.a4,
            display_targets: self
                .display_targets
                .iter()
                .filter_map(NativeAudioNote::to_core)
                .collect(),
            tuning_targets: self
                .tuning_targets
                .iter()
                .filter_map(NativeAudioNote::to_core)
                .collect(),
            selected_target: self
                .selected_target
                .as_ref()
                .and_then(NativeAudioNote::to_core),
            idle_target: self.idle_target.as_ref().and_then(NativeAudioNote::to_core),
            in_tune_enter_cents: self.in_tune_enter_cents,
            in_tune_exit_cents: self.in_tune_exit_cents,
        }
    }
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub(crate) struct NativeAudioNote {
    pub(crate) frequency: f32,
    pub(crate) name: String,
    pub(crate) octave: i32,
}

impl NativeAudioNote {
    pub(crate) fn from_core(note: Note) -> Self {
        Self {
            frequency: note.frequency,
            name: note.name.to_string(),
            octave: note.octave,
        }
    }

    fn normalized(self) -> Option<Self> {
        let name = canonical_note_name(&self.name)?;
        (self.frequency.is_finite()
            && (10.0..=20_000.0).contains(&self.frequency)
            && (-1..=10).contains(&self.octave))
        .then(|| Self {
            frequency: self.frequency,
            name: name.to_string(),
            octave: self.octave,
        })
    }

    fn to_core(&self) -> Option<Note> {
        Some(Note {
            frequency: self.frequency,
            name: canonical_note_name(&self.name)?,
            octave: self.octave,
        })
    }
}

#[derive(Debug, Default)]
pub(crate) struct NativeAudioSettings {
    config: NativeAudioConfig,
    revision: u64,
}

impl NativeAudioSettings {
    pub(crate) fn update(&mut self, config: NativeAudioConfig) {
        let config = config.normalized();
        if self.config == config {
            return;
        }
        self.config = config;
        self.revision = self.revision.wrapping_add(1);
    }

    pub(crate) fn snapshot(&self) -> (u64, NativeAudioConfig) {
        (self.revision, self.config.clone())
    }

    pub(crate) fn snapshot_after(&self, revision: u64) -> Option<(u64, NativeAudioConfig)> {
        (self.revision != revision).then(|| self.snapshot())
    }
}

pub(crate) type SharedNativeAudioSettings = Arc<Mutex<NativeAudioSettings>>;

fn normalize_notes(notes: Vec<NativeAudioNote>, maximum: usize) -> Vec<NativeAudioNote> {
    notes
        .into_iter()
        .filter_map(NativeAudioNote::normalized)
        .take(maximum)
        .collect()
}

fn finite_or(value: f32, fallback: f32) -> f32 {
    if value.is_finite() {
        value
    } else {
        fallback
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn invalid_range_falls_back_to_default() {
        assert_eq!(
            NativeAudioRange {
                min_frequency: 500.0,
                max_frequency: 510.0,
            }
            .normalized(),
            NativeAudioRange::default(),
        );
        assert_eq!(
            NativeAudioRange {
                min_frequency: f32::NAN,
                max_frequency: f32::INFINITY,
            }
            .normalized(),
            NativeAudioRange::default(),
        );
    }

    #[test]
    fn context_drops_invalid_and_excess_targets() {
        let targets = (0..140)
            .map(|index| NativeAudioNote {
                frequency: 440.0 + index as f32,
                name: if index == 0 { "invalid" } else { "A" }.to_string(),
                octave: 4,
            })
            .collect();
        let context = NativeFrameContext {
            display_targets: targets,
            ..NativeFrameContext::default()
        }
        .normalized();

        assert_eq!(context.display_targets.len(), 128);
        assert!(context.display_targets.iter().all(|note| note.name == "A"));
    }

    #[test]
    fn revisions_change_only_for_new_configuration() {
        let mut settings = NativeAudioSettings::default();
        assert!(settings.snapshot_after(0).is_none());
        let mut config = NativeAudioConfig::default();
        config.context.a4 = 442.0;
        settings.update(config.clone());
        let (revision, _) = settings.snapshot();
        assert_ne!(revision, 0);
        settings.update(config);
        assert!(settings.snapshot_after(revision).is_none());
    }

    #[test]
    fn pipeline_normalization_keeps_a_detector_enabled() {
        let pipeline = NativePipelineConfig {
            yin_enabled: false,
            secondary_detector_enabled: false,
            ..NativePipelineConfig::default()
        }
        .normalized();

        assert!(pipeline.yin_enabled);
        assert!(!pipeline.secondary_detector_enabled);
    }
}
