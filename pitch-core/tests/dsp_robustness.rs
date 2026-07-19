use pitch_core::*;

const E2: f32 = 82.4069;
const SAMPLE_RATE: f32 = 48_000.0;
const FRAME_LENGTH: usize = 4_096;

#[derive(Clone, Copy)]
struct TestSignal<'a> {
    frequency: f32,
    harmonics: &'a [f32],
    hum: Option<(f32, f32)>,
    neighbour: Option<(f32, f32)>,
    noise: f32,
    attack_samples: usize,
}

impl TestSignal<'_> {
    fn render(self) -> Vec<f32> {
        let mut noise_state = 0x1234_5678_u32;
        (0..FRAME_LENGTH)
            .map(|index| {
                let time = index as f32 / SAMPLE_RATE;
                let attack = if index < self.attack_samples {
                    deterministic_noise(&mut noise_state)
                        * 0.8
                        * (1.0 - index as f32 / self.attack_samples.max(1) as f32)
                } else {
                    0.0
                };
                let harmonics = self
                    .harmonics
                    .iter()
                    .enumerate()
                    .map(|(index, gain)| {
                        let harmonic = (index + 1) as f32;
                        (std::f32::consts::TAU * self.frequency * harmonic * time).sin() * gain
                    })
                    .sum::<f32>();
                let hum = self.hum.map_or(0.0, |(frequency, gain)| {
                    (std::f32::consts::TAU * frequency * time + 0.3).sin() * gain
                });
                let neighbour = self.neighbour.map_or(0.0, |(frequency, gain)| {
                    (std::f32::consts::TAU * frequency * time + 0.7).sin() * gain
                });
                harmonics
                    + hum
                    + neighbour
                    + attack
                    + deterministic_noise(&mut noise_state) * self.noise
            })
            .collect()
    }
}

fn deterministic_noise(state: &mut u32) -> f32 {
    *state = state.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
    ((*state >> 8) as f32 / (1 << 24) as f32) * 2.0 - 1.0
}

fn e2_engine() -> TunerEngine {
    let target = Note {
        name: "E",
        octave: 2,
        frequency: E2,
    };
    TunerEngine::with_config(EngineConfig {
        detector: DetectorConfig::default().with_frequency_range(53.0, 120.0),
        frame_context: Some(FrameContext {
            display_targets: vec![target.clone()],
            tuning_targets: vec![target.clone()],
            selected_target: Some(target.clone()),
            idle_target: Some(target.clone()),
            ..FrameContext::default()
        }),
        spectrum_bins: 0,
        tuning: Some(Tuning {
            name: "Low E robustness",
            strings: vec![target],
        }),
        ..EngineConfig::default()
    })
}

fn automatic_low_strings_engine() -> TunerEngine {
    let low_e = Note {
        name: "E",
        octave: 2,
        frequency: E2,
    };
    let a = Note {
        name: "A",
        octave: 2,
        frequency: 110.0,
    };
    let targets = vec![low_e.clone(), a.clone()];
    TunerEngine::with_config(EngineConfig {
        detector: DetectorConfig::default().with_frequency_range(53.0, 120.0),
        frame_context: Some(FrameContext {
            display_targets: targets.clone(),
            tuning_targets: targets.clone(),
            selected_target: None,
            idle_target: Some(low_e),
            ..FrameContext::default()
        }),
        spectrum_bins: 0,
        tuning: Some(Tuning {
            name: "Automatic low strings",
            strings: targets,
        }),
        ..EngineConfig::default()
    })
}

fn settled_frequency(engine: &mut TunerEngine, samples: &[f32]) -> Option<f32> {
    (0..6)
        .filter_map(|_| engine.process(samples, SAMPLE_RATE).freq)
        .last()
}

fn assert_near_e2(frequency: f32) {
    assert!(
        (frequency - E2).abs() < 1.0,
        "expected low E near {E2:.3} Hz, got {frequency:.3} Hz"
    );
}

#[test]
fn guided_engine_uses_the_real_e2_candidate_in_mains_hum() {
    // This frame intentionally makes YIN report about 55 Hz while MPM still
    // measures E2. The selected string may choose between those measurements,
    // but it must never synthesize or snap a frequency to the target.
    for hum_frequency in [50.0, 60.0] {
        let samples = TestSignal {
            frequency: E2,
            harmonics: &[0.08, 0.70, 0.25, 0.35],
            hum: Some((hum_frequency, 0.40)),
            neighbour: None,
            noise: 0.015,
            attack_samples: 0,
        }
        .render();

        let frequency = settled_frequency(&mut e2_engine(), &samples).unwrap_or_else(|| {
            let config = DetectorConfig::default().with_frequency_range(53.0, 120.0);
            let yin = YinDetector::new(config).detect(&samples, SAMPLE_RATE);
            let mpm = MpmDetector::new(config).detect(&samples, SAMPLE_RATE);
            panic!("E2 should survive {hum_frequency} Hz hum; YIN={yin:?}, MPM={mpm:?}");
        });
        assert_near_e2(frequency);
    }
}

#[test]
fn guided_engine_recovers_e2_from_a_shared_false_time_domain_subharmonic() {
    // With stronger hum both periodicity detectors agree on a false value near
    // 55 Hz. The alternative is accepted only because E2 still contributes a
    // locally prominent second, third and fourth harmonic.
    let samples = TestSignal {
        frequency: E2,
        harmonics: &[0.08, 0.70, 0.25, 0.35],
        hum: Some((60.0, 0.80)),
        neighbour: None,
        noise: 0.015,
        attack_samples: 0,
    }
    .render();
    let frequency = settled_frequency(&mut e2_engine(), &samples)
        .expect("the coherent E2 harmonic series should recover the string");
    assert_near_e2(frequency);
}

#[test]
fn automatic_tuning_recovers_e2_instead_of_treating_55_hz_as_half_of_a2() {
    let samples = TestSignal {
        frequency: E2,
        harmonics: &[0.08, 0.70, 0.25, 0.35],
        hum: Some((50.0, 0.40)),
        neighbour: None,
        noise: 0.015,
        attack_samples: 0,
    }
    .render();

    let frequency = settled_frequency(&mut automatic_low_strings_engine(), &samples)
        .expect("automatic tuning should recover the coherent E2 series");
    assert_near_e2(frequency);
}

#[test]
fn selected_e2_does_not_turn_harmonic_mains_hum_into_a_string() {
    for hum_frequency in [50.0, 60.0] {
        let samples = TestSignal {
            frequency: hum_frequency,
            harmonics: &[1.0, 0.45, 0.25, 0.14, 0.08],
            hum: None,
            neighbour: None,
            noise: 0.01,
            attack_samples: 0,
        }
        .render();
        for mut engine in [e2_engine(), automatic_low_strings_engine()] {
            for _ in 0..8 {
                assert!(engine.process(&samples, SAMPLE_RATE).freq.is_none());
            }
        }
    }
}

#[test]
fn selected_e2_rejects_the_adjacent_a2_string_before_acquisition() {
    let samples = TestSignal {
        frequency: 110.0,
        harmonics: &[1.0, 0.60, 0.35, 0.20],
        hum: None,
        neighbour: None,
        noise: 0.01,
        attack_samples: 0,
    }
    .render();
    let mut engine = e2_engine();
    let low_e = Note {
        name: "E",
        octave: 2,
        frequency: E2,
    };
    let a = Note {
        name: "A",
        octave: 2,
        frequency: 110.0,
    };
    engine.set_frame_context(Some(FrameContext {
        display_targets: vec![low_e.clone(), a.clone()],
        tuning_targets: vec![low_e.clone(), a],
        selected_target: Some(low_e.clone()),
        idle_target: Some(low_e),
        ..FrameContext::default()
    }));
    let mut last_frame = None;

    for _ in 0..8 {
        let frame = engine.process(&samples, SAMPLE_RATE);
        assert!(frame.freq.is_none());
        last_frame = Some(frame);
    }

    let last_frame = last_frame.expect("last rejected A2 frame");
    let interference = last_frame
        .pipeline
        .interference
        .expect("rejected A2 should remain visible as competing-string evidence");
    assert!((interference.selected_target_frequency - E2).abs() < 0.01);
    assert!((interference.competing_target_frequency - 110.0).abs() < 0.1);
}

#[test]
fn settled_e2_is_held_through_a_short_ambiguous_string_mixture() {
    let clean = TestSignal {
        frequency: E2,
        harmonics: &[0.20, 0.70, 0.30, 0.25],
        hum: None,
        neighbour: None,
        noise: 0.01,
        attack_samples: 0,
    }
    .render();
    let ambiguous = TestSignal {
        frequency: E2,
        harmonics: &[0.20, 0.70, 0.30, 0.25],
        hum: None,
        neighbour: Some((110.0, 0.90)),
        noise: 0.015,
        attack_samples: 0,
    }
    .render();
    let mut engine = e2_engine();
    assert_near_e2(settled_frequency(&mut engine, &clean).expect("initial E2"));

    for _ in 0..5 {
        assert_near_e2(
            engine
                .process(&ambiguous, SAMPLE_RATE)
                .freq
                .expect("short ambiguity should hold the settled pitch"),
        );
    }
    assert_near_e2(
        engine
            .process(&clean, SAMPLE_RATE)
            .freq
            .expect("E2 should recover without reacquisition jitter"),
    );
}

#[test]
fn difficult_but_coherent_e2_frames_remain_detectable() {
    let cases = [
        TestSignal {
            frequency: E2,
            harmonics: &[0.15, 1.0, 0.40, 0.50],
            hum: None,
            neighbour: None,
            noise: 0.02,
            attack_samples: 1_200,
        },
        TestSignal {
            frequency: E2,
            harmonics: &[0.0, 1.0, 0.60, 0.40, 0.25],
            hum: None,
            neighbour: None,
            noise: 0.01,
            attack_samples: 0,
        },
    ];

    for samples in cases.map(TestSignal::render) {
        let frequency = settled_frequency(&mut e2_engine(), &samples)
            .expect("coherent E2 should remain detectable");
        assert_near_e2(frequency);
    }
}
