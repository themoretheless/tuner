use super::manifest::{ScenarioDefinition, ScenarioRuntime};
use pitch_core::{
    evaluate_pitch_quality, evaluate_quality_thresholds, EngineConfig, Note, PitchObservation,
    PitchQualityMetrics, PitchQualityThresholds, QualityThresholdViolation, TunerEngine, Tuning,
};
use std::error::Error;

pub fn evaluate_capture(
    samples: &[f32],
    scenario: &ScenarioDefinition,
    runtime: &ScenarioRuntime,
) -> Result<PitchQualityMetrics, Box<dyn Error>> {
    let observations = run_pipeline(samples, scenario, runtime);
    Ok(evaluate_pitch_quality(
        &observations,
        &scenario.expected_segments(),
        runtime.evaluation,
    )?)
}

pub fn evaluate_thresholds(
    metrics: &PitchQualityMetrics,
    thresholds: Option<PitchQualityThresholds>,
) -> Result<Vec<QualityThresholdViolation>, Box<dyn Error>> {
    thresholds.map_or_else(
        || Ok(Vec::new()),
        |thresholds| Ok(evaluate_quality_thresholds(metrics, thresholds)?),
    )
}

pub fn merge_thresholds(
    base: PitchQualityThresholds,
    overrides: Option<PitchQualityThresholds>,
) -> PitchQualityThresholds {
    let Some(overrides) = overrides else {
        return base;
    };
    PitchQualityThresholds {
        max_time_to_first_correct_ms: overrides
            .max_time_to_first_correct_ms
            .or(base.max_time_to_first_correct_ms),
        max_mean_reacquisition_latency_ms: overrides
            .max_mean_reacquisition_latency_ms
            .or(base.max_mean_reacquisition_latency_ms),
        max_reacquisition_latency_ms: overrides
            .max_reacquisition_latency_ms
            .or(base.max_reacquisition_latency_ms),
        max_missed_acquisitions: overrides
            .max_missed_acquisitions
            .or(base.max_missed_acquisitions),
        max_false_lock_ratio: overrides.max_false_lock_ratio.or(base.max_false_lock_ratio),
        max_note_switches_per_second: overrides
            .max_note_switches_per_second
            .or(base.max_note_switches_per_second),
        max_stable_sustain_cents_mae: overrides
            .max_stable_sustain_cents_mae
            .or(base.max_stable_sustain_cents_mae),
        min_stable_detection_coverage: overrides
            .min_stable_detection_coverage
            .or(base.min_stable_detection_coverage),
    }
}

fn run_pipeline(
    samples: &[f32],
    scenario: &ScenarioDefinition,
    runtime: &ScenarioRuntime,
) -> Vec<PitchObservation> {
    let mut engine = TunerEngine::with_config(EngineConfig {
        detector: runtime.detector,
        spectrum_bins: 0,
        tuning: Some(scenario_tuning(scenario)),
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

fn scenario_tuning(scenario: &ScenarioDefinition) -> Tuning {
    let strings = if scenario.guidance.unwrap_or_default().uses_tuning_targets() {
        scenario
            .segments
            .iter()
            .map(|segment| Note {
                name: "Target",
                octave: 0,
                frequency: segment.target_frequency,
            })
            .collect()
    } else {
        Vec::new()
    };
    Tuning {
        name: "Quality scenario",
        strings,
    }
}
