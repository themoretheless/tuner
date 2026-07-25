//! End-to-end test of the corpus SNR grid: the `quality` example must
//! re-evaluate a capture at every configured SNR level with deterministic
//! noise and report per-level results.

use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::process::Command;

fn example_binary() -> PathBuf {
    // The unoptimized example is far too slow for time-domain pitch
    // detection over whole captures, so prefer the release example (built by
    // the benchmark workflow); fall back to the debug one `cargo test`
    // builds only when no release binary exists.
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let target = manifest_dir
        .parent()
        .expect("workspace root")
        .join("target");
    let release = target.join("release/examples/quality");
    let debug = target.join("debug/examples/quality");
    let binary = if release.exists() { release } else { debug };
    assert!(
        binary.exists(),
        "quality example binary missing at {}",
        binary.display()
    );
    binary
}

fn write_single_capture_manifest(dir: &Path) -> PathBuf {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let corpus_path = manifest_dir
        .parent()
        .expect("workspace root")
        .join("fixtures/corpus/manifest.json");
    let corpus: Value =
        serde_json::from_str(&std::fs::read_to_string(&corpus_path).expect("corpus manifest"))
            .expect("parse corpus manifest");

    let mut capture = corpus["captures"][0].clone();
    // Capture paths are resolved relative to the manifest's own directory;
    // the temp manifest lives elsewhere, so pin the fixture absolutely.
    let capture_file = corpus_path
        .parent()
        .expect("corpus dir")
        .join(capture["capture"].as_str().expect("capture path"));
    capture["capture"] = Value::from(capture_file.to_string_lossy().into_owned());
    let instrument = capture["instrument"].clone();
    let note = capture["note"].clone();
    let gate = json!({
        "maxTimeToFirstCorrectMs": 2000,
        "maxMissedAcquisitions": 5,
        "maxFalseLockRatio": 0.9,
        "maxNoteSwitchesPerSecond": 5.0,
        "maxStableSustainCentsMae": 40,
        "minStableDetectionCoverage": 0.2
    });
    let single = json!({
        "schemaVersion": 2,
        "id": "snr-grid-test",
        "configRevision": "snr-grid-test-v1",
        "thresholds": gate,
        "scenarioDefaults": corpus["scenarioDefaults"],
        "requirements": [{
            "instrument": instrument,
            "notes": [note],
        }],
        "captures": [capture],
        "snrGrid": {
            "levelsDb": [30, 20, 10],
            "thresholds": { "30": gate, "20": gate, "10": gate },
        },
    });

    std::fs::create_dir_all(dir).expect("create temp dir");
    let path = dir.join("snr-grid-manifest.json");
    std::fs::write(&path, serde_json::to_string_pretty(&single).unwrap()).expect("write manifest");
    path
}

fn run_grid(manifest: &Path) -> Value {
    let output = Command::new(example_binary())
        .arg("--check")
        .arg("--corpus")
        .arg(manifest)
        .output()
        .expect("run quality example");
    assert!(
        output.status.success(),
        "quality example failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    serde_json::from_slice(&output.stdout).expect("report json")
}

#[test]
fn corpus_run_produces_per_snr_level_results() {
    let dir = std::env::temp_dir().join("pitch-core-snr-grid-test");
    let manifest = write_single_capture_manifest(&dir);
    let report = run_grid(&manifest);

    assert_eq!(report["schemaVersion"], 2);
    let capture = &report["captures"][0];
    let levels = capture["snrLevels"]
        .as_array()
        .expect("snrLevels must be an array");
    assert_eq!(levels.len(), 3, "one report per configured SNR level");

    let expected = [30.0, 20.0, 10.0];
    for (level, expected_snr) in levels.iter().zip(expected) {
        assert_eq!(level["snrDb"].as_f64().unwrap() as f32, expected_snr);
        assert!(level["passed"].is_boolean());
        assert!(level["thresholds"].is_object());
        assert!(level["violations"].is_array());
        let metrics = &level["metrics"];
        assert!(metrics["stableDetectionCoverage"].is_number());
        assert!(metrics["stableSustainCentsMae"].is_number());
        // Noisy evaluation must still detect the note most of the time.
        assert!(
            metrics["stableDetectionCoverage"].as_f64().unwrap() > 0.5,
            "coverage collapsed at {expected_snr} dB"
        );
    }

    // The clean-condition gate is unchanged: the capture still carries its
    // own top-level clean report without noise fields.
    assert!(capture["passed"].is_boolean());
    assert!(capture["metrics"]["stableSustainCentsMae"].is_number());
}

#[test]
fn snr_grid_is_deterministic_across_runs() {
    let dir = std::env::temp_dir().join("pitch-core-snr-grid-test");
    let manifest = write_single_capture_manifest(&dir);
    let first = run_grid(&manifest);
    let second = run_grid(&manifest);
    assert_eq!(
        first["captures"][0]["snrLevels"], second["captures"][0]["snrLevels"],
        "seeded noise must reproduce identical per-level results"
    );
}
