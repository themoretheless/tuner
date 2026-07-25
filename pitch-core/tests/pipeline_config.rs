use pitch_core::{
    DetectorConfig, EngineConfig, PipelineArbitration, PipelineConfig, PipelineDecision,
    TunerEngine, Tuning,
};

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

fn engine_default_range() -> TunerEngine {
    TunerEngine::with_config(EngineConfig {
        spectrum_bins: 0,
        tuning: Some(Tuning {
            name: "Chromatic",
            strings: Vec::new(),
        }),
        ..EngineConfig::default()
    })
}

/// A 1024-sample harmonic-rich 110 Hz frame: too short for the spectral
/// cross-check to trust the reported octave, so the detector holds an
/// unconfirmed fold and the engine reports OctavePending.
fn short_harmonic_buffer() -> Vec<f32> {
    (0..1024)
        .map(|index| {
            let phase = std::f32::consts::TAU * 110.0 * index as f32 / SAMPLE_RATE;
            0.05 * phase.sin()
                + (2.0 * phase).sin()
                + 0.5 * (3.0 * phase).sin()
                + 0.3 * (4.0 * phase).sin()
        })
        .collect()
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

#[test]
fn frame_exposes_real_candidate_and_decision_telemetry() {
    let samples = sine(220.0, 0.5);
    let pipeline = PipelineConfig {
        adaptive_gate_enabled: false,
        harmonic_enabled: false,
        octave_enabled: true,
        tracking_enabled: false,
        ..PipelineConfig::default()
    };
    let frame = engine(pipeline).process(&samples, SAMPLE_RATE);

    assert_eq!(frame.pipeline.arbitration, PipelineArbitration::Fused);
    assert_eq!(frame.pipeline.decision, PipelineDecision::Published);
    assert!(frame.pipeline.fixed_gate_open);
    assert!(frame.pipeline.adaptive_gate_open);
    assert!(frame.pipeline.yin.is_some());
    assert!(frame.pipeline.secondary.is_some());
    assert!(frame.pipeline.selected.is_some());
    assert_eq!(frame.pipeline.sample_rate, SAMPLE_RATE);
    assert_eq!(frame.pipeline.window_samples, samples.len() as u32);
    assert!(frame.pipeline.noise_floor > 0.0);
    assert!(frame.pipeline.gate_threshold >= frame.pipeline.noise_floor);
    let spectral = frame.pipeline.spectral.expect("bounded spectral evidence");
    assert!((spectral.base_frequency - 220.0).abs() < 1.0);
    assert!(spectral
        .harmonics
        .iter()
        .all(|value| (0.0..=1.0).contains(value)));
    assert!(spectral
        .octave_scores
        .iter()
        .all(|value| (0.0..=1.0).contains(value)));
    assert!(spectral.octave_scores[1] > spectral.octave_scores[0]);
}

#[test]
fn fixed_gate_rejection_is_visible_in_telemetry() {
    let pipeline = PipelineConfig {
        adaptive_gate_enabled: false,
        tracking_enabled: false,
        ..PipelineConfig::default()
    };
    let frame = engine(pipeline).process(&vec![0.0; 4096], SAMPLE_RATE);

    assert_eq!(frame.pipeline.decision, PipelineDecision::FixedGateRejected);
    assert!(!frame.pipeline.fixed_gate_open);
    assert!(frame.pipeline.selected.is_none());
}

#[test]
fn held_frame_keeps_pending_octave_correction_in_telemetry() {
    let suspicious = short_harmonic_buffer();

    // On a fresh engine (nothing to hold) the frame surfaces OctavePending.
    let fresh = engine_default_range().process(&suspicious, SAMPLE_RATE);
    assert_eq!(fresh.pipeline.decision, PipelineDecision::OctavePending);
    assert!(fresh.pipeline.octave_correction_pending);
    assert!(fresh.freq.is_none());

    // With a settled track the readout holds the last value through the
    // suppressed frame; the hold must not erase the octave suspicion.
    let stable = sine(110.0, 0.5);
    let mut tuner = engine_default_range();
    let mut published_freq = None;
    for _ in 0..8 {
        if let Some(frequency) = tuner.process(&stable, SAMPLE_RATE).freq {
            published_freq = Some(frequency);
            break;
        }
    }
    let published_freq = published_freq.expect("track settles on the stable tone");

    let held = tuner.process(&suspicious, SAMPLE_RATE);
    assert_eq!(held.pipeline.decision, PipelineDecision::Held);
    assert!(held.pipeline.held);
    assert!(
        held.pipeline.octave_correction_pending,
        "the hold must not erase the unconfirmed octave correction"
    );
    let held_freq = held.freq.expect("held reading keeps the settled value");
    assert!((held_freq - published_freq).abs() < 0.5);
}
