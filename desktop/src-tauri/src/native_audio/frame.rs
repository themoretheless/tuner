use super::config::{NativeAudioConfig, NativeAudioNote};
use pitch_core::{DetectorConfig, EngineConfig, TunerEngine, Tuning};
use serde::Serialize;

pub(crate) const EVENT_NAME: &str = "native-audio-frame";

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NativeAudioFrame {
    cents: f32,
    confidence: f32,
    freq: Option<f32>,
    in_tune: bool,
    is_power: bool,
    level: f32,
    note: String,
    rms: f32,
    target: Option<NativeAudioNote>,
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
        self.config = config;
    }

    pub(crate) fn process(&mut self, samples: &[f32], sample_rate: f32) -> NativeAudioFrame {
        let frame = self.engine.process(samples, sample_rate);
        NativeAudioFrame {
            cents: frame.cents,
            confidence: frame.confidence,
            freq: frame.freq,
            in_tune: frame.in_tune,
            is_power: frame.is_power,
            level: frame.level.clamp(0.0, 1.0),
            note: frame.note,
            rms: frame.rms,
            target: frame.target.map(NativeAudioNote::from_core),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native_audio::config::{NativeAudioRange, NativeFrameContext};

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
        let frame = processor.process(&samples, sample_rate);

        assert!((frame.freq.expect("pitch") - 440.0).abs() < 2.0);
        assert!(frame.confidence > 0.5);
        assert!(frame.level > 0.0);
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
    fn serialized_frame_has_one_top_level_frequency_field() {
        let frame = NativeAudioFrame {
            cents: 0.0,
            confidence: 1.0,
            freq: Some(440.0),
            in_tune: true,
            is_power: false,
            level: 0.5,
            note: "A4".to_string(),
            rms: 0.125,
            target: None,
        };
        let serialized = serde_json::to_value(frame).expect("serializable frame");

        assert_eq!(
            serialized,
            serde_json::json!({
                "cents": 0.0,
                "confidence": 1.0,
                "freq": 440.0,
                "inTune": true,
                "isPower": false,
                "level": 0.5,
                "note": "A4",
                "rms": 0.125,
                "target": null,
            })
        );
    }
}
