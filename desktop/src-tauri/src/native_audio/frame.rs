use pitch_core::{DetectorConfig, EngineConfig, TunerEngine, Tuning};
use serde::{Deserialize, Serialize};

pub(crate) const EVENT_NAME: &str = "native-audio-frame";

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
        let min_frequency = self.min_frequency.clamp(20.0, 600.0);
        let max_frequency = self.max_frequency.clamp(80.0, 1_800.0);
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

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NativeAudioFrame {
    cents: f32,
    confidence: f32,
    freq: Option<f32>,
    frequency: Option<f32>,
    in_tune: bool,
    is_power: bool,
    level: f32,
    note: String,
    rms: f32,
    target: Option<NativeAudioNote>,
}

#[derive(Clone, Serialize)]
pub(crate) struct NativeAudioNote {
    frequency: f32,
    name: String,
    octave: i32,
}

pub(crate) struct NativeFrameProcessor {
    engine: TunerEngine,
    range: NativeAudioRange,
}

impl NativeFrameProcessor {
    pub(crate) fn new(range: NativeAudioRange) -> Self {
        let range = range.normalized();
        let detector = DetectorConfig::default()
            .with_frequency_range(range.min_frequency, range.max_frequency);
        Self {
            engine: TunerEngine::with_config(EngineConfig {
                detector,
                spectrum_bins: 0,
                tuning: Some(Tuning {
                    name: "Chromatic",
                    strings: Vec::new(),
                }),
                ..EngineConfig::default()
            }),
            range,
        }
    }

    pub(crate) fn process(
        &mut self,
        samples: &[f32],
        sample_rate: f32,
        range: NativeAudioRange,
    ) -> NativeAudioFrame {
        let range = range.normalized();
        if range != self.range {
            self.engine
                .set_detection_range(range.min_frequency, range.max_frequency);
            self.range = range;
        }

        let frame = self.engine.process(samples, sample_rate);
        NativeAudioFrame {
            cents: frame.cents,
            confidence: frame.confidence,
            freq: frame.freq,
            frequency: frame.freq,
            in_tune: frame.in_tune,
            is_power: frame.is_power,
            level: frame.level.clamp(0.0, 1.0),
            note: frame.note,
            rms: frame.rms,
            target: frame.target.map(|note| NativeAudioNote {
                frequency: note.frequency,
                name: note.name.to_string(),
                octave: note.octave,
            }),
        }
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
    }

    #[test]
    fn processor_uses_shared_pitch_core() {
        let sample_rate = 48_000.0;
        let samples: Vec<f32> = (0..4096)
            .map(|index| (2.0 * std::f32::consts::PI * 440.0 * index as f32 / sample_rate).sin())
            .collect();
        let range = NativeAudioRange {
            min_frequency: 400.0,
            max_frequency: 500.0,
        };
        let mut processor = NativeFrameProcessor::new(range);
        let frame = processor.process(&samples, sample_rate, range);

        assert!((frame.freq.expect("pitch") - 440.0).abs() < 2.0);
        assert!(frame.confidence > 0.5);
        assert!(frame.level > 0.0);
    }
}
