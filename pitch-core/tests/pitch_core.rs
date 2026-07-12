use pitch_core::*;

fn sine_buffer(frequency: f32, sample_rate: f32, length: usize) -> Vec<f32> {
    sine_buffer_with_offset(frequency, sample_rate, length, 1.0, 0.0)
}

fn sine_buffer_with_offset(
    frequency: f32,
    sample_rate: f32,
    length: usize,
    gain: f32,
    offset: f32,
) -> Vec<f32> {
    (0..length)
        .map(|index| {
            (2.0 * std::f32::consts::PI * frequency * index as f32 / sample_rate).sin() * gain
                + offset
        })
        .collect()
}

#[test]
fn yin_detects_440_hz() {
    let mut detector =
        YinDetector::new(DetectorConfig::default().with_frequency_range(30.0, 1_200.0));
    let estimate = detector
        .detect(&sine_buffer(440.0, 44_100.0, 2048), 44_100.0)
        .expect("440 Hz should be detected");
    assert!((estimate.frequency - 440.0).abs() < 2.0);
    assert!(estimate.confidence > 0.5);

    let mut strict = YinDetector::new(
        DetectorConfig::default()
            .with_frequency_range(30.0, 1_200.0)
            .with_min_confidence(1.0),
    );
    assert!(strict
        .detect(&sine_buffer(440.0, 44_100.0, 2048), 44_100.0)
        .is_none());
}

#[test]
fn mpm_detects_440_hz() {
    let mut detector =
        MpmDetector::new(DetectorConfig::default().with_frequency_range(30.0, 1_200.0));
    let estimate = detector
        .detect(&sine_buffer(440.0, 44_100.0, 2048), 44_100.0)
        .expect("440 Hz should be detected");
    assert!((estimate.frequency - 440.0).abs() < 2.0);

    let mut strict = MpmDetector::new(
        DetectorConfig::default()
            .with_frequency_range(30.0, 1_200.0)
            .with_min_confidence(1.0),
    );
    assert!(strict
        .detect(&sine_buffer(440.0, 44_100.0, 2048), 44_100.0)
        .is_none());
}

#[test]
fn detector_respects_configured_frequency_range() {
    let config = DetectorConfig::default().with_frequency_range(800.0, 1_200.0);
    let mut detector = HybridPitchDetector::new(config);
    let estimate = detector
        .detect(&sine_buffer(880.0, 48_000.0, 4096), 48_000.0)
        .expect("vocal range should not be limited to guitar frequencies");
    assert!((estimate.frequency - 880.0).abs() < 3.0);
}

#[test]
fn note_math_and_tunings_are_consistent() {
    let (name, cents) = frequency_to_note(440.0, 440.0);
    assert_eq!(name, "A4");
    assert!(cents.abs() < 0.1);
    assert!(get_cents(445.0, 440.0) > 0.0);

    let tunings = get_tunings();
    let standard = &tunings[0].strings;
    assert_eq!(find_closest_string(110.0, standard, 440.0).name, "A");
    for name in [
        "Drop B (BF#BEG#C#)",
        "Open C (CGCGCE)",
        "Open A (EAC#EAE)",
        "Full Step Down (DGCFAD)",
        "Open Gm (DGDGA#D)",
    ] {
        let tuning = tunings
            .iter()
            .find(|tuning| tuning.name == name)
            .unwrap_or_else(|| panic!("missing tuning {name}"));
        assert_eq!(tuning.strings.len(), 6);
        assert!(tuning
            .strings
            .windows(2)
            .all(|window| window[1].frequency > window[0].frequency));
    }
}

#[test]
fn engine_emits_detection_frame_and_optional_spectrum() {
    let buffer = sine_buffer(110.0, 44_100.0, 4096);
    let mut engine = TunerEngine::new(440.0);
    let frame = engine.process(&buffer, 44_100.0);
    assert_eq!(frame.note, "A2");
    assert!(frame.confidence > 0.5);
    assert!(frame.rms > 0.0 && frame.level > 0.0);
    assert!(frame.cents.abs() < 5.0);
    assert!(frame.in_tune);
    assert_eq!(frame.target.as_ref().map(|note| note.name), Some("A"));
    assert_eq!(frame.spectrum.len(), 512);

    let mut pitch_only = TunerEngine::with_config(EngineConfig {
        spectrum_bins: 0,
        ..EngineConfig::default()
    });
    assert!(pitch_only.process(&buffer, 44_100.0).spectrum.is_empty());
    pitch_only.set_spectrum_enabled(true);
    assert_eq!(pitch_only.process(&buffer, 44_100.0).spectrum.len(), 512);
    pitch_only.set_spectrum_enabled(false);
    assert!(pitch_only.process(&buffer, 44_100.0).spectrum.is_empty());
}

#[test]
fn engine_does_not_blend_a_new_note_with_pitch_before_silence() {
    let sample_rate = 44_100.0;
    let mut engine = TunerEngine::with_config(EngineConfig {
        spectrum_bins: 0,
        ..EngineConfig::default()
    });
    let _ = engine.process(&sine_buffer(110.0, sample_rate, 4096), sample_rate);
    assert!(engine.process(&[0.0; 4096], sample_rate).freq.is_none());

    let frequency = engine
        .process(&sine_buffer(220.0, sample_rate, 4096), sample_rate)
        .freq
        .expect("pitch after silence");
    assert!((frequency - 220.0).abs() < 2.0);
}

#[test]
fn guitar_fundamentals_do_not_jump_octaves() {
    let mut detector = HybridPitchDetector::default();
    for expected in [82.4069_f32, 110.0, 146.8324, 195.9977, 246.9417, 329.6276] {
        let estimate = detector
            .detect(&sine_buffer(expected, 44_100.0, 2048), 44_100.0)
            .unwrap_or_else(|| panic!("no detection for {expected} Hz"));
        assert!((estimate.frequency - expected).abs() < 2.0);
        assert!(estimate.confidence > 0.5);
    }
}

#[test]
fn detector_removes_dc_offset() {
    let buffer = sine_buffer_with_offset(110.0, 44_100.0, 2048, 1.0, 0.6);
    let (frequency, _) = detect_pitch(&buffer, 44_100.0).expect("pitch should survive DC bias");
    assert!((frequency - 110.0).abs() < 2.0);
}
