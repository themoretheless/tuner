use super::{approximately_equal, invalid_input, valid_sha256, ScenarioSegment};
use serde::Deserialize;
use std::error::Error;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CorpusTransform {
    pub source_trim_seconds: f32,
    pub leading_silence_seconds: f32,
    pub duration_seconds: f32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SourceProvenance {
    pub creator: String,
    pub page_url: String,
    pub source_url: String,
    pub source_sha256: String,
    pub license_spdx: String,
    pub license_url: String,
    pub derivative: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CorpusAnnotation {
    pub method: String,
    pub nominal_frequency: f32,
    pub measured_frequency: f32,
    pub attack_start_seconds: f32,
    pub sustain_start_seconds: f32,
    pub release_start_seconds: f32,
    pub end_seconds: f32,
}

impl CorpusTransform {
    pub(super) fn validate(&self) -> Result<(), Box<dyn Error>> {
        let valid = self.source_trim_seconds.is_finite()
            && self.source_trim_seconds >= 0.0
            && self.leading_silence_seconds.is_finite()
            && self.leading_silence_seconds >= 0.0
            && self.duration_seconds.is_finite()
            && self.duration_seconds > self.leading_silence_seconds;
        valid
            .then_some(())
            .ok_or_else(|| invalid_input("corpus transform is invalid"))
    }
}

impl SourceProvenance {
    pub(super) fn validate(&self) -> Result<(), Box<dyn Error>> {
        let required = [
            self.creator.as_str(),
            self.page_url.as_str(),
            self.source_url.as_str(),
            self.license_spdx.as_str(),
            self.license_url.as_str(),
            self.derivative.as_str(),
        ];
        let valid = required.iter().all(|value| !value.trim().is_empty())
            && valid_sha256(&self.source_sha256)
            && self.page_url.starts_with("https://")
            && self.source_url.starts_with("https://")
            && self.license_url.starts_with("https://");
        valid
            .then_some(())
            .ok_or_else(|| invalid_input("corpus source provenance is incomplete"))
    }
}

impl CorpusAnnotation {
    pub(super) fn validate(&self, segment: &ScenarioSegment) -> Result<(), Box<dyn Error>> {
        let phases = [
            self.attack_start_seconds,
            self.sustain_start_seconds,
            self.release_start_seconds,
            self.end_seconds,
        ];
        let valid = !self.method.trim().is_empty()
            && self.nominal_frequency.is_finite()
            && self.nominal_frequency > 0.0
            && self.measured_frequency.is_finite()
            && self.measured_frequency > 0.0
            && phases.iter().all(|value| value.is_finite())
            && phases[0] < phases[1]
            && phases[1] < phases[2]
            && phases[2] <= phases[3];
        if !valid {
            return Err(invalid_input("corpus annotation is invalid"));
        }

        let stable_start = segment.start_seconds + segment.stable_after_seconds;
        if approximately_equal(segment.start_seconds, self.attack_start_seconds)
            && approximately_equal(stable_start, self.sustain_start_seconds)
            && approximately_equal(segment.end_seconds, self.release_start_seconds)
            && approximately_equal(segment.target_frequency, self.measured_frequency)
        {
            Ok(())
        } else {
            Err(invalid_input(
                "corpus phase annotation and quality segment must describe the same interval",
            ))
        }
    }
}
