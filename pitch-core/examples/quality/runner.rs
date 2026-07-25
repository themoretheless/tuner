use super::audio::read_capture;
use super::checksum::sha256;
use super::manifest::{invalid_input, CorpusManifest, ScenarioManifest};
use super::pipeline::{evaluate_capture, evaluate_thresholds, merge_thresholds};
use super::report;
use pitch_core::{mix_white_noise_at_snr, PitchQualityThresholds};
use std::error::Error;
use std::path::Path;

pub fn run_single(
    capture_path: &Path,
    scenario_path: &Path,
    check: bool,
) -> Result<(String, bool), Box<dyn Error>> {
    let manifest = ScenarioManifest::load(scenario_path)?;
    let capture = read_capture(capture_path, manifest.scenario.sample_rate)?;
    let runtime = manifest.scenario.runtime(capture.samples.len())?;
    let metrics = evaluate_capture(&capture.samples, &manifest.scenario, &runtime)?;
    let thresholds = manifest.scenario.quality_thresholds();
    if check && thresholds.is_none() {
        return Err(invalid_input(
            "--check requires a thresholds object in the scenario",
        ));
    }
    let violations = evaluate_thresholds(&metrics, thresholds)?;
    let report = report::build(
        capture_path.display().to_string(),
        &manifest.scenario,
        &runtime,
        thresholds,
        metrics,
        violations,
    );
    let passed = report.passed();
    Ok((serde_json::to_string_pretty(&report)?, passed))
}

pub fn run_corpus(manifest_path: &Path) -> Result<(String, bool), Box<dyn Error>> {
    let corpus = CorpusManifest::load(manifest_path)?;
    let root = manifest_path.parent().unwrap_or_else(|| Path::new("."));
    let global_thresholds: PitchQualityThresholds = corpus.thresholds.into();
    let mut capture_reports = Vec::with_capacity(corpus.captures.len());

    for entry in &corpus.captures {
        let scenario = corpus.scenario_defaults.build(&entry.scenario);
        let capture_path = root.join(&entry.capture);
        verify_sha256(&capture_path, &entry.capture_sha256)?;
        let capture = read_capture(&capture_path, scenario.sample_rate)?;
        validate_duration(entry, capture.samples.len(), capture.sample_rate)?;
        let runtime = scenario.runtime(capture.samples.len())?;
        let metrics = evaluate_capture(&capture.samples, &scenario, &runtime)?;
        let thresholds = merge_thresholds(global_thresholds, scenario.quality_thresholds());
        let violations = evaluate_thresholds(&metrics, Some(thresholds))?;

        // SNR robustness grid: replay the same capture against deterministic
        // white Gaussian noise (mixed in memory; fixtures stay untouched).
        // Each level has its own, looser, tolerances from the manifest.
        let mut snr_levels = Vec::new();
        if let Some(grid) = &corpus.snr_grid {
            for (level, level_thresholds) in grid.levels() {
                let noisy =
                    mix_white_noise_at_snr(&capture.samples, level, snr_seed(&entry.id, level));
                let metrics = evaluate_capture(&noisy, &scenario, &runtime)?;
                let thresholds =
                    merge_thresholds(level_thresholds.into(), scenario.quality_thresholds());
                let violations = evaluate_thresholds(&metrics, Some(thresholds))?;
                snr_levels.push(report::build_snr_level(
                    level, &scenario, thresholds, metrics, violations,
                ));
            }
        }

        capture_reports.push(report::build_corpus_capture(
            entry,
            capture_path.display().to_string(),
            &scenario,
            &runtime,
            thresholds,
            metrics,
            violations,
            snr_levels,
        ));
    }

    let report = report::build_corpus(&corpus, capture_reports);
    let passed = report.passed();
    Ok((serde_json::to_string_pretty(&report)?, passed))
}

/// Stable per-capture, per-level noise seed (FNV-1a over the capture id and
/// the level bits) so grid runs are reproducible but captures do not share
/// one noise realization.
fn snr_seed(capture_id: &str, level: f32) -> u64 {
    let mut hash = 0xcbf2_9ce4_8422_2325_u64;
    for byte in capture_id
        .as_bytes()
        .iter()
        .chain(level.to_bits().to_le_bytes().iter())
    {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
    }
    hash
}

fn validate_duration(
    entry: &super::manifest::CorpusCapture,
    sample_count: usize,
    sample_rate: f32,
) -> Result<(), Box<dyn Error>> {
    let duration = sample_count as f32 / sample_rate;
    if (duration - entry.transform.duration_seconds).abs() > 1.0 / sample_rate {
        return Err(invalid_input(format!(
            "capture {} duration {duration} does not match transform duration {}",
            entry.id, entry.transform.duration_seconds
        )));
    }
    if entry.annotation.end_seconds > duration {
        return Err(invalid_input(format!(
            "annotation for {} ends outside its capture",
            entry.id
        )));
    }
    Ok(())
}

fn verify_sha256(path: &Path, expected: &str) -> Result<(), Box<dyn Error>> {
    let actual = sha256(path)?;
    if actual.eq_ignore_ascii_case(expected) {
        Ok(())
    } else {
        Err(invalid_input(format!(
            "capture checksum mismatch for {}: expected {expected}, got {actual}",
            path.display()
        )))
    }
}
