use super::{invalid_input, validate_schema_version, GuidanceMode, ThresholdManifest};
use pitch_core::{
    DetectorConfig, ExpectedPitchSegment, PitchQualityThresholds, QualityEvaluationConfig,
};
use serde::Deserialize;
use std::collections::HashSet;
use std::error::Error;
use std::path::Path;

const DEFAULT_WINDOW_SAMPLES: usize = 8192;
const DEFAULT_HOP_SECONDS: f32 = 0.033;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ScenarioManifest {
    pub schema_version: u32,
    #[serde(flatten)]
    pub scenario: ScenarioDefinition,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ScenarioDefinition {
    pub sample_rate: f32,
    pub window_samples: Option<usize>,
    pub hop_seconds: Option<f32>,
    pub tolerance_cents: Option<f32>,
    pub minimum_correct_hold_seconds: Option<f32>,
    pub reference_a4: Option<f32>,
    pub min_frequency: Option<f32>,
    pub max_frequency: Option<f32>,
    pub guidance: Option<GuidanceMode>,
    /// Optional multi-window lane set (e.g. [2048, 8192]). When present the
    /// engine keeps one detector lane per window and shorter lanes analyze
    /// the frame tail; absent means the historical single full window.
    pub analysis_windows: Option<Vec<usize>>,
    pub thresholds: Option<ThresholdManifest>,
    pub segments: Vec<ScenarioSegment>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ScenarioSegment {
    pub id: String,
    pub start_seconds: f32,
    pub end_seconds: f32,
    pub target_frequency: f32,
    pub stable_after_seconds: f32,
}

pub struct ScenarioRuntime {
    pub detector: DetectorConfig,
    pub evaluation: QualityEvaluationConfig,
    pub hop_samples: usize,
    pub hop_seconds: f32,
    pub window_samples: usize,
}

impl ScenarioManifest {
    pub fn load(path: &Path) -> Result<Self, Box<dyn Error>> {
        let scenario: Self = serde_json::from_slice(&std::fs::read(path)?)?;
        validate_schema_version(scenario.schema_version)?;
        Ok(scenario)
    }
}

impl ScenarioDefinition {
    pub fn runtime(&self, sample_count: usize) -> Result<ScenarioRuntime, Box<dyn Error>> {
        if !self.sample_rate.is_finite() || self.sample_rate <= 0.0 {
            return Err(invalid_input("sampleRate must be positive"));
        }
        let window_samples = self.window_samples.unwrap_or(DEFAULT_WINDOW_SAMPLES);
        let hop_seconds = self.hop_seconds.unwrap_or(DEFAULT_HOP_SECONDS);
        if window_samples == 0 || window_samples > sample_count {
            return Err(invalid_input("windowSamples must fit inside the capture"));
        }
        if !hop_seconds.is_finite() || hop_seconds <= 0.0 {
            return Err(invalid_input("hopSeconds must be positive"));
        }
        let hop_samples = (self.sample_rate * hop_seconds).round() as usize;
        if hop_samples == 0 || hop_samples > window_samples {
            return Err(invalid_input(
                "hopSeconds must resolve inside one analysis window",
            ));
        }
        if let Some(windows) = &self.analysis_windows {
            if windows.is_empty()
                || windows.iter().any(|window| {
                    *window < pitch_core::MIN_LANE_WINDOW_SAMPLES || *window > window_samples
                })
            {
                return Err(invalid_input(format!(
                    "analysisWindows entries must be at least {} and fit inside windowSamples",
                    pitch_core::MIN_LANE_WINDOW_SAMPLES
                )));
            }
        }

        self.validate_segments(sample_count)?;
        Ok(ScenarioRuntime {
            detector: self.detector_config()?,
            evaluation: QualityEvaluationConfig {
                tolerance_cents: self.tolerance_cents.unwrap_or(5.0),
                minimum_correct_hold_seconds: self.minimum_correct_hold_seconds.unwrap_or(0.1),
                reference_a4: self.reference_a4.unwrap_or(440.0),
            },
            hop_samples,
            hop_seconds,
            window_samples,
        })
    }

    pub fn expected_segments(&self) -> Vec<ExpectedPitchSegment> {
        self.segments
            .iter()
            .map(|segment| ExpectedPitchSegment {
                start_seconds: segment.start_seconds,
                end_seconds: segment.end_seconds,
                target_frequency: segment.target_frequency,
                stable_after_seconds: segment.stable_after_seconds,
            })
            .collect()
    }

    pub fn quality_thresholds(&self) -> Option<PitchQualityThresholds> {
        self.thresholds.map(Into::into)
    }

    fn validate_segments(&self, sample_count: usize) -> Result<(), Box<dyn Error>> {
        let capture_duration = sample_count as f32 / self.sample_rate;
        if self
            .segments
            .iter()
            .any(|segment| segment.end_seconds > capture_duration)
        {
            return Err(invalid_input("every segment must end inside the capture"));
        }
        let mut ids = HashSet::new();
        if self
            .segments
            .iter()
            .any(|segment| segment.id.trim().is_empty() || !ids.insert(segment.id.as_str()))
        {
            return Err(invalid_input("segment ids must be non-empty and unique"));
        }
        Ok(())
    }

    fn detector_config(&self) -> Result<DetectorConfig, Box<dyn Error>> {
        let mut detector = DetectorConfig::default();
        match (self.min_frequency, self.max_frequency) {
            (Some(minimum), Some(maximum))
                if minimum.is_finite()
                    && maximum.is_finite()
                    && minimum > 0.0
                    && maximum > minimum =>
            {
                if self.segments.iter().any(|segment| {
                    segment.target_frequency < minimum || segment.target_frequency > maximum
                }) {
                    return Err(invalid_input(
                        "every targetFrequency must be inside the detector range",
                    ));
                }
                detector.set_frequency_range(minimum, maximum);
            }
            (None, None) => {}
            (Some(_), Some(_)) => {
                return Err(invalid_input(
                    "minFrequency and maxFrequency must define a positive range",
                ));
            }
            _ => {
                return Err(invalid_input(
                    "minFrequency and maxFrequency must be supplied together",
                ));
            }
        }
        Ok(detector)
    }
}
