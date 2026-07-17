//! Run the full tuner pipeline over a raw mono f32 capture and emit temporal
//! quality metrics as JSON.
//!
//! ```text
//! ffmpeg -i capture.wav -f f32le -ac 1 -ar 48000 capture.f32le
//! cargo run -p pitch-core --example quality -- capture.f32le scenario.json
//! ```

mod manifest;
mod report;

use manifest::{invalid_input, ScenarioManifest, ScenarioRuntime};
use pitch_core::{evaluate_pitch_quality, EngineConfig, PitchObservation, TunerEngine};
use std::error::Error;

fn main() -> Result<(), Box<dyn Error>> {
    let (capture_path, scenario_path) = parse_args()?;
    let scenario = ScenarioManifest::load(&scenario_path)?;
    let samples = read_f32_samples(&capture_path)?;
    let runtime = scenario.runtime(samples.len())?;
    let observations = run_pipeline(&samples, &scenario, &runtime);
    let metrics = evaluate_pitch_quality(
        &observations,
        &scenario.expected_segments(),
        runtime.evaluation,
    )?;
    let report = report::build(capture_path, &scenario, &runtime, metrics);

    println!("{}", serde_json::to_string_pretty(&report)?);
    Ok(())
}

fn parse_args() -> Result<(String, String), Box<dyn Error>> {
    let mut args = std::env::args().skip(1);
    let capture_path = args
        .next()
        .ok_or_else(|| invalid_input("usage: quality <capture.f32le> <scenario.json>"))?;
    let scenario_path = args
        .next()
        .ok_or_else(|| invalid_input("usage: quality <capture.f32le> <scenario.json>"))?;
    if args.next().is_some() {
        return Err(invalid_input(
            "usage: quality <capture.f32le> <scenario.json>",
        ));
    }
    Ok((capture_path, scenario_path))
}

fn read_f32_samples(path: &str) -> Result<Vec<f32>, Box<dyn Error>> {
    let bytes = std::fs::read(path)?;
    if bytes.len() % 4 != 0 {
        return Err(invalid_input(
            "capture length must be divisible by four bytes",
        ));
    }
    let samples: Vec<f32> = bytes
        .chunks_exact(4)
        .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
        .collect();
    if samples.iter().any(|sample| !sample.is_finite()) {
        return Err(invalid_input("capture contains non-finite samples"));
    }
    Ok(samples)
}

fn run_pipeline(
    samples: &[f32],
    scenario: &ScenarioManifest,
    runtime: &ScenarioRuntime,
) -> Vec<PitchObservation> {
    let mut engine = TunerEngine::with_config(EngineConfig {
        detector: runtime.detector,
        spectrum_bins: 0,
        ..EngineConfig::default()
    });
    let mut observations = Vec::new();
    let mut start = 0usize;

    while start + runtime.window_samples <= samples.len() {
        let frame = engine.process(
            &samples[start..start + runtime.window_samples],
            scenario.sample_rate,
        );
        observations.push(PitchObservation {
            time_seconds: (start + runtime.window_samples) as f32 / scenario.sample_rate,
            frequency: frame.freq,
        });
        start += runtime.hop_samples;
    }

    observations
}
