//! Offline trace: run the full tuner pipeline over a captured recording and
//! print per-frame diagnostics (raw detector value vs published value), so
//! real-microphone instability can be analyzed outside the browser.
//!
//! Convert a browser debug recording (the `?debug=1` overlay's record
//! button) to raw mono f32 samples first:
//!
//! ```text
//! ffmpeg -i tuner-debug.webm -f f32le -ac 1 -ar 48000 capture.f32le
//! cargo run --example trace -- capture.f32le 48000
//! ```
//!
//! Optional third/fourth arguments override the detection range in Hz.

use pitch_core::{DetectorConfig, EngineConfig, TunerEngine};

const WINDOW_SAMPLES: usize = 4096;
const HOP_SECONDS: f32 = 0.033;

fn main() {
    let mut args = std::env::args().skip(1);
    let path = args
        .next()
        .expect("usage: trace <capture.f32le> <sample_rate> [min_hz max_hz]");
    let sample_rate: f32 = args
        .next()
        .expect("sample rate argument")
        .parse()
        .expect("numeric sample rate");
    let min_frequency: Option<f32> = args.next().map(|value| value.parse().expect("numeric min"));
    let max_frequency: Option<f32> = args.next().map(|value| value.parse().expect("numeric max"));

    let bytes = std::fs::read(&path).expect("read capture file");
    let samples: Vec<f32> = bytes
        .chunks_exact(4)
        .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
        .collect();

    let mut detector = DetectorConfig::default();
    if let (Some(min), Some(max)) = (min_frequency, max_frequency) {
        detector.set_frequency_range(min, max);
    }
    let mut engine = TunerEngine::with_config(EngineConfig {
        detector,
        spectrum_bins: 0,
        ..EngineConfig::default()
    });

    let hop = (sample_rate * HOP_SECONDS) as usize;
    println!("time_s\traw_hz\tshown_hz\tnote\tcents\tconf\trms");
    let mut start = 0usize;
    while start + WINDOW_SAMPLES <= samples.len() {
        let frame = engine.process(&samples[start..start + WINDOW_SAMPLES], sample_rate);
        println!(
            "{:.3}\t{}\t{}\t{}\t{:.1}\t{:.2}\t{:.4}",
            start as f32 / sample_rate,
            format_frequency(frame.raw_freq),
            format_frequency(frame.freq),
            frame.note,
            frame.cents,
            frame.confidence,
            frame.rms,
        );
        start += hop;
    }
}

fn format_frequency(frequency: Option<f32>) -> String {
    frequency.map_or_else(|| "-".to_string(), |value| format!("{value:.2}"))
}
