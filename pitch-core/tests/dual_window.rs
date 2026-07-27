//! Dual-window (multi-lane) engine behavior: lane choice from the tracked
//! or targeted frequency, tail slicing of the host frame, hysteresis
//! stability, and full backward compatibility of the default single lane.

use pitch_core::{
    AnalysisWindowSet, DetectorConfig, EngineConfig, FrameContext, Note, TunerEngine, Tuning,
};
use std::f32::consts::TAU;

const SAMPLE_RATE: f32 = 48_000.0;
const FRAME: usize = 8_192;
const SHORT: u32 = 2_048;
const LONG: u32 = 8_192;

fn tone(fundamental: f32, length: usize) -> Vec<f32> {
    let amplitudes = [0.4_f32, 0.22, 0.12, 0.06];
    (0..length)
        .map(|index| {
            let t = index as f32 / SAMPLE_RATE;
            amplitudes
                .iter()
                .enumerate()
                .map(|(harmonic, amplitude)| {
                    amplitude * (TAU * fundamental * (harmonic + 1) as f32 * t).sin()
                })
                .sum()
        })
        .collect()
}

fn dual_engine() -> TunerEngine {
    TunerEngine::with_config(EngineConfig {
        analysis_windows: AnalysisWindowSet::new([2_048, 8_192]),
        ..EngineConfig::default()
    })
}

fn cents(offered: f32, reference: f32) -> f32 {
    1_200.0 * (offered / reference).log2().abs()
}

/// Feeds `frames` identical frames of `fundamental` and returns the
/// window used by, and frequency published on, the last frame.
fn run_constant(engine: &mut TunerEngine, fundamental: f32, frames: usize) -> (u32, Option<f32>) {
    let buffer = tone(fundamental, FRAME);
    let mut last = None;
    for _ in 0..frames {
        let frame = engine.process(&buffer, SAMPLE_RATE);
        last = Some((frame.pipeline.window_samples, frame.freq));
    }
    last.expect("at least one frame")
}

#[test]
fn high_notes_lock_on_the_short_lane_within_15_cents() {
    for fundamental in [392.0_f32, 440.0] {
        let mut engine = dual_engine();
        let (window, frequency) = run_constant(&mut engine, fundamental, 8);
        assert_eq!(
            window, SHORT,
            "{fundamental} Hz must run on the 2048 lane once tracked"
        );
        let frequency = frequency.expect("a locked high note must publish");
        assert!(
            cents(frequency, fundamental) < 15.0,
            "{fundamental} Hz resolved to {frequency} Hz ({} cents)",
            cents(frequency, fundamental)
        );
    }
}

#[test]
fn e4_stays_on_the_long_lane_inside_the_hysteresis_band() {
    // 330 Hz sits in the dead zone below the short-lane entry edge; a
    // session that was never above ~345 Hz keeps the long lane (see
    // SWITCH_CENTER_RATIO in windows.rs for why E4 must not ride 2048).
    let mut engine = dual_engine();
    let (window, frequency) = run_constant(&mut engine, 330.0, 8);
    assert_eq!(window, LONG);
    let frequency = frequency.expect("a locked E4 must publish");
    assert!(cents(frequency, 330.0) < 15.0);
}

#[test]
fn low_notes_stay_on_the_long_lane() {
    let mut engine = dual_engine();
    let (window, frequency) = run_constant(&mut engine, 110.0, 8);
    assert_eq!(window, LONG);
    let frequency = frequency.expect("a locked low note must publish");
    assert!(cents(frequency, 110.0) < 15.0);
}

#[test]
fn before_the_first_lock_the_long_lane_runs() {
    let mut engine = dual_engine();
    let buffer = tone(440.0, FRAME);
    let frame = engine.process(&buffer, SAMPLE_RATE);
    assert_eq!(
        frame.pipeline.window_samples, LONG,
        "with no tracked frequency the engine must start on the longest lane"
    );
}

#[test]
fn guided_mode_picks_the_lane_from_the_selected_target_immediately() {
    let target = Note {
        name: "E",
        octave: 4,
        frequency: 329.63,
    };
    let mut engine = TunerEngine::with_config(EngineConfig {
        analysis_windows: AnalysisWindowSet::new([2_048, 8_192]),
        frame_context: Some(FrameContext {
            tuning_targets: vec![target.clone()],
            selected_target: Some(target.clone()),
            ..FrameContext::default()
        }),
        tuning: Some(Tuning {
            name: "E4 only",
            strings: vec![target],
        }),
        ..EngineConfig::default()
    });
    let buffer = tone(329.63, FRAME);
    let frame = engine.process(&buffer, SAMPLE_RATE);
    assert_eq!(
        frame.pipeline.window_samples, SHORT,
        "guided E4 needs no hysteresis warm-up: the target selects the lane"
    );
}

#[test]
fn lane_follows_a_glissando_without_flapping() {
    let mut engine = dual_engine();
    let mut windows = Vec::new();
    // 200 Hz → long lane; 400 Hz → promotes past ~345; 335 Hz (inside the
    // 325.6..345 dead zone) → holds; 300 Hz → demotes below ~325.6; 340 Hz
    // (inside the band) → holds the long lane.
    let script = [
        (200.0_f32, 6usize),
        (400.0, 8),
        (335.0, 6),
        (300.0, 6),
        (340.0, 6),
    ];
    for (fundamental, frames) in script {
        let buffer = tone(fundamental, FRAME);
        for _ in 0..frames {
            windows.push(engine.process(&buffer, SAMPLE_RATE).pipeline.window_samples);
        }
    }
    let transitions = windows.windows(2).filter(|pair| pair[0] != pair[1]).count();
    assert!(
        transitions <= 2,
        "lane may change at most twice (up at >345, down at <326); got {transitions}: {windows:?}"
    );
    // The 335 Hz block must inherit the short lane (entered at 400 Hz)...
    let block335 = &windows[14..20];
    assert!(
        block335.iter().all(|window| *window == SHORT),
        "335 Hz inside the band must hold the short lane: {block335:?}"
    );
    // ...and the final 340 Hz block must inherit the long lane.
    let block340 = &windows[26..32];
    assert!(
        block340.iter().all(|window| *window == LONG),
        "340 Hz inside the band must hold the long lane: {block340:?}"
    );
}

#[test]
fn default_single_lane_matches_the_legacy_full_frame_behavior() {
    // One lane, shorter host buffer: the whole buffer is analyzed and the
    // telemetry reports its real length, exactly as the pre-lanes engine did.
    let mut engine = TunerEngine::with_config(EngineConfig {
        detector: DetectorConfig::default(),
        ..EngineConfig::default()
    });
    let buffer = tone(330.0, 4_096);
    let frame = engine.process(&buffer, SAMPLE_RATE);
    assert_eq!(frame.pipeline.window_samples, 4_096);
}

#[test]
fn short_host_frame_clamps_every_lane_to_the_frame() {
    // A 4096-sample host frame with a dual config: both lanes exceed or
    // match the frame, so the tail slice is the whole buffer.
    let mut engine = dual_engine();
    let buffer = tone(440.0, 4_096);
    let frame = engine.process(&buffer, SAMPLE_RATE);
    assert_eq!(frame.pipeline.window_samples, 4_096);
}
