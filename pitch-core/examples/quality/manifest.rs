use pitch_core::{DetectorConfig, ExpectedPitchSegment, QualityEvaluationConfig};
use serde::Deserialize;
use std::collections::HashSet;
use std::error::Error;
use std::io::{Error as IoError, ErrorKind};

pub const SCHEMA_VERSION: u32 = 1;
const DEFAULT_WINDOW_SAMPLES: usize = 8192;
const DEFAULT_HOP_SECONDS: f32 = 0.033;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ScenarioManifest {
    pub schema_version: u32,
    pub sample_rate: f32,
    pub window_samples: Option<usize>,
    pub hop_seconds: Option<f32>,
    pub tolerance_cents: Option<f32>,
    pub minimum_correct_hold_seconds: Option<f32>,
    pub reference_a4: Option<f32>,
    pub min_frequency: Option<f32>,
    pub max_frequency: Option<f32>,
    pub segments: Vec<ScenarioSegment>,
}

#[derive(Debug, Deserialize)]
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
    pub fn load(path: &str) -> Result<Self, Box<dyn Error>> {
        let scenario: Self = serde_json::from_slice(&std::fs::read(path)?)?;
        if scenario.schema_version != SCHEMA_VERSION {
            return Err(invalid_input(format!(
                "unsupported scenario schema version {}",
                scenario.schema_version
            )));
        }
        if !scenario.sample_rate.is_finite() || scenario.sample_rate <= 0.0 {
            return Err(invalid_input("sampleRate must be positive"));
        }
        Ok(scenario)
    }

    pub fn runtime(&self, sample_count: usize) -> Result<ScenarioRuntime, Box<dyn Error>> {
        let window_samples = self.window_samples.unwrap_or(DEFAULT_WINDOW_SAMPLES);
        let hop_seconds = self.hop_seconds.unwrap_or(DEFAULT_HOP_SECONDS);
        if window_samples == 0 || window_samples > sample_count {
            return Err(invalid_input("windowSamples must fit inside the capture"));
        }
        if !hop_seconds.is_finite() || hop_seconds <= 0.0 {
            return Err(invalid_input("hopSeconds must be positive"));
        }
        let hop_samples = (self.sample_rate * hop_seconds).round() as usize;
        if hop_samples == 0 {
            return Err(invalid_input("hopSeconds resolves to zero samples"));
        }
        if hop_samples > window_samples {
            return Err(invalid_input(
                "hopSeconds must not leave gaps between analysis windows",
            ));
        }

        self.validate_segments(sample_count)?;
        let detector = self.detector_config()?;
        Ok(ScenarioRuntime {
            detector,
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
            (Some(_), None) | (None, Some(_)) => {
                return Err(invalid_input(
                    "minFrequency and maxFrequency must be supplied together",
                ));
            }
        }
        Ok(detector)
    }
}

pub fn invalid_input(message: impl Into<String>) -> Box<dyn Error> {
    Box::new(IoError::new(ErrorKind::InvalidInput, message.into()))
}
