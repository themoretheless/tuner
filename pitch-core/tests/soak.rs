//! Soak tests for `TunerEngine` (PLAN.md M7 "restart soak tests").
//!
//! Two gates live here:
//!
//! 1. **Long-run soak** — a deterministic multi-thousand-frame session
//!    (note series, silence, white noise, a frequency sweep, a noisy note
//!    and a reverberant note built with the `quality` transforms) is pushed
//!    through one engine instance. Every emitted frame must stay finite,
//!    confidence must remain calibrated to `[0, 1]`, the spectrum length
//!    must not drift, and the engine's internal histories (fixed-capacity
//!    ring buffers in the tracker and confidence estimator) must stay
//!    bounded. The whole session is replayed on a second engine and the
//!    per-frame signatures must match bit for bit (determinism).
//!
//! 2. **Restart soak** — a short scenario is processed by dozens of
//!    freshly constructed engines in a loop (create → run → drop). Every
//!    restart must produce output identical to the first fresh engine, and
//!    an engine recycled through `TunerEngine::reset` must behave
//!    identically to a fresh one. This catches leaked global/static state
//!    and reset paths that forget to clear a buffer.
//!
//! Volumes are named constants so the suite stays well under a minute in a
//! debug `cargo test` run: at the reduced soak rate (`SOAK_SAMPLE_RATE` /
//! `SOAK_FRAME_SIZE`) one `process` call costs ~5-6 ms in debug builds.

use pitch_core::{
    apply_reverb, mix_white_noise_at_snr, synthesize_impulse_response, DetectionFrame,
    EngineConfig, TunerEngine,
};

/// Reduced sample rate for the bulk soak. The engine only needs a few
/// periods of the lowest tuner frequency per frame; 8 kHz keeps detection
/// correct for the whole guitar/bass range while making debug-build frames
/// ~20x cheaper than 44.1 kHz.
const SOAK_SAMPLE_RATE: f32 = 8_000.0;
/// Samples per processed frame in the bulk soak.
const SOAK_FRAME_SIZE: usize = 512;
/// Frames in the long-run soak scenario (2 100 = ~135 s of audio at the
/// soak rate; the scenario builder asserts the exact sum).
const SOAK_FRAMES: usize = 2_100;
/// Frames per restart cycle: long enough to acquire, hold and release a
/// note plus a stretch of silence.
const RESTART_FRAMES: usize = 50;
/// Fresh-engine restart iterations (create → run → drop).
const RESTART_CYCLES: usize = 20;
/// `reset()`-recycle iterations on a single reused engine.
const RESET_CYCLES: usize = 6;
/// Full-fidelity smoke frames at the production rate/frame size to keep
/// the standard configuration inside the soak gate too.
const SMOKE_SAMPLE_RATE: f32 = 44_100.0;
const SMOKE_FRAME_SIZE: usize = 2_048;
const SMOKE_FRAMES: usize = 24;

/// Sum of the fixed ring capacities in `PitchTracker` (3) and
/// `ConfidenceEstimator` (5); the engine must never hold more than this.
const MAX_HISTORY_SAMPLES: usize = 8;

const NOISE_SN_SEGMENT_DB: f32 = 15.0;
const REVERB_RT60_SECONDS: f32 = 0.3;
const REVERB_WET_DB: f32 = -12.0;
const NOISE_SEED: u64 = 0x5eed_0001;
const REVERB_SEED: u64 = 0x5eed_0002;

/// xorshift64* → [0, 1). Local copy of the `quality` module's PRNG so the
/// test owns its determinism guarantees (the crate's generator is crate-
/// private; the public transforms use their own fixed seeds).
fn next_uniform(state: &mut u64) -> f32 {
    let mut x = *state;
    x ^= x >> 12;
    x ^= x << 25;
    x ^= x >> 27;
    *state = x;
    (x.wrapping_mul(0x2545_F491_4F6C_DD1D) >> 11) as f32 * (1.0 / (1u64 << 40) as f32)
}

/// Deterministic white noise at the given RMS.
fn white_noise(len: usize, rms: f32, seed: u64) -> Vec<f32> {
    let mut state = seed | 1;
    (0..len)
        .map(|_| (next_uniform(&mut state) * 2.0 - 1.0) * rms * 3.0_f32.sqrt())
        .collect()
}

/// Decaying plucked-string-like tone: fundamental + softer second
/// harmonic under an exponential decay. Deterministic in the sample index.
fn tone(len: usize, frequency: f32, sample_rate: f32, amplitude: f32) -> Vec<f32> {
    let tau = std::f32::consts::TAU;
    (0..len)
        .map(|i| {
            let t = i as f32 / sample_rate;
            let envelope = (-t * 1.5).exp();
            amplitude
                * envelope
                * ((tau * frequency * t).sin() + 0.4 * (tau * 2.0 * frequency * t).sin())
        })
        .collect()
}

/// Linear frequency glide, constant amplitude.
fn sweep(len: usize, from_hz: f32, to_hz: f32, sample_rate: f32, amplitude: f32) -> Vec<f32> {
    let tau = std::f32::consts::TAU;
    let mut phase = 0.0f32;
    (0..len)
        .map(|i| {
            let progress = i as f32 / len.max(1) as f32;
            let frequency = from_hz + (to_hz - from_hz) * progress;
            phase += tau * frequency / sample_rate;
            amplitude * phase.sin()
        })
        .collect()
}

/// One named chunk of the soak session, in frames.
struct Segment {
    name: &'static str,
    frames: usize,
    samples: Vec<f32>,
}

fn segment(name: &'static str, frames: usize, samples: Vec<f32>) -> Segment {
    assert_eq!(
        samples.len(),
        frames * SOAK_FRAME_SIZE,
        "segment {name} length must match its frame count"
    );
    Segment {
        name,
        frames,
        samples,
    }
}

/// Builds the long-run soak session. Pure function of the constants, so
/// every replay is bit-identical without storing golden data.
fn build_soak_scenario() -> Vec<Segment> {
    let sr = SOAK_SAMPLE_RATE;
    let n = |frames: usize| frames * SOAK_FRAME_SIZE;

    let mut noisy_note = tone(n(300), 110.0, sr, 0.5);
    noisy_note = mix_white_noise_at_snr(&noisy_note, NOISE_SN_SEGMENT_DB, NOISE_SEED);

    let dry = tone(n(300), 440.0, sr, 0.5);
    let ir = synthesize_impulse_response(REVERB_RT60_SECONDS, sr, REVERB_SEED);
    let reverberant = apply_reverb(&dry, &ir, REVERB_WET_DB);
    // apply_reverb may extend the tail; the segment contract is exact
    // frame multiples, so truncate the reverb tail into the segment.
    let reverberant = reverberant[..n(300)].to_vec();

    vec![
        segment("open-e2", 300, tone(n(300), 82.41, sr, 0.5)),
        segment("silence", 150, vec![0.0; n(150)]),
        segment("noisy-a2", 300, noisy_note),
        segment("sweep-110-220", 300, sweep(n(300), 110.0, 220.0, sr, 0.4)),
        segment("white-noise", 200, white_noise(n(200), 0.3, NOISE_SEED)),
        segment("note-e3", 150, tone(n(150), 164.81, sr, 0.5)),
        segment("note-g3", 150, tone(n(150), 196.0, sr, 0.5)),
        segment("note-b3", 150, tone(n(150), 246.94, sr, 0.5)),
        segment("silence-2", 100, vec![0.0; n(100)]),
        segment("reverb-a4", 300, reverberant),
    ]
}

fn soak_engine() -> TunerEngine {
    TunerEngine::with_config(EngineConfig {
        spectrum_fft_size: SOAK_FRAME_SIZE,
        spectrum_bins: 128,
        ..EngineConfig::default()
    })
}

/// Compact per-frame fingerprint. Bit patterns are compared exactly:
/// equal signatures between runs mean the engine is fully deterministic.
#[derive(Debug, PartialEq)]
struct FrameSignature {
    freq: Option<u32>,
    raw_freq: Option<u32>,
    confidence: u32,
    rms: u32,
    level: u32,
    cents: u32,
    in_tune: bool,
    is_power: bool,
    spectrum_sum: u32,
}

fn assert_frame_sane(frame: &DetectionFrame, context: &str) {
    if let Some(freq) = frame.freq {
        assert!(freq.is_finite() && freq > 0.0, "{context}: bad freq {freq}");
    }
    if let Some(raw) = frame.raw_freq {
        assert!(
            raw.is_finite() && raw > 0.0,
            "{context}: bad raw_freq {raw}"
        );
    }
    assert!(
        frame.confidence.is_finite() && (0.0..=1.0).contains(&frame.confidence),
        "{context}: confidence {} outside [0, 1]",
        frame.confidence
    );
    assert!(
        frame.rms.is_finite() && frame.rms >= 0.0,
        "{context}: bad rms {}",
        frame.rms
    );
    assert!(
        frame.level.is_finite() && frame.level >= 0.0,
        "{context}: bad level {}",
        frame.level
    );
    assert!(
        frame.cents.is_finite(),
        "{context}: non-finite cents {}",
        frame.cents
    );
    assert!(
        frame.spectrum.iter().all(|bin| bin.is_finite()),
        "{context}: non-finite spectrum bin"
    );
}

fn sign_frame(frame: &DetectionFrame) -> FrameSignature {
    FrameSignature {
        freq: frame.freq.map(f32::to_bits),
        raw_freq: frame.raw_freq.map(f32::to_bits),
        confidence: frame.confidence.to_bits(),
        rms: frame.rms.to_bits(),
        level: frame.level.to_bits(),
        cents: frame.cents.to_bits(),
        in_tune: frame.in_tune,
        is_power: frame.is_power,
        spectrum_sum: frame.spectrum.iter().fold(0u32, |acc, bin| {
            acc.wrapping_add(bin.to_bits().rotate_left(1))
        }),
    }
}

fn run_segments(engine: &mut TunerEngine, segments: &[Segment]) -> Vec<FrameSignature> {
    let mut signatures = Vec::new();
    for segment in segments {
        for (offset, chunk) in segment.samples.chunks_exact(SOAK_FRAME_SIZE).enumerate() {
            let context = format!("segment {} frame {}", segment.name, offset);
            let frame = engine.process(chunk, SOAK_SAMPLE_RATE);
            assert_frame_sane(&frame, &context);
            signatures.push(sign_frame(&frame));
            // The histories are fixed-capacity rings; spot-check the bound
            // at segment boundaries and at the end of every segment.
            if offset + 1 == segment.frames {
                assert!(
                    engine.history_sample_count() <= MAX_HISTORY_SAMPLES,
                    "{context}: history grew to {} samples",
                    engine.history_sample_count()
                );
            }
        }
    }
    signatures
}

#[test]
fn long_run_soak_is_finite_bounded_and_deterministic() {
    let segments = build_soak_scenario();
    let total_frames: usize = segments.iter().map(|segment| segment.frames).sum();
    assert_eq!(
        total_frames, SOAK_FRAMES,
        "scenario must match the named volume constant"
    );

    let engine_size = std::mem::size_of_val(&soak_engine());

    // First pass: full sanity checks + bounded state on one long-lived
    // engine instance. Any panic here fails the test directly.
    let mut engine = soak_engine();
    let first = run_segments(&mut engine, &build_soak_scenario());
    assert_eq!(first.len(), SOAK_FRAMES);
    assert!(
        engine.history_sample_count() <= MAX_HISTORY_SAMPLES,
        "history unbounded after {SOAK_FRAMES} frames"
    );
    assert_eq!(
        std::mem::size_of_val(&engine),
        engine_size,
        "engine struct footprint changed during the soak"
    );

    // Second pass on a fresh engine: the entire session must reproduce
    // bit-identical output — the engine carries no hidden nondeterminism.
    let mut replay = soak_engine();
    let second = run_segments(&mut replay, &build_soak_scenario());
    assert_eq!(
        first, second,
        "two engines on the same deterministic session diverged"
    );
}

/// Short mixed scenario for the restart soak: a tone that must be
/// acquired, held, and released, followed by silence.
fn build_restart_scenario() -> Vec<Vec<f32>> {
    let sr = SOAK_SAMPLE_RATE;
    let tone_samples = tone(RESTART_FRAMES / 2 * SOAK_FRAME_SIZE, 196.0, sr, 0.5);
    let silence = vec![0.0; (RESTART_FRAMES - RESTART_FRAMES / 2) * SOAK_FRAME_SIZE];
    tone_samples
        .chunks_exact(SOAK_FRAME_SIZE)
        .chain(silence.chunks_exact(SOAK_FRAME_SIZE))
        .map(|chunk| chunk.to_vec())
        .collect()
}

fn run_restart_scenario(engine: &mut TunerEngine, frames: &[Vec<f32>]) -> Vec<FrameSignature> {
    frames
        .iter()
        .enumerate()
        .map(|(index, chunk)| {
            let frame = engine.process(chunk, SOAK_SAMPLE_RATE);
            assert_frame_sane(&frame, &format!("restart frame {index}"));
            sign_frame(&frame)
        })
        .collect()
}

#[test]
fn restart_soak_matches_fresh_engine_every_cycle() {
    let scenario = build_restart_scenario();
    assert_eq!(scenario.len(), RESTART_FRAMES);

    let mut reference_engine = soak_engine();
    let reference = run_restart_scenario(&mut reference_engine, &scenario);

    // create → run → drop, dozens of times: every restart must behave
    // exactly like the first fresh engine (no leaked static/global state).
    for cycle in 0..RESTART_CYCLES {
        let mut engine = soak_engine();
        let signature = run_restart_scenario(&mut engine, &scenario);
        assert_eq!(
            signature, reference,
            "restart cycle {cycle} diverged from a fresh engine"
        );
        drop(engine);
    }

    // One engine recycled through reset() must be indistinguishable from a
    // fresh one — this is the in-process form of the same restart gate.
    let mut recycled = soak_engine();
    for cycle in 0..RESET_CYCLES {
        let signature = run_restart_scenario(&mut recycled, &scenario);
        assert_eq!(
            signature, reference,
            "reset() cycle {cycle} diverged from a fresh engine"
        );
        recycled.reset();
        assert_eq!(
            recycled.history_sample_count(),
            0,
            "reset() must empty the tracking/confidence histories"
        );
    }
}

/// The production rate/frame size stays covered by a short smoke pass on
/// top of the cheap bulk soak (a 44.1 kHz debug frame costs ~120 ms, so
/// this is deliberately small).
#[test]
fn production_rate_smoke_soak() {
    let sr = SMOKE_SAMPLE_RATE;
    let notes = [82.41, 110.0, 196.0, 440.0];
    let per_note = SMOKE_FRAMES / notes.len();
    let mut engine = TunerEngine::new(440.0);
    let mut first_pass = Vec::new();
    for (note_index, frequency) in notes.iter().enumerate() {
        let samples = tone(per_note * SMOKE_FRAME_SIZE, *frequency, sr, 0.5);
        for (offset, chunk) in samples.chunks_exact(SMOKE_FRAME_SIZE).enumerate() {
            let frame = engine.process(chunk, sr);
            assert_frame_sane(&frame, &format!("smoke note {note_index} frame {offset}"));
            first_pass.push(sign_frame(&frame));
        }
    }
    assert!(
        engine.history_sample_count() <= MAX_HISTORY_SAMPLES,
        "history unbounded after the production-rate smoke"
    );
    assert_eq!(first_pass.len(), SMOKE_FRAMES);
    assert!(
        first_pass.iter().any(|signature| signature.freq.is_some()),
        "production-rate smoke must detect at least one of the clear tones"
    );
}
