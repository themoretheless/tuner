use pitch_core::{DetectorConfig, EngineConfig, PipelineConfig, TunerEngine, Tuning};

const SAMPLE_RATE: f32 = 48_000.0;

fn sine(frequency: f32, amplitude: f32) -> Vec<f32> {
    (0..4096)
        .map(|index| {
            amplitude * (std::f32::consts::TAU * frequency * index as f32 / SAMPLE_RATE).sin()
        })
        .collect()
}

fn engine(pipeline: PipelineConfig) -> TunerEngine {
    TunerEngine::with_config(EngineConfig {
        detector: DetectorConfig::default().with_frequency_range(60.0, 500.0),
        pipeline,
        spectrum_bins: 0,
        tuning: Some(Tuning {
            name: "Chromatic",
            strings: Vec::new(),
        }),
        ..EngineConfig::default()
    })
}

#[test]
fn disabling_tracking_publishes_the_first_coherent_frame() {
    let samples = sine(220.0, 0.5);
    let mut stable = engine(PipelineConfig::default());
    assert!(stable.process(&samples, SAMPLE_RATE).freq.is_none());

    let mut raw = engine(PipelineConfig {
        adaptive_gate_enabled: false,
        harmonic_enabled: false,
        hold_enabled: false,
        octave_enabled: false,
        power_chord_enabled: false,
        tracking_enabled: false,
        ..PipelineConfig::default()
    });
    let frame = raw.process(&samples, SAMPLE_RATE);
    assert!((frame.freq.expect("raw pitch") - 220.0).abs() < 1.0);
}

#[test]
fn either_candidate_provider_can_run_independently() {
    let samples = sine(220.0, 0.5);
    for pipeline in [
        PipelineConfig {
            adaptive_gate_enabled: false,
            octave_enabled: false,
            secondary_detector_enabled: false,
            tracking_enabled: false,
            ..PipelineConfig::default()
        },
        PipelineConfig {
            adaptive_gate_enabled: false,
            octave_enabled: false,
            tracking_enabled: false,
            yin_enabled: false,
            ..PipelineConfig::default()
        },
    ] {
        let frame = engine(pipeline).process(&samples, SAMPLE_RATE);
        assert!((frame.freq.expect("provider pitch") - 220.0).abs() < 1.0);
    }
}

#[test]
fn changing_pipeline_config_resets_old_tracking_state() {
    let first = sine(220.0, 0.5);
    let second = sine(330.0, 0.5);
    let mut tuner = engine(PipelineConfig::default());
    assert!(tuner.process(&first, SAMPLE_RATE).freq.is_none());
    assert!(tuner.process(&first, SAMPLE_RATE).freq.is_some());

    tuner.set_pipeline_config(PipelineConfig {
        adaptive_gate_enabled: false,
        octave_enabled: false,
        tracking_enabled: false,
        ..PipelineConfig::default()
    });
    let frame = tuner.process(&second, SAMPLE_RATE);
    assert!((frame.freq.expect("new raw pitch") - 330.0).abs() < 1.5);
}
