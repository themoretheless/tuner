//! Diagnose dual-lane coverage/MAE behavior on one capture: prints per-frame
//! lane window, decision and frequency for both engine configurations.
//!
//! cargo run --release -p pitch-core --example lane_debug -- <capture.wav> <freq>

#[path = "support/audio.rs"]
mod audio;

use audio::read_capture;
use pitch_core::{
    apply_reverb, reverb_seed, synthesize_impulse_response, AnalysisWindowSet, DetectorConfig,
    EngineConfig, Note, TunerEngine, Tuning,
};
use std::error::Error;

fn main() -> Result<(), Box<dyn Error>> {
    let mut args = std::env::args().skip(1);
    let path = args.next().expect("capture path");
    let freq: f32 = args.next().expect("target freq").parse()?;
    let rt60: Option<f32> = args.next().and_then(|v| v.parse().ok());
    let seed_id = args.next().unwrap_or_else(|| "debug".to_string());
    let seg_start = args.next().and_then(|v| v.parse::<f32>().ok());
    let seg_end = args.next().and_then(|v| v.parse::<f32>().ok());
    let sample_rate = 48_000.0;
    let mut capture = read_capture(std::path::Path::new(&path), sample_rate)?;
    if let Some(rt60) = rt60 {
        if rt60 < 0.0 {
            let noisy = pitch_core::mix_white_noise_at_snr(
                &capture.samples,
                -rt60,
                snr_seed(&seed_id, -rt60),
            );
            capture.samples = noisy;
        } else {
            let ir = synthesize_impulse_response(rt60, sample_rate, reverb_seed(&seed_id, rt60));
            capture.samples = apply_reverb(&capture.samples, &ir, -12.0);
        }
    }
    let mut detector = DetectorConfig::default();
    detector.set_frequency_range(30.0, 900.0);
    let tuning = Tuning {
        name: "debug",
        strings: vec![Note {
            name: "T",
            octave: 0,
            frequency: freq,
        }],
    };

    for label in ["single", "dual"] {
        let analysis_windows = if label == "dual" {
            AnalysisWindowSet::new([2_048, 8_192])
        } else {
            AnalysisWindowSet::default()
        };
        let mut engine = TunerEngine::with_config(EngineConfig {
            detector,
            spectrum_bins: 0,
            tuning: Some(tuning.clone()),
            analysis_windows,
            ..EngineConfig::default()
        });
        println!("=== {label} ===");
        let hop = (sample_rate * 0.033).round() as usize;
        let mut start = 0usize;
        let mut observations = Vec::new();
        let mut last_time = 0.0_f32;
        while start + 8_192 <= capture.samples.len() {
            let frame = engine.process(&capture.samples[start..start + 8_192], sample_rate);
            let time = ((start + frame.pipeline.window_samples as usize) as f32 / sample_rate)
                .max(last_time);
            last_time = time;
            observations.push(pitch_core::PitchObservation {
                time_seconds: time,
                frequency: frame.freq,
            });
            println!(
                "{:6.3}s lane={} {:<22} freq={} conf={:.3}",
                (start + 8_192) as f32 / sample_rate,
                frame.pipeline.window_samples,
                frame.pipeline.decision.as_str(),
                frame
                    .freq
                    .map(|f| format!("{f:.2}"))
                    .unwrap_or_else(|| "-".into()),
                frame.confidence,
            );
            start += hop;
        }
        if let (Some(start_s), Some(end_s)) = (seg_start, seg_end) {
            let metrics = pitch_core::evaluate_pitch_quality(
                &observations,
                &[pitch_core::ExpectedPitchSegment {
                    start_seconds: start_s,
                    end_seconds: end_s,
                    target_frequency: freq,
                    stable_after_seconds: 0.4,
                }],
                pitch_core::QualityEvaluationConfig {
                    tolerance_cents: 35.0,
                    minimum_correct_hold_seconds: 0.1,
                    reference_a4: 440.0,
                },
            )?;
            println!(
                "coverage={:?} mae={:?} ttfc={:?}",
                metrics.stable_detection_coverage,
                metrics.stable_sustain_cents_mae,
                metrics.time_to_first_correct_ms
            );
        }
    }
    Ok(())
}

/// Same FNV-1a seed scheme as the corpus runner (snr_seed without level bits
/// mixed per level; level is the argument here via f32 bits).
fn snr_seed(capture_id: &str, level: f32) -> u64 {
    let mut hash = 0xcbf2_9ce4_8422_2325_u64;
    for byte in capture_id
        .as_bytes()
        .iter()
        .chain(level.to_bits().to_le_bytes().iter())
    {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
    }
    hash
}
