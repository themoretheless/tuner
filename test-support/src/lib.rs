use serde::Deserialize;
use std::path::{Path, PathBuf};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionReplayContract {
    pub schema_version: u32,
    pub window_samples: usize,
    pub hop_seconds: f32,
    pub maximum_frames: usize,
    pub range: ReplayRange,
    pub cases: Vec<ReplayCase>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplayRange {
    pub min_frequency: f32,
    pub max_frequency: f32,
}

#[derive(Deserialize)]
pub struct ReplayCase {
    pub id: String,
    pub capture: String,
    pub target: ReplayTarget,
}

#[derive(Clone, Deserialize)]
pub struct ReplayTarget {
    pub frequency: f32,
    pub name: String,
    pub octave: i32,
}

pub struct AudioCapture {
    pub sample_rate: f32,
    pub samples: Vec<f32>,
}

pub fn load_session_replay_contract() -> SessionReplayContract {
    serde_json::from_str(include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../fixtures/session-replay.json"
    )))
    .expect("valid session replay contract")
}

pub fn read_fixture_capture(relative: &str) -> AudioCapture {
    read_pcm16_wav(&fixture_path(relative))
}

pub fn cents_error(actual: f32, expected: f32) -> f32 {
    (1_200.0 * (actual / expected).log2()).abs()
}

fn fixture_path(relative: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../fixtures")
        .join(relative)
}

fn read_pcm16_wav(path: &Path) -> AudioCapture {
    let mut reader = hound::WavReader::open(path).expect("licensed WAV fixture");
    let spec = reader.spec();
    assert_eq!(spec.sample_format, hound::SampleFormat::Int);
    assert_eq!(spec.bits_per_sample, 16);
    assert_eq!(spec.channels, 1);
    let samples = reader
        .samples::<i16>()
        .map(|sample| sample.expect("valid PCM16 sample") as f32 / 32_768.0)
        .collect();
    AudioCapture {
        sample_rate: spec.sample_rate as f32,
        samples,
    }
}
