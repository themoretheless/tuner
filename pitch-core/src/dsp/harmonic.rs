use super::{spectral, PitchEstimate};

const HARMONIC_COUNT: u32 = 5;
const LOCAL_NOISE_OFFSET_BINS: f32 = 2.5;
const MAX_PROBE_NYQUIST_FRACTION: f32 = 0.45;
const MIN_EXCESS_POWER_FRACTION: f32 = 0.001;
const MIN_LOCAL_POWER_RATIO: f32 = 4.0;
const MIN_MATCHED_HARMONICS: u32 = 3;
const REFINEMENT_LEVELS: usize = 3;
const SEARCH_CENTS: f32 = 120.0;

#[derive(Clone, Copy)]
struct HarmonicEvidence {
    low_order_match: bool,
    matched: u32,
    ratio_log_sum: f32,
    score: f32,
}

#[derive(Clone, Copy)]
struct ScoredEstimate {
    evidence: HarmonicEvidence,
    frequency: f32,
}

/// Measures a target-adjacent pitch from a coherent harmonic series.
///
/// This detector is intentionally not a general fallback. The hybrid detector
/// invokes it only when periodicity analysis produces a result that the active
/// instrument context rejects. Requiring three locally prominent
/// harmonics, including the fundamental or second harmonic, prevents a single
/// mains-hum peak from being turned into a target frequency.
pub(crate) struct HarmonicPitchDetector {
    windowed: Vec<f32>,
}

impl HarmonicPitchDetector {
    pub(crate) fn new() -> Self {
        Self {
            windowed: Vec::new(),
        }
    }

    pub(crate) fn detect(
        &mut self,
        buffer: &[f32],
        sample_rate: f32,
        selected_target: Option<f32>,
        tuning_targets: &[f32],
        min_frequency: f32,
        max_frequency: f32,
    ) -> Option<PitchEstimate> {
        if buffer.len() < 64 || !valid_frequency(sample_rate) {
            return None;
        }
        spectral::apply_hann_window(buffer, &mut self.windowed);
        let energy = self
            .windowed
            .iter()
            .map(|sample| sample * sample)
            .sum::<f32>();
        if !energy.is_finite() || energy <= f32::EPSILON {
            return None;
        }

        let mut best = None;
        if let Some(target) = selected_target.filter(|target| valid_frequency(*target)) {
            best = self.measure_target(sample_rate, target, min_frequency, max_frequency, energy);
        } else {
            for target in tuning_targets
                .iter()
                .copied()
                .filter(|target| valid_frequency(*target))
            {
                let candidate =
                    self.measure_target(sample_rate, target, min_frequency, max_frequency, energy);
                best = better_estimate(best, candidate);
            }
        }

        let best = best?;
        let average_log_ratio = best.evidence.ratio_log_sum / best.evidence.matched as f32;
        let confidence = (0.68
            + 0.04 * best.evidence.matched as f32
            + 0.04 * (average_log_ratio / 3.0).clamp(0.0, 1.0))
        .clamp(0.70, 0.92);
        Some(PitchEstimate {
            confidence,
            frequency: best.frequency,
        })
    }

    fn measure_target(
        &self,
        sample_rate: f32,
        target: f32,
        min_frequency: f32,
        max_frequency: f32,
        energy: f32,
    ) -> Option<ScoredEstimate> {
        let ratio = (SEARCH_CENTS / 1_200.0).exp2();
        let lower = (target / ratio).max(min_frequency);
        let upper = (target * ratio).min(max_frequency);
        if upper <= lower {
            return None;
        }

        let bin_width = sample_rate / self.windowed.len() as f32;
        let mut step = (bin_width * 0.25).max(0.05);
        let boundary_margin = step * 0.5;
        let mut best = self.score_frequency(sample_rate, target.clamp(lower, upper), energy);
        best = self.scan(sample_rate, lower, upper, step, energy, best);

        for _ in 0..REFINEMENT_LEVELS {
            let radius = step;
            step *= 0.25;
            let center = best?.frequency;
            best = self.scan(
                sample_rate,
                (center - radius).max(lower),
                (center + radius).min(upper),
                step,
                energy,
                best,
            );
        }
        best.filter(|estimate| {
            estimate.frequency > lower + boundary_margin
                && estimate.frequency < upper - boundary_margin
        })
    }

    fn scan(
        &self,
        sample_rate: f32,
        lower: f32,
        upper: f32,
        step: f32,
        energy: f32,
        mut best: Option<ScoredEstimate>,
    ) -> Option<ScoredEstimate> {
        let mut frequency = lower;
        while frequency <= upper + step * 0.25 {
            best = better_estimate(
                best,
                self.score_frequency(sample_rate, frequency.min(upper), energy),
            );
            frequency += step;
        }
        best
    }

    fn score_frequency(
        &self,
        sample_rate: f32,
        frequency: f32,
        energy: f32,
    ) -> Option<ScoredEstimate> {
        let bin_width = sample_rate / self.windowed.len() as f32;
        let noise_offset = bin_width * LOCAL_NOISE_OFFSET_BINS;
        let normalizer = self.windowed.len() as f32 * energy;
        let probe_limit = sample_rate * MAX_PROBE_NYQUIST_FRACTION;
        let mut evidence = HarmonicEvidence {
            low_order_match: false,
            matched: 0,
            ratio_log_sum: 0.0,
            score: 0.0,
        };

        for harmonic in 1..=HARMONIC_COUNT {
            let probe = frequency * harmonic as f32;
            if probe >= probe_limit {
                break;
            }
            let power = spectral::goertzel_power(&self.windowed, sample_rate, probe);
            let left = spectral::goertzel_power(
                &self.windowed,
                sample_rate,
                (probe - noise_offset).max(bin_width),
            );
            let right = spectral::goertzel_power(&self.windowed, sample_rate, probe + noise_offset);
            let local_noise = 0.5 * (left + right);
            let excess = (power - local_noise).max(0.0);
            let excess_fraction = excess / normalizer.max(f32::EPSILON);
            let power_ratio = power / local_noise.max(normalizer * 1e-8);
            if excess_fraction < MIN_EXCESS_POWER_FRACTION || power_ratio < MIN_LOCAL_POWER_RATIO {
                continue;
            }

            evidence.matched += 1;
            evidence.low_order_match |= harmonic <= 2;
            evidence.ratio_log_sum += power_ratio.ln();
            evidence.score +=
                excess_fraction.sqrt() * power_ratio.ln().min(6.0) / (harmonic as f32).sqrt();
        }

        (evidence.low_order_match && evidence.matched >= MIN_MATCHED_HARMONICS).then_some(
            ScoredEstimate {
                evidence,
                frequency,
            },
        )
    }
}

fn better_estimate(
    left: Option<ScoredEstimate>,
    right: Option<ScoredEstimate>,
) -> Option<ScoredEstimate> {
    match (left, right) {
        (Some(left), Some(right)) => Some(if right.evidence.score > left.evidence.score {
            right
        } else {
            left
        }),
        (Some(value), None) | (None, Some(value)) => Some(value),
        (None, None) => None,
    }
}

fn valid_frequency(frequency: f32) -> bool {
    frequency.is_finite() && frequency > 0.0
}
