//! Replay a WAV or raw f32 capture through the complete tuner pipeline.
//!
//! ```text
//! cargo run -p pitch-core --example trace -- capture.wav --range 30 900
//! cargo run -p pitch-core --example trace -- capture.wav --target 82.4 --json
//! cargo run -p pitch-core --example trace -- capture.f32le --sample-rate 48000
//! ```

#[path = "support/audio.rs"]
mod audio;
#[path = "support/checksum.rs"]
mod checksum;
#[path = "support/trace_cli.rs"]
mod trace_cli;
#[path = "support/trace_report.rs"]
mod trace_report;

use audio::{read_capture, read_capture_with_raw_rate};
use checksum::sha256;
use pitch_core::{
    DetectionFrame, DetectorConfig, EngineConfig, Note, PipelineCandidate, PipelineConfig,
    TunerEngine, Tuning,
};
use std::error::Error;
use std::path::Path;
use trace_cli::{parse_options, Options};
use trace_report::ReplayEnvelope;

const WINDOW_SAMPLES: usize = 8192;
const HOP_SECONDS: f32 = 0.033;

fn main() -> Result<(), Box<dyn Error>> {
    let options = parse_options()?;
    let capture = read_audio(&options)?;
    let mut detector = DetectorConfig::default();
    if let Some((minimum, maximum)) = options.range {
        detector.set_frequency_range(minimum, maximum);
    }
    let pipeline = PipelineConfig::default();
    let tuning = target_tuning(options.target_frequency);
    let mut engine = TunerEngine::with_config(EngineConfig {
        detector,
        pipeline,
        spectrum_bins: 0,
        tuning: Some(tuning),
        ..EngineConfig::default()
    });
    let hop_samples = replay_hop_samples(capture.sample_rate, capture.samples.len())?;
    let mut report = if options.json {
        Some(ReplayEnvelope::new(
            options.path.display().to_string(),
            sha256(&options.path)?,
            capture.sample_rate,
            capture.samples.len(),
            WINDOW_SAMPLES,
            hop_samples,
            options.target_frequency,
            detector,
            pipeline,
        ))
    } else {
        print_tsv_header();
        None
    };

    let mut sample_index = 0usize;
    while sample_index + WINDOW_SAMPLES <= capture.samples.len() {
        let frame = engine.process(
            &capture.samples[sample_index..sample_index + WINDOW_SAMPLES],
            capture.sample_rate,
        );
        if let Some(report) = &mut report {
            report.push(sample_index, capture.sample_rate, frame);
        } else {
            print_tsv_frame(sample_index, capture.sample_rate, &frame);
        }
        sample_index += hop_samples;
    }

    if let Some(report) = report {
        println!("{}", serde_json::to_string_pretty(&report)?);
    }
    Ok(())
}

fn read_audio(options: &Options) -> Result<audio::AudioCapture, Box<dyn Error>> {
    if is_wav(&options.path) {
        if options.raw_sample_rate.is_some() {
            return Err("--sample-rate is only valid for raw f32 captures".into());
        }
        let sample_rate = hound::WavReader::open(&options.path)?.spec().sample_rate as f32;
        read_capture(&options.path, sample_rate)
    } else {
        read_capture_with_raw_rate(&options.path, options.raw_sample_rate)
    }
}

fn replay_hop_samples(sample_rate: f32, sample_count: usize) -> Result<usize, Box<dyn Error>> {
    if sample_count < WINDOW_SAMPLES {
        return Err(format!(
            "capture needs at least {WINDOW_SAMPLES} samples for one replay window"
        )
        .into());
    }
    let hop_samples = (sample_rate * HOP_SECONDS).round() as usize;
    if hop_samples == 0 {
        Err("sample rate is too low for the replay hop".into())
    } else {
        Ok(hop_samples)
    }
}

fn target_tuning(target_frequency: Option<f32>) -> Tuning {
    let strings = target_frequency
        .map(|frequency| {
            vec![Note {
                name: "Target",
                octave: 0,
                frequency,
            }]
        })
        .unwrap_or_default();
    Tuning {
        name: if strings.is_empty() {
            "Chromatic replay"
        } else {
            "Guided replay"
        },
        strings,
    }
}

fn print_tsv_header() {
    println!(
        "time_s\tyin_hz\tyin_conf\tmpm_hz\tmpm_conf\tselected_hz\traw_hz\tshown_hz\tnote\tcents\tconf\trms\tgate_threshold\tfixed_gate\tadaptive_gate\tarbitration\tdecision\toctave_active\toctave_pending\toctave_down\toctave_base\toctave_up"
    );
}

fn print_tsv_frame(sample_index: usize, sample_rate: f32, frame: &DetectionFrame) {
    let pipeline = frame.pipeline;
    let spectral = pipeline.spectral.unwrap_or_default();
    println!(
        "{:.3}\t{}\t{}\t{}\t{}\t{}\t{}\t{}\t{}\t{:.1}\t{:.2}\t{:.4}\t{:.4}\t{}\t{}\t{}\t{}\t{}\t{}\t{:.3}\t{:.3}\t{:.3}",
        (sample_index + WINDOW_SAMPLES) as f32 / sample_rate,
        format_candidate_frequency(pipeline.yin),
        format_candidate_confidence(pipeline.yin),
        format_candidate_frequency(pipeline.secondary),
        format_candidate_confidence(pipeline.secondary),
        format_candidate_frequency(pipeline.selected),
        format_frequency(frame.raw_freq),
        format_frequency(frame.freq),
        frame.note,
        frame.cents,
        frame.confidence,
        frame.rms,
        pipeline.gate_threshold,
        pipeline.fixed_gate_open,
        pipeline.adaptive_gate_open,
        pipeline.arbitration.as_str(),
        pipeline.decision.as_str(),
        spectral.active_octave,
        spectral.pending_octave,
        spectral.octave_scores[0],
        spectral.octave_scores[1],
        spectral.octave_scores[2],
    );
}

fn format_frequency(frequency: Option<f32>) -> String {
    frequency.map_or_else(|| "-".to_string(), |value| format!("{value:.2}"))
}

fn format_candidate_frequency(candidate: Option<PipelineCandidate>) -> String {
    format_frequency(candidate.map(|value| value.frequency))
}

fn format_candidate_confidence(candidate: Option<PipelineCandidate>) -> String {
    candidate.map_or_else(
        || "-".to_string(),
        |value| format!("{:.2}", value.confidence),
    )
}

fn is_wav(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("wav"))
}
