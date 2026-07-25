//! End-to-end test of the corpus reverb grid: the `quality` example must
//! re-evaluate a capture under every configured reverb condition with a
//! deterministic impulse response and report per-condition results.

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

    // Mirrors the shipped corpus gates: plausible conditions a good detector
    // must still pass, so the test doubles as a "condition stays passable"
    // guard.
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
        "id": "reverb-grid-test",
        "configRevision": "reverb-grid-test-v1",
        "thresholds": gate,
        "scenarioDefaults": corpus["scenarioDefaults"],
        "requirements": [{
            "instrument": instrument,
            "notes": [note],
        }],
        "captures": [capture],
        "reverbGrid": {
            "conditions": [
                { "rt60Seconds": 0.3 },
                { "rt60Seconds": 0.8 },
                { "rt60Seconds": 1.5 }
            ],
            "thresholds": { "0.3": gate, "0.8": gate, "1.5": gate },
        },
    });

    std::fs::create_dir_all(dir).expect("create temp dir");
    let path = dir.join("reverb-grid-manifest.json");
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
fn corpus_run_produces_per_condition_results_and_plausible_conditions_pass() {
    let dir = std::env::temp_dir().join("pitch-core-reverb-grid-test");
    let manifest = write_single_capture_manifest(&dir);
    let report = run_grid(&manifest);

    assert_eq!(report["schemaVersion"], 2);
    let capture = &report["captures"][0];
    let conditions = capture["reverbConditions"]
        .as_array()
        .expect("reverbConditions must be an array");
    assert_eq!(conditions.len(), 3, "one report per configured condition");

    let expected = [0.3, 0.8, 1.5];
    for (condition, expected_rt60) in conditions.iter().zip(expected) {
        assert_eq!(
            condition["rt60Seconds"].as_f64().unwrap() as f32,
            expected_rt60
        );
        // Default wet mix is documented as -12 dB.
        assert_eq!(condition["wetDb"].as_f64().unwrap() as f32, -12.0);
        assert!(condition["thresholds"].is_object());
        assert!(condition["violations"].is_array());
        let metrics = &condition["metrics"];
        assert!(metrics["stableDetectionCoverage"].is_number());
        assert!(metrics["stableSustainCentsMae"].is_number());
        assert!(
            metrics["stableDetectionCoverage"].as_f64().unwrap() > 0.5,
            "coverage collapsed at RT60 {expected_rt60} s"
        );
        // A plausible reverb condition must still pass its threshold on a
        // clean capture.
        assert_eq!(
            condition["passed"], true,
            "condition RT60 {expected_rt60} s must pass on a clean capture"
        );
    }

    // The clean-condition gate is unchanged.
    assert!(capture["passed"].is_boolean());
    assert!(capture["metrics"]["stableSustainCentsMae"].is_number());
}

#[test]
fn reverb_grid_is_deterministic_across_runs() {
    let dir = std::env::temp_dir().join("pitch-core-reverb-grid-test");
    let manifest = write_single_capture_manifest(&dir);
    let first = run_grid(&manifest);
    let second = run_grid(&manifest);
    assert_eq!(
        first["captures"][0]["reverbConditions"], second["captures"][0]["reverbConditions"],
        "seeded impulse responses must reproduce identical per-condition results"
    );
}
