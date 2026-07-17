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
    pub stable_detection_coverage: f32,
    pub segments: Vec<PitchSegmentMetrics>,
}

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
