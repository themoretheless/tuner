use std::fmt;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct PitchObservation {
    pub time_seconds: f32,
    pub frequency: Option<f32>,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct ExpectedPitchSegment {
    pub start_seconds: f32,
    pub end_seconds: f32,
    pub target_frequency: f32,
    pub stable_after_seconds: f32,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct QualityEvaluationConfig {
    pub tolerance_cents: f32,
    pub minimum_correct_hold_seconds: f32,
    pub reference_a4: f32,
}

impl Default for QualityEvaluationConfig {
    fn default() -> Self {
        Self {
            tolerance_cents: 5.0,
            minimum_correct_hold_seconds: 0.1,
            reference_a4: 440.0,
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct PitchSegmentMetrics {
    pub target_frequency: f32,
    pub acquisition_latency_ms: Option<f32>,
    pub false_lock_duration_ms: f32,
    pub note_switches: usize,
    pub stable_sustain_cents_mae: Option<f32>,
    pub stable_sustain_cents_p50: Option<f32>,
    pub stable_sustain_cents_p95: Option<f32>,
    pub stable_sustain_cents_max: Option<f32>,
    pub octave_error_ratio: Option<f32>,
    pub stable_detection_coverage: f32,
}

#[derive(Clone, Debug, PartialEq)]
pub struct PitchQualityMetrics {
    pub evaluated_duration_seconds: f32,
    pub time_to_first_correct_ms: Option<f32>,
    pub mean_reacquisition_latency_ms: Option<f32>,
    pub max_reacquisition_latency_ms: Option<f32>,
    pub missed_acquisitions: usize,
    pub false_lock_duration_ms: f32,
    pub false_lock_ratio: f32,
    pub note_switches_per_second: f32,
    pub stable_sustain_cents_mae: Option<f32>,
    pub stable_sustain_cents_p50: Option<f32>,
    pub stable_sustain_cents_p95: Option<f32>,
    pub stable_sustain_cents_max: Option<f32>,
    pub octave_error_ratio: Option<f32>,
    pub stable_detection_coverage: f32,
    pub segments: Vec<PitchSegmentMetrics>,
}

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct PitchQualityThresholds {
    pub max_time_to_first_correct_ms: Option<f32>,
    pub max_mean_reacquisition_latency_ms: Option<f32>,
    pub max_reacquisition_latency_ms: Option<f32>,
    pub max_missed_acquisitions: Option<usize>,
    pub max_false_lock_ratio: Option<f32>,
    pub max_note_switches_per_second: Option<f32>,
    pub max_stable_sustain_cents_mae: Option<f32>,
    pub min_stable_detection_coverage: Option<f32>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum QualityMetric {
    TimeToFirstCorrectMs,
    MeanReacquisitionLatencyMs,
    MaxReacquisitionLatencyMs,
    MissedAcquisitions,
    FalseLockRatio,
    NoteSwitchesPerSecond,
    StableSustainCentsMae,
    StableDetectionCoverage,
}

impl QualityMetric {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::TimeToFirstCorrectMs => "timeToFirstCorrectMs",
            Self::MeanReacquisitionLatencyMs => "meanReacquisitionLatencyMs",
            Self::MaxReacquisitionLatencyMs => "maxReacquisitionLatencyMs",
            Self::MissedAcquisitions => "missedAcquisitions",
            Self::FalseLockRatio => "falseLockRatio",
            Self::NoteSwitchesPerSecond => "noteSwitchesPerSecond",
            Self::StableSustainCentsMae => "stableSustainCentsMae",
            Self::StableDetectionCoverage => "stableDetectionCoverage",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum QualityThresholdRequirement {
    AtMost,
    AtLeast,
}

impl QualityThresholdRequirement {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::AtMost => "atMost",
            Self::AtLeast => "atLeast",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct QualityThresholdViolation {
    pub metric: QualityMetric,
    pub observed: Option<f32>,
    pub limit: f32,
    pub requirement: QualityThresholdRequirement,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum QualityThresholdError {
    InvalidThresholds,
}

impl fmt::Display for QualityThresholdError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidThresholds => write!(formatter, "quality thresholds are invalid"),
        }
    }
}

impl std::error::Error for QualityThresholdError {}

#[derive(Clone, Debug, PartialEq)]
pub enum QualityEvaluationError {
    InvalidConfig,
    NoSegments,
    InvalidSegment { index: usize },
    SegmentsNotChronological { previous: usize, current: usize },
    OverlappingSegments { previous: usize, current: usize },
}

impl fmt::Display for QualityEvaluationError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidConfig => write!(formatter, "quality evaluation config is invalid"),
            Self::NoSegments => write!(formatter, "quality evaluation needs at least one segment"),
            Self::InvalidSegment { index } => {
                write!(formatter, "quality segment {index} is invalid")
            }
            Self::SegmentsNotChronological { previous, current } => write!(
                formatter,
                "quality segment {current} starts before segment {previous}"
            ),
            Self::OverlappingSegments { previous, current } => write!(
                formatter,
                "quality segments {previous} and {current} overlap"
            ),
        }
    }
}

impl std::error::Error for QualityEvaluationError {}
