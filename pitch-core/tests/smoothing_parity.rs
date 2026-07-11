use pitch_core::Smoother;
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SmoothingManifest {
    schema_version: u32,
    alpha: f32,
    history_capacity: usize,
    traces: Vec<SmoothingTrace>,
}

#[derive(Deserialize)]
struct SmoothingTrace {
    id: String,
    inputs: Vec<Option<f32>>,
    outputs: Vec<Option<f32>>,
}

#[test]
fn native_smoother_matches_shared_traces() {
    let manifest: SmoothingManifest = serde_json::from_str(include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../fixtures/smoothing-parity.json"
    )))
    .expect("valid smoothing parity manifest");
    assert_eq!(manifest.schema_version, 1);
    assert_eq!(manifest.alpha, 0.4);
    assert_eq!(manifest.history_capacity, 5);

    for trace in manifest.traces {
        assert_eq!(trace.inputs.len(), trace.outputs.len(), "{}", trace.id);
        let mut smoother = Smoother::new();
        for (index, (input, expected)) in trace.inputs.into_iter().zip(trace.outputs).enumerate() {
            let actual = smoother.add(input);
            match (actual, expected) {
                (Some(actual), Some(expected)) => assert!(
                    (actual - expected).abs() < 0.001,
                    "{}[{index}]: expected {expected}, got {actual}",
                    trace.id,
                ),
                (None, None) => {}
                _ => panic!(
                    "{}[{index}]: expected {expected:?}, got {actual:?}",
                    trace.id
                ),
            }
        }
    }
}
