//! Criterion microbenchmarks for the per-frame detection hot path.
//!
//! Window: 8192 samples @ 48 kHz, cadence budget ~33 ms. Deterministic
//! inputs: pure additive guitar-like synthesis (no RNG), so runs are
//! reproducible across machines and revisions.
//!
//! Coverage:
//! - full detection frame (HybridPitchDetector) for guitar E2 and E4;
//! - YIN and MPM in isolation;
//! - biquad band-pass preprocessing;
//! - octave cross-check with the HPS guard engaged (FFT runs) vs. decided
//!   by the Goertzel probes alone (HPS never consulted);
//! - phase-domain refinement.
//!
//! Note on the HPS high-confidence skip: `HpsGuard::verdict` returns before
//! any FFT work when confidence >= 0.97. That branch is pub(crate), so it
//! cannot be benchmarked from here directly; it is exercised indirectly by
//! the clean-tone full-frame benches (a confident frame skips the FFT), and
//! the FFT cost itself is visible as the difference between
//! `hps_guard_active` and `octave_goertzel_decides`.

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use pitch_core::{
    BandPassFilter, DetectorConfig, FrameContext, HybridPitchDetector, MpmDetector, Note,
    OctaveDisambiguator, PhaseRefiner, PitchDetector, PitchEstimate, TunerEngine, YinDetector,
};
use std::f32::consts::TAU;

const SAMPLE_RATE: f32 = 48_000.0;
const WINDOW: usize = 8_192;
const E2: f32 = 82.41;
const E4: f32 = 329.63;

/// Deterministic guitar-like tone: fundamental plus decaying harmonics.
fn guitar_tone(fundamental: f32) -> Vec<f32> {
    let amplitudes = [0.40_f32, 0.22, 0.12, 0.06, 0.03];
    (0..WINDOW)
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

fn bench_full_frame(c: &mut Criterion) {
    let mut group = c.benchmark_group("full_frame");
    for (name, frequency) in [("e2", E2), ("e4", E4)] {
        let buffer = guitar_tone(frequency);
        let mut detector = HybridPitchDetector::new(DetectorConfig::default());
        // Warm-up: allocations and internal filter/FFT plans.
        black_box(detector.detect(black_box(&buffer), SAMPLE_RATE));
        group.bench_function(name, |bencher| {
            bencher.iter(|| black_box(detector.detect(black_box(&buffer), SAMPLE_RATE)));
        });
    }
    group.finish();
}

fn bench_yin(c: &mut Criterion) {
    let mut group = c.benchmark_group("yin");
    for (name, frequency) in [("e2", E2), ("e4", E4)] {
        let buffer = guitar_tone(frequency);
        let mut detector = YinDetector::new(DetectorConfig::default());
        black_box(detector.detect(black_box(&buffer), SAMPLE_RATE));
        group.bench_function(name, |bencher| {
            bencher.iter(|| black_box(detector.detect(black_box(&buffer), SAMPLE_RATE)));
        });
    }
    group.finish();
}

fn bench_mpm(c: &mut Criterion) {
    let mut group = c.benchmark_group("mpm");
    for (name, frequency) in [("e2", E2), ("e4", E4)] {
        let buffer = guitar_tone(frequency);
        let mut detector = MpmDetector::new(DetectorConfig::default());
        black_box(detector.detect(black_box(&buffer), SAMPLE_RATE));
        group.bench_function(name, |bencher| {
            bencher.iter(|| black_box(detector.detect(black_box(&buffer), SAMPLE_RATE)));
        });
    }
    group.finish();
}

fn bench_full_frame_guided(c: &mut Criterion) {
    let mut group = c.benchmark_group("full_frame_guided");
    for (name, frequency, note_name, octave) in [("e2", E2, "E", 2), ("e4", E4, "E", 4)] {
        let buffer = guitar_tone(frequency);
        let note = Note {
            name: note_name,
            octave,
            frequency,
        };
        let mut engine = TunerEngine::new(440.0);
        // Selected-string context: narrows the detector tau search to a
        // −800/+600-cent window around the target.
        engine.set_frame_context(Some(FrameContext {
            tuning_targets: vec![note.clone()],
            selected_target: Some(note),
            ..FrameContext::default()
        }));
        black_box(engine.process(black_box(&buffer), SAMPLE_RATE));
        group.bench_function(name, |bencher| {
            bencher.iter(|| black_box(engine.process(black_box(&buffer), SAMPLE_RATE)));
        });
    }
    group.finish();
}

fn bench_yin_windowed(c: &mut Criterion) {
    let mut group = c.benchmark_group("yin_windowed");
    for (name, frequency) in [("e2", E2), ("e4", E4)] {
        let buffer = guitar_tone(frequency);
        // Same −800/+600-cent window the guided path applies around a
        // selected target; isolates the tau-loop savings in YIN itself.
        let down = 2.0_f32.powf(800.0 / 1_200.0);
        let up = 2.0_f32.powf(600.0 / 1_200.0);
        let config =
            DetectorConfig::default().with_frequency_range(frequency / down, frequency * up);
        let mut detector = YinDetector::new(config);
        black_box(detector.detect(black_box(&buffer), SAMPLE_RATE));
        group.bench_function(name, |bencher| {
            bencher.iter(|| black_box(detector.detect(black_box(&buffer), SAMPLE_RATE)));
        });
    }
    group.finish();
}

fn bench_biquad_preprocess(c: &mut Criterion) {
    let mut group = c.benchmark_group("biquad_preprocess");
    let buffer = guitar_tone(E2);
    let config = DetectorConfig::default();
    let mut filter = BandPassFilter::for_frequency_range(
        SAMPLE_RATE,
        config.min_frequency,
        config.max_frequency,
    );
    group.bench_function("band_pass_8192", |bencher| {
        let mut scratch = buffer.clone();
        bencher.iter(|| {
            scratch.copy_from_slice(black_box(&buffer));
            filter.process_in_place(black_box(&mut scratch));
            black_box(&scratch);
        });
    });
    group.finish();
}

fn bench_hps_guard(c: &mut Criterion) {
    let mut group = c.benchmark_group("hps_guard");

    // Clean tone, estimate agrees with the spectrum: the Goertzel probes
    // see nothing conclusive, so the HPS guard runs its full FFT + product.
    // `OctaveDisambiguator::resolve` drives the guard at confidence 0.90
    // (below the 0.97 skip threshold).
    let buffer = guitar_tone(E4);
    let mut disambiguator = OctaveDisambiguator::new();
    black_box(disambiguator.resolve(black_box(&buffer), SAMPLE_RATE, E4, 30.0, 1_400.0));
    group.bench_function("active", |bencher| {
        bencher.iter(|| {
            black_box(disambiguator.resolve(black_box(&buffer), SAMPLE_RATE, E4, 30.0, 1_400.0))
        });
    });

    // Strong subharmonic series under a doubled estimate: the Goertzel
    // probes decide (fold down) before the HPS guard is ever consulted, so
    // this is the no-FFT cost of the octave cross-check. The delta against
    // `active` isolates the FFT the high-confidence skip avoids.
    let fundamental = 110.0;
    let octave_up_buffer: Vec<f32> = (0..WINDOW)
        .map(|index| {
            let t = index as f32 / SAMPLE_RATE;
            0.4 * (TAU * fundamental * t).sin() + 0.2 * (TAU * 2.0 * fundamental * t).sin()
        })
        .collect();
    let mut disambiguator = OctaveDisambiguator::new();
    black_box(disambiguator.resolve(
        black_box(&octave_up_buffer),
        SAMPLE_RATE,
        2.0 * fundamental,
        30.0,
        1_400.0,
    ));
    group.bench_function("goertzel_decides_no_fft", |bencher| {
        bencher.iter(|| {
            black_box(disambiguator.resolve(
                black_box(&octave_up_buffer),
                SAMPLE_RATE,
                2.0 * fundamental,
                30.0,
                1_400.0,
            ))
        });
    });
    group.finish();
}

fn bench_phase_refine(c: &mut Criterion) {
    let mut group = c.benchmark_group("phase_refine");
    let buffer = guitar_tone(E4);
    let estimate = PitchEstimate {
        confidence: 0.95,
        frequency: E4,
    };
    let mut refiner = PhaseRefiner::new();
    black_box(refiner.refine(black_box(&buffer), SAMPLE_RATE, estimate));
    group.bench_function("e4", |bencher| {
        bencher.iter(|| black_box(refiner.refine(black_box(&buffer), SAMPLE_RATE, estimate)));
    });
    group.finish();
}

criterion_group!(
    benches,
    bench_full_frame,
    bench_full_frame_guided,
    bench_yin,
    bench_yin_windowed,
    bench_mpm,
    bench_biquad_preprocess,
    bench_hps_guard,
    bench_phase_refine,
);
criterion_main!(benches);
