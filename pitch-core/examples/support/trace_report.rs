#[path = "trace_report/configuration.rs"]
mod configuration;

use configuration::ReplayConfiguration;
use pitch_core::{
    DetectionFrame, DetectorConfig, PipelineCandidate, PipelineConfig, PipelineSpectralTelemetry,
};
use serde::Serialize;

pub const SCHEMA_VERSION: u32 = 1;
pub const CONFIG_REVISION: &str = concat!("pitch-core-", env!("CARGO_PKG_VERSION"), "-replay-v1");

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplayEnvelope {
    schema_version: u32,
    config_revision: &'static str,
    capture: CaptureMetadata,
    configuration: ReplayConfiguration,
    frames: Vec<ReplayFrame>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CaptureMetadata {
    path: String,
    sha256: String,
    sample_rate: f32,
    sample_count: usize,
    timebase: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ReplayFrame {
    sample_index: usize,
    window_end_sample: usize,
    time_seconds: f32,
    raw_frequency: Option<f32>,
    published_frequency: Option<f32>,
    note: String,
    cents: f32,
    confidence: f32,
    rms: f32,
    yin: Option<CandidateReport>,
    secondary: Option<CandidateReport>,
    selected: Option<CandidateReport>,
    fixed_gate_open: bool,
    adaptive_gate_open: bool,
    gate_threshold: f32,
    noise_floor: f32,
    arbitration: &'static str,
    decision: &'static str,
    held: bool,
    tracked: bool,
    spectral: Option<SpectralReport>,
}

#[derive(Serialize)]
struct CandidateReport {
    frequency: f32,
    confidence: f32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SpectralReport {
    base_frequency: f32,
    active_octave: i8,
    pending_octave: i8,
    harmonics: [f32; 5],
    octave_scores: [f32; 3],
}

impl ReplayEnvelope {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        path: String,
        capture_sha256: String,
        sample_rate: f32,
        sample_count: usize,
        window_samples: usize,
        hop_samples: usize,
        target_frequency: Option<f32>,
        detector: DetectorConfig,
        pipeline: PipelineConfig,
    ) -> Self {
        Self {
            schema_version: SCHEMA_VERSION,
            config_revision: CONFIG_REVISION,
            capture: CaptureMetadata {
                path,
                sha256: capture_sha256,
                sample_rate,
                sample_count,
                timebase: "sample-indexed-offline",
            },
            configuration: ReplayConfiguration {
                window_samples,
                hop_samples,
                reference_a4: 440.0,
                guidance: if target_frequency.is_some() {
                    "tuningTarget"
                } else {
                    "chromatic"
                },
                target_frequency,
                detector: detector.into(),
                pipeline: pipeline.into(),
            },
            frames: Vec::new(),
        }
    }

    pub fn push(&mut self, sample_index: usize, sample_rate: f32, frame: DetectionFrame) {
        let pipeline = frame.pipeline;
        self.frames.push(ReplayFrame {
            sample_index,
            window_end_sample: sample_index + pipeline.window_samples as usize,
            time_seconds: (sample_index + pipeline.window_samples as usize) as f32 / sample_rate,
            raw_frequency: frame.raw_freq,
            published_frequency: frame.freq,
            note: frame.note,
            cents: frame.cents,
            confidence: frame.confidence,
            rms: frame.rms,
            yin: pipeline.yin.map(Into::into),
            secondary: pipeline.secondary.map(Into::into),
            selected: pipeline.selected.map(Into::into),
            fixed_gate_open: pipeline.fixed_gate_open,
            adaptive_gate_open: pipeline.adaptive_gate_open,
            gate_threshold: pipeline.gate_threshold,
            noise_floor: pipeline.noise_floor,
            arbitration: pipeline.arbitration.as_str(),
            decision: pipeline.decision.as_str(),
            held: pipeline.held,
            tracked: pipeline.tracked,
            spectral: pipeline.spectral.map(Into::into),
        });
    }
}

impl From<PipelineCandidate> for CandidateReport {
    fn from(value: PipelineCandidate) -> Self {
        Self {
            frequency: value.frequency,
            confidence: value.confidence,
        }
    }
}

impl From<PipelineSpectralTelemetry> for SpectralReport {
    fn from(value: PipelineSpectralTelemetry) -> Self {
        Self {
            base_frequency: value.base_frequency,
            active_octave: value.active_octave,
            pending_octave: value.pending_octave,
            harmonics: value.harmonics,
            octave_scores: value.octave_scores,
        }
    }
}
