//! Compare raw detector accuracy on 2048 vs 8192 windows, clean and noisy.

use pitch_core::{mix_white_noise_at_snr, DetectorConfig, HybridPitchDetector, PitchDetector};
use std::f32::consts::TAU;

fn tone(fundamental: f32, length: usize) -> Vec<f32> {
    let amplitudes = [0.4_f32, 0.22, 0.12, 0.06];
    (0..length)
        .map(|index| {
            let t = index as f32 / 48_000.0;
            amplitudes
                .iter()
                .enumerate()
                .map(|(h, a)| a * (TAU * fundamental * (h + 1) as f32 * t).sin())
                .sum()
        })
        .collect()
}

fn cents(offered: f32, reference: f32) -> f32 {
    1_200.0 * (offered / reference).log2()
}

fn main() {
    let sr = 48_000.0;
    for fundamental in [293.66_f32, 329.63, 392.0, 440.0, 659.25] {
        for window in [2_048usize, 8_192] {
            let clean = tone(fundamental, window);
            let mut detector = HybridPitchDetector::new(DetectorConfig::default());
            let e = detector
                .detect(&clean, sr)
                .map(|e| cents(e.frequency, fundamental));
            // SNR-10 jitter: mean |error| over 8 deterministic realizations.
            let mut errors = Vec::new();
            for seed in 0..8u64 {
                let noisy = mix_white_noise_at_snr(&clean, 10.0, seed);
                let mut detector = HybridPitchDetector::new(DetectorConfig::default());
                if let Some(e10) = detector.detect(&noisy, sr) {
                    errors.push(cents(e10.frequency, fundamental).abs());
                }
            }
            let mean = errors.iter().sum::<f32>() / errors.len().max(1) as f32;
            let max = errors.iter().copied().fold(0.0_f32, f32::max);
            println!(
                "{fundamental:7.2} Hz window={window:5} clean={} snr10_mean|e|={mean:.3}c snr10_max={max:.3}c (n={})",
                e.map(|v| format!("{v:+.3}c")).unwrap_or_else(|| "none".into()),
                errors.len()
            );
        }
    }
}
