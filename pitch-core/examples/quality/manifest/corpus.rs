use super::{
    invalid_input, valid_sha256, validate_schema_version, CorpusAnnotation, CorpusTransform,
    GuidanceMode, ScenarioDefinition, ScenarioSegment, SourceProvenance, ThresholdManifest,
};
use serde::Deserialize;
use std::collections::HashSet;
use std::error::Error;
use std::path::Path;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CorpusManifest {
    pub schema_version: u32,
    pub id: String,
    pub config_revision: String,
    pub thresholds: ThresholdManifest,
    pub scenario_defaults: CorpusScenarioDefaults,
    pub requirements: Vec<CorpusRequirement>,
    pub captures: Vec<CorpusCapture>,
    /// Optional SNR robustness grid: every capture is re-evaluated against
    /// deterministic noise mixed at each listed level.
    pub snr_grid: Option<SnrGridManifest>,
    /// Optional reverb robustness grid: every capture is re-evaluated after
    /// convolution with a deterministic exponentially decaying noise IR.
    pub reverb_grid: Option<ReverbGridManifest>,
}

/// Reverb robustness grid evaluated on top of the clean corpus gate.
///
/// Conditions are RT60 targets in seconds (`0.3`, `0.8`, `1.5`); the wet mix
/// is fixed at [`DEFAULT_WET_DB`] so conditions stay comparable across
/// corpora. `thresholds` keys are the RT60 value formatted like Rust's
/// default float display (`"0.3"`, `"0.8"`, `"1.5"`). Tolerances loosen as
/// RT60 grows — the clean gate is evaluated separately and stays unchanged.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReverbGridManifest {
    pub conditions: Vec<ReverbConditionManifest>,
    pub thresholds: std::collections::HashMap<String, ThresholdManifest>,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReverbConditionManifest {
    pub rt60_seconds: f32,
    /// Wet level in dB relative to the dry RMS; negative values attenuate.
    /// Defaults to [`DEFAULT_WET_DB`].
    pub wet_db: Option<f32>,
}

/// Fixed wet/dry mix for grid conditions: −12 dB wet puts the reverberant
/// tail at a quarter of the dry power — a moderately reverberant room that
/// still lets a good detector hold pitch.
pub const DEFAULT_WET_DB: f32 = -12.0;

impl ReverbConditionManifest {
    pub fn wet_db(&self) -> f32 {
        self.wet_db.unwrap_or(DEFAULT_WET_DB)
    }
}

impl ReverbGridManifest {
    /// Validated `(condition, thresholds)` pairs in ascending-RT60 order.
    pub fn levels(&self) -> Vec<(ReverbConditionManifest, ThresholdManifest)> {
        let mut levels: Vec<(ReverbConditionManifest, ThresholdManifest)> = self
            .conditions
            .iter()
            .filter_map(|condition| {
                self.thresholds
                    .get(&reverb_condition_key(condition.rt60_seconds))
                    .map(|thresholds| (*condition, *thresholds))
            })
            .collect();
        levels.sort_by(|left, right| left.0.rt60_seconds.total_cmp(&right.0.rt60_seconds));
        levels
    }
}

/// Stable string key for an RT60 condition (`0.3` -> `"0.3"`).
pub fn reverb_condition_key(rt60_seconds: f32) -> String {
    format!("{rt60_seconds}")
}

/// SNR robustness grid evaluated on top of the clean corpus gate.
///
/// `thresholds` keys are the level in dB formatted without a fractional part
/// (`"30"`, `"20"`, `"10"`); every level in `levels_db` must have an entry.
/// Tolerances are expected to loosen as the level drops — the clean gate
/// (`thresholds`) is evaluated separately and stays unchanged.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SnrGridManifest {
    pub levels_db: Vec<f32>,
    pub thresholds: std::collections::HashMap<String, ThresholdManifest>,
}

impl SnrGridManifest {
    /// Validated `(level, thresholds)` pairs in descending-SNR order.
    pub fn levels(&self) -> Vec<(f32, ThresholdManifest)> {
        let mut levels: Vec<(f32, ThresholdManifest)> = self
            .levels_db
            .iter()
            .filter_map(|level| {
                self.thresholds
                    .get(&snr_level_key(*level))
                    .map(|thresholds| (*level, *thresholds))
            })
            .collect();
        levels.sort_by(|left, right| right.0.total_cmp(&left.0));
        levels
    }
}

/// Stable string key for an SNR level (`30.0` -> `"30"`).
pub fn snr_level_key(level: f32) -> String {
    if level.fract() == 0.0 {
        format!("{}", level as i64)
    } else {
        format!("{level}")
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CorpusRequirement {
    pub instrument: String,
    pub notes: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CorpusCapture {
    pub id: String,
    pub instrument: String,
    pub note: String,
    pub capture: String,
    pub capture_sha256: String,
    pub source: SourceProvenance,
    pub transform: CorpusTransform,
    pub annotation: CorpusAnnotation,
    pub scenario: CorpusScenario,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CorpusScenarioDefaults {
    pub sample_rate: f32,
    pub window_samples: Option<usize>,
    pub hop_seconds: Option<f32>,
    pub tolerance_cents: Option<f32>,
    pub minimum_correct_hold_seconds: Option<f32>,
    pub reference_a4: Option<f32>,
    pub min_frequency: Option<f32>,
    pub max_frequency: Option<f32>,
    pub guidance: Option<GuidanceMode>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CorpusScenario {
    pub guidance: Option<GuidanceMode>,
    pub tolerance_cents: Option<f32>,
    pub thresholds: Option<ThresholdManifest>,
    pub segment: ScenarioSegment,
}

impl CorpusManifest {
    pub fn load(path: &Path) -> Result<Self, Box<dyn Error>> {
        let corpus: Self = serde_json::from_slice(&std::fs::read(path)?)?;
        validate_schema_version(corpus.schema_version)?;
        corpus.validate()?;
        Ok(corpus)
    }

    fn validate(&self) -> Result<(), Box<dyn Error>> {
        if self.id.trim().is_empty()
            || self.config_revision.trim().is_empty()
            || self.captures.is_empty()
            || self.requirements.is_empty()
        {
            return Err(invalid_input(
                "corpus id, configRevision, requirements and captures are required",
            ));
        }
        if !self.thresholds.has_single_note_release_gate() {
            return Err(invalid_input(
                "corpus thresholds must gate acquisition, misses, false locks, note switches, sustain error and coverage",
            ));
        }
        if let Some(grid) = &self.snr_grid {
            if grid.levels_db.is_empty()
                || grid
                    .levels_db
                    .iter()
                    .any(|level| !level.is_finite() || *level <= 0.0)
            {
                return Err(invalid_input("snrGrid levelsDb must be positive dB levels"));
            }
            for level in &grid.levels_db {
                let key = snr_level_key(*level);
                let Some(thresholds) = grid.thresholds.get(&key) else {
                    return Err(invalid_input(format!(
                        "snrGrid thresholds are missing level {key}"
                    )));
                };
                if !thresholds.has_single_note_release_gate() {
                    return Err(invalid_input(format!(
                        "snrGrid thresholds for level {key} must gate acquisition, misses, false locks, note switches, sustain error and coverage",
                    )));
                }
            }
        }

        if let Some(grid) = &self.reverb_grid {
            if grid.conditions.is_empty()
                || grid.conditions.iter().any(|condition| {
                    !condition.rt60_seconds.is_finite()
                        || condition.rt60_seconds <= 0.0
                        || condition
                            .wet_db
                            .is_some_and(|wet| !wet.is_finite() || wet >= 0.0)
                })
            {
                return Err(invalid_input(
                    "reverbGrid conditions need positive rt60Seconds and negative wetDb",
                ));
            }
            for condition in &grid.conditions {
                let key = reverb_condition_key(condition.rt60_seconds);
                let Some(thresholds) = grid.thresholds.get(&key) else {
                    return Err(invalid_input(format!(
                        "reverbGrid thresholds are missing condition {key}"
                    )));
                };
                if !thresholds.has_single_note_release_gate() {
                    return Err(invalid_input(format!(
                        "reverbGrid thresholds for condition {key} must gate acquisition, misses, false locks, note switches, sustain error and coverage",
                    )));
                }
            }
        }

        let mut capture_ids = HashSet::new();
        let mut coverage = HashSet::new();
        for capture in &self.captures {
            if capture.id.trim().is_empty() || !capture_ids.insert(capture.id.as_str()) {
                return Err(invalid_input(
                    "corpus capture ids must be non-empty and unique",
                ));
            }
            if !coverage.insert((capture.instrument.as_str(), capture.note.as_str())) {
                return Err(invalid_input(
                    "each corpus instrument/note pair must be unique",
                ));
            }
            capture.validate()?;
            capture.annotation.validate(&capture.scenario.segment)?;
        }

        let mut instruments = HashSet::new();
        for requirement in &self.requirements {
            if requirement.instrument.trim().is_empty()
                || requirement.notes.is_empty()
                || !instruments.insert(requirement.instrument.as_str())
            {
                return Err(invalid_input(
                    "coverage requirements need unique instruments and at least one note",
                ));
            }
            let mut notes = HashSet::new();
            for note in &requirement.notes {
                if note.trim().is_empty() || !notes.insert(note.as_str()) {
                    return Err(invalid_input(
                        "coverage requirement notes must be non-empty and unique",
                    ));
                }
                if !coverage.contains(&(requirement.instrument.as_str(), note.as_str())) {
                    return Err(invalid_input(format!(
                        "corpus is missing required {} {note}",
                        requirement.instrument
                    )));
                }
            }
        }
        Ok(())
    }
}

impl CorpusCapture {
    fn validate(&self) -> Result<(), Box<dyn Error>> {
        if self.instrument.trim().is_empty()
            || self.note.trim().is_empty()
            || self.capture.trim().is_empty()
            || !valid_sha256(&self.capture_sha256)
        {
            return Err(invalid_input(format!(
                "corpus capture {} has invalid identity or checksum metadata",
                self.id
            )));
        }
        self.source.validate()?;
        self.transform.validate()
    }
}

impl CorpusScenarioDefaults {
    pub fn build(&self, scenario: &CorpusScenario) -> ScenarioDefinition {
        ScenarioDefinition {
            sample_rate: self.sample_rate,
            window_samples: self.window_samples,
            hop_seconds: self.hop_seconds,
            tolerance_cents: scenario.tolerance_cents.or(self.tolerance_cents),
            minimum_correct_hold_seconds: self.minimum_correct_hold_seconds,
            reference_a4: self.reference_a4,
            min_frequency: self.min_frequency,
            max_frequency: self.max_frequency,
            guidance: scenario.guidance.or(self.guidance),
            thresholds: scenario.thresholds,
            segments: vec![scenario.segment.clone()],
        }
    }
}
