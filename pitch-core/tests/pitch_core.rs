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

/// A periodic tone at `fundamental` with the given per-harmonic gains
/// (`gains[0]` scales the fundamental, `gains[1]` the 2nd harmonic, ...).
fn harmonic_buffer(fundamental: f32, sample_rate: f32, length: usize, gains: &[f32]) -> Vec<f32> {
    (0..length)
        .map(|index| {
            let phase = 2.0 * std::f32::consts::PI * fundamental * index as f32 / sample_rate;
            gains
                .iter()
                .enumerate()
                .map(|(harmonic, gain)| (phase * (harmonic + 1) as f32).sin() * gain)
                .sum()
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

#[test]
fn octave_crosscheck_folds_a_harmonic_lock_back_to_the_fundamental() {
    // A guitar-like tone at 110 Hz; a detector that erroneously locked onto
    // the 2nd harmonic (220 Hz) should be folded back down, because the
    // spectrum clearly carries energy at 110 Hz and 330 Hz. The fold needs
    // two consecutive frames of evidence to engage, so the first frame
    // passes through unchanged.
    let buffer = harmonic_buffer(110.0, 48_000.0, 4096, &[1.0, 0.6, 0.4, 0.25]);
    let mut checker = OctaveDisambiguator::new();
    let first = checker.resolve(&buffer, 48_000.0, 220.0, 30.0, 400.0);
    assert!(
        (first - 220.0).abs() < 1.0,
        "expected the first frame to pass through while the fold confirms, got {first}"
    );
    let resolved = checker.resolve(&buffer, 48_000.0, 220.0, 30.0, 400.0);
    assert!(
        (resolved - 110.0).abs() < 1.0,
        "expected the confirmed octave-up lock to fold back to 110 Hz, got {resolved}"
    );
}

#[test]
fn octave_crosscheck_folds_a_subharmonic_lock_up_to_the_real_pitch() {
    // A tone at 220 Hz; a detector that erroneously reported 110 Hz should
    // be folded up, because 110 Hz's odd harmonics (110, 330, 550) are empty
    // while its even ones (220, 440, 660) carry all the energy.
    let buffer = harmonic_buffer(220.0, 48_000.0, 4096, &[1.0, 0.5, 0.3]);
    let mut checker = OctaveDisambiguator::new();
    checker.resolve(&buffer, 48_000.0, 110.0, 30.0, 400.0);
    let resolved = checker.resolve(&buffer, 48_000.0, 110.0, 30.0, 400.0);
    assert!(
        (resolved - 220.0).abs() < 1.0,
        "expected the confirmed subharmonic lock to fold up to 220 Hz, got {resolved}"
    );
}

#[test]
fn octave_crosscheck_does_not_flip_on_a_single_contradictory_frame() {
    // Once a fold is engaged, one borderline frame must not toggle it: the
    // readout stayed folded through the ambiguous frame instead of slamming
    // an octave back and forth.
    let locked = harmonic_buffer(110.0, 48_000.0, 4096, &[1.0, 0.6, 0.4, 0.25]);
    let mut checker = OctaveDisambiguator::new();
    checker.resolve(&locked, 48_000.0, 220.0, 30.0, 400.0);
    checker.resolve(&locked, 48_000.0, 220.0, 30.0, 400.0);

    // The fold stays engaged on further consistent frames...
    let resolved = checker.resolve(&locked, 48_000.0, 220.0, 30.0, 400.0);
    assert!((resolved - 110.0).abs() < 1.0);

    // ...and a genuinely corrected estimate (the detector itself now says
    // 110 Hz, whose sub-octave carries no energy) passes through unfolded
    // on the very same frame - the fold must not halve it to 55 Hz.
    let resolved = checker.resolve(&locked, 48_000.0, 110.0, 30.0, 400.0);
    assert!(
        (resolved - 110.0).abs() < 1.0,
        "expected the corrected estimate to disengage the fold immediately, got {resolved}"
    );
}

#[test]
fn octave_crosscheck_keeps_a_correct_estimate() {
    let mut checker = OctaveDisambiguator::new();

    let rich = harmonic_buffer(110.0, 48_000.0, 4096, &[1.0, 0.6, 0.4, 0.25]);
    let resolved = checker.resolve(&rich, 48_000.0, 110.0, 30.0, 400.0);
    assert!(
        (resolved - 110.0).abs() < 1.0,
        "expected a correct harmonic-rich estimate to pass through, got {resolved}"
    );

    let pure = sine_buffer(220.0, 48_000.0, 4096);
    let resolved = checker.resolve(&pure, 48_000.0, 220.0, 30.0, 400.0);
    assert!(
        (resolved - 220.0).abs() < 1.0,
        "expected a correct pure-sine estimate to pass through, got {resolved}"
    );
}

#[test]
fn octave_crosscheck_trusts_periodicity_when_the_fundamental_is_weak() {
    // A low string through a high-pass-filtered mic: the fundamental at
    // ~82 Hz is weak and the 2nd harmonic dominates. The spectral *peak*
    // sits at 165 Hz, but the pitch is still 82 Hz - the odd harmonics
    // (82, 247, 412) prove it. The cross-check must NOT "fix" this.
    let buffer = harmonic_buffer(82.4, 48_000.0, 4096, &[0.15, 1.0, 0.8, 0.6, 0.4]);
    let mut checker = OctaveDisambiguator::new();
    let resolved = checker.resolve(&buffer, 48_000.0, 82.4, 30.0, 400.0);
    assert!(
        (resolved - 82.4).abs() < 1.0,
        "expected the weak-fundamental estimate to be kept at 82.4 Hz, got {resolved}"
    );
}

#[test]
fn octave_crosscheck_respects_the_configured_frequency_range() {
    // Even with spectral evidence for 110 Hz, the fold-down must not
    // produce a frequency below the detector's configured minimum.
    let buffer = harmonic_buffer(110.0, 48_000.0, 4096, &[1.0, 0.6, 0.4]);
    let mut checker = OctaveDisambiguator::new();
    let resolved = checker.resolve(&buffer, 48_000.0, 220.0, 150.0, 400.0);
    assert!(
        (resolved - 220.0).abs() < 1.0,
        "expected no fold below the configured minimum, got {resolved}"
    );
}

#[test]
fn hybrid_detector_still_finds_fundamentals_of_harmonic_rich_tones() {
    // End-to-end sanity: the cross-check wired into HybridPitchDetector must
    // not disturb correct detections on realistic harmonic-rich guitar tones.
    let mut detector = HybridPitchDetector::default();
    for expected in [82.4069_f32, 110.0, 146.8324, 196.0, 246.9417, 329.6276] {
        let buffer = harmonic_buffer(expected, 48_000.0, 4096, &[1.0, 0.5, 0.3, 0.2]);
        let estimate = detector
            .detect(&buffer, 48_000.0)
            .unwrap_or_else(|| panic!("no detection for {expected} Hz"));
        assert!(
            (estimate.frequency - expected).abs() < 2.0,
            "expected {expected} Hz, got {}",
            estimate.frequency
        );
    }
}

#[test]
fn smoother_folds_a_single_frame_octave_error_back_to_the_stable_reading() {
    let mut smoother = Smoother::new();
    for _ in 0..4 {
        smoother.add(Some(110.0));
    }
    // A one-off misdetection at 2x the settled reading (e.g. a stray YIN/MPM
    // harmonic lock) should be folded back, not yank the readout to 220 Hz.
    let during_conflict = smoother.add(Some(220.0)).expect("smoothed value");
    assert!(
        (during_conflict - 110.0).abs() < 5.0,
        "expected the transient octave-up reading to be folded near 110 Hz, got {during_conflict}"
    );

    // Same for a one-off half-frequency misdetection.
    let mut smoother = Smoother::new();
    for _ in 0..4 {
        smoother.add(Some(220.0));
    }
    let during_conflict = smoother.add(Some(110.0)).expect("smoothed value");
    assert!(
        (during_conflict - 220.0).abs() < 5.0,
        "expected the transient octave-down reading to be folded near 220 Hz, got {during_conflict}"
    );
}

#[test]
fn smoother_accepts_a_sustained_octave_change_as_a_real_note() {
    let mut smoother = Smoother::new();
    for _ in 0..4 {
        smoother.add(Some(110.0));
    }
    // A genuine octave-up note change should still win once it persists:
    // the 8-frame fold streak lets the raw 220 Hz value through, and then
    // the (pre-existing) EMA + median-of-5 history needs a few more frames
    // to fully turn over before the readout settles near 220 Hz.
    let mut last = None;
    for _ in 0..20 {
        last = smoother.add(Some(220.0));
    }
    let settled = last.expect("smoothed value");
    assert!(
        (settled - 220.0).abs() < 5.0,
        "expected a sustained octave change to settle near 220 Hz, got {settled}"
    );
}

/// Deterministic pseudo-noise (LCG): audible level, but no periodic pitch
/// for the detector to lock onto - models the messy tail of a decaying
/// string where the signal is still above the gate but detection fails.
fn noise_buffer(length: usize, amplitude: f32) -> Vec<f32> {
    let mut state: u32 = 0x1234_5678;
    (0..length)
        .map(|_| {
            state = state.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
            let unit = (state >> 8) as f32 / (1 << 24) as f32;
            (unit * 2.0 - 1.0) * amplitude
        })
        .collect()
}

#[test]
fn engine_rides_out_brief_detection_dropouts_while_the_signal_persists() {
    let sample_rate = 44_100.0;
    let mut engine = TunerEngine::with_config(EngineConfig {
        spectrum_bins: 0,
        ..EngineConfig::default()
    });
    for _ in 0..5 {
        engine.process(&sine_buffer(110.0, sample_rate, 4096), sample_rate);
    }

    // A decaying string: the frame is still well above the RMS gate but the
    // detector can't lock a pitch. The readout must hold the last smoothed
    // value instead of clearing and later re-showing a raw, jittery one.
    let noise = noise_buffer(4096, 0.05);
    let held = engine.process(&noise, sample_rate);
    let held_freq = held
        .freq
        .expect("reading should be held through a brief dropout");
    assert!(
        (held_freq - 110.0).abs() < 3.0,
        "expected the held reading to stay near 110 Hz, got {held_freq}"
    );

    // Detection coming back after the dropout stays smoothed against the
    // preserved history - no raw jump.
    let reacquired = engine.process(&sine_buffer(110.0, sample_rate, 4096), sample_rate);
    let freq = reacquired.freq.expect("pitch after dropout");
    assert!((freq - 110.0).abs() < 3.0);

    // A sustained dropout eventually clears the readout.
    let mut last = reacquired.freq;
    for _ in 0..12 {
        last = engine.process(&noise, sample_rate).freq;
    }
    assert!(
        last.is_none(),
        "expected a sustained dropout to clear the readout"
    );
}

#[test]
fn smoother_leaves_normal_pitch_bends_untouched() {
    let mut smoother = Smoother::new();
    // A vibrato/bend sweep from 110 Hz up to ~116 Hz (a few percent, nowhere
    // near an octave ratio) should track smoothly, not get folded - run
    // enough frames for the median-of-5 history to reflect the new values.
    let mut last = 110.0;
    for step in 0..10 {
        let target = 110.0 + (step as f32).min(6.0) * 1.0;
        last = smoother.add(Some(target)).expect("smoothed value");
    }
    assert!(
        (last - 116.0).abs() < 3.0,
        "expected the smoother to track a normal pitch bend, got {last}"
    );
}

#[test]
fn weak_low_e_fundamental_is_not_doubled_to_its_loudest_harmonic() {
    // A real low E through a phone/laptop microphone often has a tiny 82 Hz
    // fundamental and a dominant 165 Hz second harmonic. Periodicity still
    // identifies E2 correctly; the spectral cross-check must not override it
    // with the loudest FFT peak and publish E3.
    let sample_rate = 48_000.0;
    let buffer = harmonic_buffer(82.4069, sample_rate, 4096, &[0.08, 1.0, 0.25, 0.6, 0.15]);
    let mut engine = TunerEngine::with_config(EngineConfig {
        spectrum_bins: 0,
        ..EngineConfig::default()
    });

    for _ in 0..8 {
        let frame = engine.process(&buffer, sample_rate);
        let frequency = frame.freq.expect("low E should remain detectable");
        assert!(
            (frequency - 82.4069).abs() < 2.0,
            "expected E2 near 82.4 Hz, got {frequency} Hz"
        );
        assert_eq!(frame.note, "E2");
    }
}
