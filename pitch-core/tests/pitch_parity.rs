use pitch_core::{DetectorConfig, HybridPitchDetector, PitchDetector, MIN_USABLE_CONFIDENCE};
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PitchParityManifest {
    schema_version: u32,
    confidence_model: String,
    minimum_usable_confidence: f32,
    fixtures: Vec<PitchFixture>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PitchFixture {
    id: String,
    frequency: f32,
    sample_rate: f32,
    buffer_size: usize,
    amplitude: f32,
    dc_offset: f32,
    harmonics: Vec<f32>,
    min_frequency: f32,
    max_frequency: f32,
    minimum_confidence: f32,
    tolerance_cents: f32,
}

#[test]
fn native_detector_matches_shared_pitch_fixtures() {
    let manifest: PitchParityManifest = serde_json::from_str(include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../fixtures/pitch-parity.json"
    )))
    .expect("valid pitch parity manifest");
    assert_eq!(manifest.schema_version, 2);
    assert_eq!(manifest.confidence_model, "normalized-periodicity-v1");
    assert_eq!(manifest.minimum_usable_confidence, MIN_USABLE_CONFIDENCE);

    for fixture in manifest.fixtures {
        let samples = render_fixture(&fixture);
        let mut detector = HybridPitchDetector::new(
            DetectorConfig::default()
                .with_frequency_range(fixture.min_frequency, fixture.max_frequency),
        );
        let detection = detector
            .detect(&samples, fixture.sample_rate)
            .unwrap_or_else(|| panic!("{} should produce a detection", fixture.id));
        let error = cents_error(detection.frequency, fixture.frequency);

        assert!(
            error <= fixture.tolerance_cents,
            "{} error was {error:.3} cents: expected {:.4} Hz, got {:.4} Hz",
            fixture.id,
            fixture.frequency,
            detection.frequency,
        );
        assert!(
            detection.confidence >= fixture.minimum_confidence,
            "{} confidence was {:.3}, expected at least {:.3}",
            fixture.id,
            detection.confidence,
            fixture.minimum_confidence,
        );
    }
}

fn render_fixture(fixture: &PitchFixture) -> Vec<f32> {
    (0..fixture.buffer_size)
        .map(|index| {
            let phase =
                std::f32::consts::TAU * fixture.frequency * index as f32 / fixture.sample_rate;
            let harmonic_sum = fixture
                .harmonics
                .iter()
                .enumerate()
                .map(|(harmonic, weight)| weight * (phase * (harmonic + 1) as f32).sin())
                .sum::<f32>();
            fixture.dc_offset + fixture.amplitude * harmonic_sum
        })
        .collect()
}

fn cents_error(actual: f32, expected: f32) -> f32 {
    (1_200.0 * (actual / expected).log2()).abs()
}
