use super::config::{NativeAudioConfig, NativeAudioNote};
use pitch_core::{
    DetectorConfig, EngineConfig, PipelineCandidate, PipelineConfidenceTelemetry,
    PipelineSpectralTelemetry, PipelineTelemetry, TunerEngine, Tuning,
};
use serde::Serialize;
use std::time::Instant;

pub(crate) const EVENT_NAME: &str = "native-audio-frame";
pub(crate) const ERROR_EVENT_NAME: &str = "native-audio-error";

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NativeAudioError {
    message: String,
}

impl NativeAudioError {
    pub(crate) fn new(message: String) -> Self {
        Self { message }
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NativeAudioFrame {
    cents: f32,
    confidence: f32,
    freq: Option<f32>,
    raw_freq: Option<f32>,
    in_tune: bool,
    is_power: bool,
    level: f32,
    note: String,
    rms: f32,
    pipeline: NativePipelineTelemetry,
    target: Option<NativeAudioNote>,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NativePipelineCandidate {
    confidence: f32,
    frequency: f32,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NativePipelineTelemetry {
    adaptive_gate_open: bool,
    arbitration: &'static str,
    confidence: NativePipelineConfidenceTelemetry,
    config_fingerprint: u32,
    decision: &'static str,
    fixed_gate_open: bool,
    gate_threshold: f32,
    held: bool,
    interference: Option<NativePipelineInterferenceTelemetry>,
    noise_floor: f32,
    processing_ms: f32,
    sample_rate: f32,
    secondary: Option<NativePipelineCandidate>,
    selected: Option<NativePipelineCandidate>,
    spectral: Option<NativePipelineSpectralTelemetry>,
    tracked: bool,
    window_samples: u32,
    yin: Option<NativePipelineCandidate>,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NativePipelineConfidenceTelemetry {
    agreement: f32,
    calibrated: f32,
    periodicity: f32,
    signal: f32,
    stability: f32,
    uncertainty_cents: f32,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NativePipelineInterferenceTelemetry {
    candidate_frequency: f32,
    competing_target_frequency: f32,
    distance_cents: f32,
    selected_target_frequency: f32,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NativePipelineSpectralTelemetry {
    active_octave: i8,
    base_frequency: f32,
    harmonics: [f32; 5],
    octave_scores: [f32; 3],
    pending_octave: i8,
}

impl NativePipelineTelemetry {
    fn from_core(telemetry: PipelineTelemetry) -> Self {
        Self {
            adaptive_gate_open: telemetry.adaptive_gate_open,
            arbitration: telemetry.arbitration.as_str(),
            confidence: NativePipelineConfidenceTelemetry::from_core(telemetry.confidence),
            config_fingerprint: telemetry.config_fingerprint,
            decision: telemetry.decision.as_str(),
            fixed_gate_open: telemetry.fixed_gate_open,
            gate_threshold: telemetry.gate_threshold,
            held: telemetry.held,
            interference: telemetry
                .interference
                .map(|value| NativePipelineInterferenceTelemetry {
                    candidate_frequency: value.candidate_frequency,
                    competing_target_frequency: value.competing_target_frequency,
                    distance_cents: value.distance_cents,
                    selected_target_frequency: value.selected_target_frequency,
                }),
            noise_floor: telemetry.noise_floor,
            processing_ms: telemetry.processing_ms,
            sample_rate: telemetry.sample_rate,
            secondary: telemetry.secondary.map(NativePipelineCandidate::from_core),
            selected: telemetry.selected.map(NativePipelineCandidate::from_core),
            spectral: telemetry
                .spectral
                .map(NativePipelineSpectralTelemetry::from_core),
            tracked: telemetry.tracked,
            window_samples: telemetry.window_samples,
            yin: telemetry.yin.map(NativePipelineCandidate::from_core),
        }
    }
}

impl NativePipelineConfidenceTelemetry {
    fn from_core(telemetry: PipelineConfidenceTelemetry) -> Self {
        Self {
            agreement: telemetry.agreement,
            calibrated: telemetry.calibrated,
            periodicity: telemetry.periodicity,
            signal: telemetry.signal,
            stability: telemetry.stability,
            uncertainty_cents: telemetry.uncertainty_cents,
        }
    }
}

impl NativePipelineSpectralTelemetry {
    fn from_core(telemetry: PipelineSpectralTelemetry) -> Self {
        Self {
            active_octave: telemetry.active_octave,
            base_frequency: telemetry.base_frequency,
            harmonics: telemetry.harmonics,
            octave_scores: telemetry.octave_scores,
            pending_octave: telemetry.pending_octave,
        }
    }
}

impl NativePipelineCandidate {
    fn from_core(candidate: PipelineCandidate) -> Self {
        Self {
            confidence: candidate.confidence,
            frequency: candidate.frequency,
        }
    }
}

pub(crate) struct NativeFrameProcessor {
    config: NativeAudioConfig,
    engine: TunerEngine,
}

impl NativeFrameProcessor {
    pub(crate) fn new(config: NativeAudioConfig) -> Self {
        let config = config.normalized();
        let range = config.range;
        let detector = DetectorConfig::default()
            .with_frequency_range(range.min_frequency, range.max_frequency);
        Self {
            engine: TunerEngine::with_config(EngineConfig {
                a4: config.context.a4,
                detector,
                frame_context: Some(config.context.to_core()),
                pipeline: config.pipeline.to_core(),
                spectrum_bins: 0,
                tuning: Some(Tuning {
                    name: "Chromatic",
                    strings: Vec::new(),
                }),
                ..EngineConfig::default()
            }),
            config,
        }
    }

    pub(crate) fn update_config(&mut self, config: NativeAudioConfig) {
        let config = config.normalized();
        if config.range != self.config.range {
            self.engine
                .set_detection_range(config.range.min_frequency, config.range.max_frequency);
        }
        if config.context != self.config.context {
            self.engine
                .set_frame_context(Some(config.context.to_core()));
        }
        if config.pipeline != self.config.pipeline {
            self.engine.set_pipeline_config(config.pipeline.to_core());
        }
        self.config = config;
    }

    pub(crate) fn process(&mut self, samples: &[f32], sample_rate: f32) -> NativeAudioFrame {
        let started = Instant::now();
        let mut frame = self.engine.process(samples, sample_rate);
        frame.pipeline.processing_ms = started.elapsed().as_secs_f32() * 1_000.0;
        NativeAudioFrame {
            cents: frame.cents,
            confidence: frame.confidence,
            freq: frame.freq,
            raw_freq: frame.raw_freq,
            in_tune: frame.in_tune,
            is_power: frame.is_power,
            level: frame.level.clamp(0.0, 1.0),
            note: frame.note,
            rms: frame.rms,
            pipeline: NativePipelineTelemetry::from_core(frame.pipeline),
            target: frame.target.map(NativeAudioNote::from_core),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native_audio::config::{NativeAudioRange, NativeFrameContext, NativePipelineConfig};
    use tuner_test_support::{cents_error, load_session_replay_contract, read_fixture_capture};

    #[test]
    fn processor_uses_shared_pitch_core() {
        let sample_rate = 48_000.0;
        let samples: Vec<f32> = (0..4096)
            .map(|index| (2.0 * std::f32::consts::PI * 440.0 * index as f32 / sample_rate).sin())
            .collect();
        let config = NativeAudioConfig {
            range: NativeAudioRange {
                min_frequency: 400.0,
                max_frequency: 500.0,
            },
            ..NativeAudioConfig::default()
        };
        let mut processor = NativeFrameProcessor::new(config);
        assert!(processor.process(&samples, sample_rate).freq.is_none());
        let frame = processor.process(&samples, sample_rate);

        assert!((frame.freq.expect("pitch") - 440.0).abs() < 2.0);
        assert!(frame.confidence > 0.5);
        assert!(frame.level > 0.0);
    }

    #[test]
    fn licensed_session_replay_reaches_native_wire_frames() {
        let contract = load_session_replay_contract();
        assert_eq!(contract.schema_version, 1);

        for replay_case in contract.cases {
            let capture = read_fixture_capture(&replay_case.capture);
            let sample_rate = capture.sample_rate;
            let samples = capture.samples;
            let target = NativeAudioNote {
                frequency: replay_case.target.frequency,
                name: replay_case.target.name.clone(),
                octave: replay_case.target.octave,
            };
            let mut processor = NativeFrameProcessor::new(NativeAudioConfig {
                context: NativeFrameContext {
                    display_targets: vec![target.clone()],
                    idle_target: Some(target.clone()),
                    selected_target: Some(target.clone()),
                    tuning_targets: vec![target.clone()],
                    ..NativeFrameContext::default()
                },
                range: NativeAudioRange {
                    min_frequency: contract.range.min_frequency,
                    max_frequency: contract.range.max_frequency,
                },
                ..NativeAudioConfig::default()
            });
            let hop_samples = (sample_rate * contract.hop_seconds).round() as usize;
            let expected_note = format!("{}{}", replay_case.target.name, replay_case.target.octave);
            let mut published_frames = 0usize;

            for frame_index in 0..contract.maximum_frames {
                let start = frame_index * hop_samples;
                let end = start + contract.window_samples;
                if end > samples.len() {
                    break;
                }
                let frame = processor.process(&samples[start..end], sample_rate);
                let serialized = serde_json::to_value(&frame).expect("serializable native frame");
                assert!(
                    serialized.get("freq").is_some(),
                    "{} wire freq",
                    replay_case.id
                );
                assert!(
                    serialized.get("rawFreq").is_some(),
                    "{} wire rawFreq",
                    replay_case.id
                );
                let Some(frequency) = frame.freq else {
                    continue;
                };
                published_frames += 1;
                assert_eq!(frame.note, expected_note, "{} note", replay_case.id);
                assert_eq!(
                    frame.target.as_ref().map(|note| note.frequency),
                    Some(target.frequency),
                    "{} target",
                    replay_case.id
                );
                assert!(
                    cents_error(frequency, target.frequency) < 35.0,
                    "{} published {frequency:.3} Hz for {:.3} Hz target",
                    replay_case.id,
                    target.frequency
                );
            }

            assert!(published_frames > 0, "{} never acquired", replay_case.id);
        }
    }

    #[test]
    fn processor_applies_dynamic_frame_context() {
        let target = NativeAudioNote {
            frequency: 442.0,
            name: "A".to_string(),
            octave: 4,
        };
        let config = NativeAudioConfig {
            context: NativeFrameContext {
                a4: 442.0,
                display_targets: vec![target.clone()],
                idle_target: Some(target.clone()),
                selected_target: Some(target),
                ..NativeFrameContext::default()
            },
            pipeline: Default::default(),
            range: NativeAudioRange {
                min_frequency: 400.0,
                max_frequency: 500.0,
            },
        };
        let sample_rate = 48_000.0;
        let samples: Vec<f32> = (0..4096)
            .map(|index| (2.0 * std::f32::consts::PI * 440.0 * index as f32 / sample_rate).sin())
            .collect();
        let mut processor = NativeFrameProcessor::new(config);

        assert!(processor.process(&samples, sample_rate).freq.is_none());
        let frame = processor.process(&samples, sample_rate);
        assert_eq!(frame.note, "A4");
        assert_eq!(
            frame.target.as_ref().map(|note| note.frequency),
            Some(442.0)
        );
        assert!(frame.cents < -7.0);
        assert!(!frame.in_tune);
    }

    #[test]
    fn processor_applies_pipeline_configuration() {
        let config = NativeAudioConfig {
            pipeline: NativePipelineConfig {
                adaptive_gate_enabled: false,
                harmonic_enabled: false,
                hold_enabled: false,
                octave_enabled: false,
                power_chord_enabled: false,
                tracking_enabled: false,
                ..NativePipelineConfig::default()
            },
            range: NativeAudioRange {
                min_frequency: 180.0,
                max_frequency: 260.0,
            },
            ..NativeAudioConfig::default()
        };
        let sample_rate = 48_000.0;
        let samples: Vec<f32> = (0..4096)
            .map(|index| (std::f32::consts::TAU * 220.0 * index as f32 / sample_rate).sin())
            .collect();
        let mut processor = NativeFrameProcessor::new(config);

        let frame = processor.process(&samples, sample_rate);
        assert!((frame.freq.expect("raw pitch") - 220.0).abs() < 1.0);
    }

    #[test]
    fn serialized_frame_has_one_top_level_frequency_field() {
        let frame = NativeAudioFrame {
            cents: 0.0,
            confidence: 1.0,
            freq: Some(440.0),
            raw_freq: Some(439.5),
            in_tune: true,
            is_power: false,
            level: 0.5,
            note: "A4".to_string(),
            rms: 0.125,
            pipeline: NativePipelineTelemetry::from_core(PipelineTelemetry::default()),
            target: None,
        };
        let serialized = serde_json::to_value(frame).expect("serializable frame");

        assert_eq!(
            serialized,
            serde_json::json!({
                "cents": 0.0,
                "confidence": 1.0,
                "freq": 440.0,
                "rawFreq": 439.5,
                "inTune": true,
                "isPower": false,
                "level": 0.5,
                "note": "A4",
                "rms": 0.125,
                "pipeline": {
                    "adaptiveGateOpen": false,
                    "arbitration": "none",
                    "confidence": {
                        "agreement": 0.0,
                        "calibrated": 0.0,
                        "periodicity": 0.0,
                        "signal": 0.0,
                        "stability": 0.0,
                        "uncertaintyCents": 100.0,
                    },
                    "configFingerprint": 0,
                    "decision": "no-candidate",
                    "fixedGateOpen": false,
                    "gateThreshold": 0.0,
                    "held": false,
                    "interference": null,
                    "noiseFloor": 0.0,
                    "processingMs": 0.0,
                    "sampleRate": 0.0,
                    "secondary": null,
                    "selected": null,
                    "spectral": null,
                    "tracked": false,
                    "windowSamples": 0,
                    "yin": null,
                },
                "target": null,
            })
        );
    }
}
