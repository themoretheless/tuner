use super::PitchEstimate;

const AGREEMENT_CENTS: f32 = 35.0;
const GUIDED_IMPROVEMENT_CENTS: f32 = 80.0;
const GUIDED_RAW_DISTANCE_CENTS: f32 = 300.0;
const SELECTED_RESOLVED_DISTANCE_CENTS: f32 = 350.0;
const TUNING_RESOLVED_DISTANCE_CENTS: f32 = 450.0;
const UNGUIDED_CONFIDENCE_MARGIN: f32 = 0.12;
const UNGUIDED_STRONG_CONFIDENCE: f32 = 0.90;

/// Pitch-domain hints supplied by the application layer.
///
/// Hints may choose between independently measured candidates, but they never
/// manufacture or snap a frequency. Chromatic mode supplies no guidance;
/// instrument mode supplies tuning targets and an explicitly selected string
/// takes precedence over the rest of the tuning.
#[derive(Clone, Copy, Debug)]
pub(crate) struct PitchGuidance<'a> {
    selected: Option<f32>,
    targets: &'a [f32],
}

impl<'a> PitchGuidance<'a> {
    pub(crate) fn new(selected: Option<f32>, targets: &'a [f32]) -> Self {
        Self { selected, targets }
    }

    pub(crate) fn none() -> Self {
        Self::new(None, &[])
    }

    pub(crate) fn is_empty(self) -> bool {
        self.selected.is_none() && self.targets.is_empty()
    }

    pub(crate) fn selected_target(self) -> Option<f32> {
        self.selected
    }

    pub(crate) fn tuning_targets(self) -> &'a [f32] {
        self.targets
    }

    fn raw_distance(self, frequency: f32) -> Option<f32> {
        [frequency, frequency * 0.5, frequency * 2.0]
            .into_iter()
            .filter(|candidate| candidate.is_finite() && *candidate > 0.0)
            .filter_map(|candidate| self.direct_distance(candidate))
            .min_by(f32::total_cmp)
    }

    fn direct_distance(self, frequency: f32) -> Option<f32> {
        if let Some(selected) = self.selected.filter(|value| valid_frequency(*value)) {
            return Some(cents_distance(frequency, selected));
        }
        self.targets
            .iter()
            .copied()
            .filter(|target| valid_frequency(*target))
            .map(|target| cents_distance(frequency, target))
            .min_by(f32::total_cmp)
    }

    pub(crate) fn supports_resolved(self, frequency: f32) -> bool {
        if self.is_empty() {
            return true;
        }
        let maximum = if self.selected.is_some() {
            SELECTED_RESOLVED_DISTANCE_CENTS
        } else {
            TUNING_RESOLVED_DISTANCE_CENTS
        };
        self.direct_distance(frequency)
            .is_some_and(|distance| distance <= maximum)
    }
}

/// Reconciles independent time-domain estimates before any temporal smoothing.
/// Agreement is fused in log-frequency space. During a disagreement, a tuning
/// hint can prefer the independently measured candidate that is musically
/// plausible; without a hint, only a decisive confidence advantage is enough
/// to publish one side.
pub(crate) fn select_pitch_candidate(
    yin: Option<PitchEstimate>,
    mpm: Option<PitchEstimate>,
    guidance: PitchGuidance<'_>,
) -> Option<PitchEstimate> {
    match (yin.filter(valid_estimate), mpm.filter(valid_estimate)) {
        (Some(yin), Some(mpm)) => {
            if cents_distance(yin.frequency, mpm.frequency) <= AGREEMENT_CENTS {
                return Some(fuse(yin, mpm));
            }

            if !guidance.is_empty() {
                if let (Some(yin_distance), Some(mpm_distance)) = (
                    guidance.raw_distance(yin.frequency),
                    guidance.raw_distance(mpm.frequency),
                ) {
                    let (preferred, preferred_distance, other_distance) =
                        if yin_distance <= mpm_distance {
                            (yin, yin_distance, mpm_distance)
                        } else {
                            (mpm, mpm_distance, yin_distance)
                        };
                    if preferred_distance <= GUIDED_RAW_DISTANCE_CENTS
                        && other_distance - preferred_distance >= GUIDED_IMPROVEMENT_CENTS
                    {
                        return Some(preferred);
                    }
                }
            }

            let (stronger, weaker) = if yin.confidence >= mpm.confidence {
                (yin, mpm)
            } else {
                (mpm, yin)
            };
            (stronger.confidence >= UNGUIDED_STRONG_CONFIDENCE
                && stronger.confidence - weaker.confidence >= UNGUIDED_CONFIDENCE_MARGIN)
                .then_some(stronger)
        }
        (Some(estimate), None) | (None, Some(estimate)) => Some(estimate),
        (None, None) => None,
    }
}

/// Replaces an instrument-incompatible periodicity result only when an
/// independently measured harmonic series is substantially closer to the
/// active target. The spectral detector already requires local SNR and three
/// coherent harmonics; this final distance check keeps context as an arbiter,
/// never a frequency generator.
pub(crate) fn prefer_guided_harmonic(
    primary: Option<PitchEstimate>,
    harmonic: Option<PitchEstimate>,
    guidance: PitchGuidance<'_>,
) -> Option<PitchEstimate> {
    let primary = primary.filter(valid_estimate);
    let Some(harmonic) = harmonic.filter(valid_estimate) else {
        return primary;
    };
    let Some(harmonic_distance) = guidance.direct_distance(harmonic.frequency) else {
        return primary;
    };
    if harmonic_distance > GUIDED_RAW_DISTANCE_CENTS {
        return primary;
    }

    let Some(primary) = primary else {
        return Some(harmonic);
    };
    let Some(primary_distance) = guidance.direct_distance(primary.frequency) else {
        return Some(harmonic);
    };
    (primary_distance - harmonic_distance >= GUIDED_IMPROVEMENT_CENTS)
        .then_some(harmonic)
        .or(Some(primary))
}

fn fuse(left: PitchEstimate, right: PitchEstimate) -> PitchEstimate {
    let left_weight = left.confidence.max(0.01);
    let right_weight = right.confidence.max(0.01);
    let frequency = ((left.frequency.log2() * left_weight + right.frequency.log2() * right_weight)
        / (left_weight + right_weight))
        .exp2();
    PitchEstimate {
        confidence: ((left.confidence + right.confidence) * 0.5).clamp(0.0, 1.0),
        frequency,
    }
}

fn cents_distance(left: f32, right: f32) -> f32 {
    (1_200.0 * (left / right).log2()).abs()
}

fn valid_estimate(estimate: &PitchEstimate) -> bool {
    valid_frequency(estimate.frequency)
        && estimate.confidence.is_finite()
        && (0.0..=1.0).contains(&estimate.confidence)
}

fn valid_frequency(frequency: f32) -> bool {
    frequency.is_finite() && frequency > 0.0
}

#[cfg(test)]
mod tests {
    use super::*;

    fn estimate(frequency: f32, confidence: f32) -> Option<PitchEstimate> {
        Some(PitchEstimate {
            confidence,
            frequency,
        })
    }

    #[test]
    fn agreeing_detectors_are_fused_in_pitch_space() {
        let selected = select_pitch_candidate(
            estimate(82.3, 0.90),
            estimate(82.5, 0.94),
            PitchGuidance::none(),
        )
        .expect("agreement");
        assert!((selected.frequency - 82.4).abs() < 0.15);
        assert!((selected.confidence - 0.92).abs() < 0.01);
    }

    #[test]
    fn guidance_chooses_an_independently_measured_target_candidate() {
        let targets = [82.4069];
        let selected = select_pitch_candidate(
            estimate(55.04, 0.82),
            estimate(82.35, 0.78),
            PitchGuidance::new(Some(82.4069), &targets),
        )
        .expect("guided candidate");
        assert!((selected.frequency - 82.35).abs() < 0.01);
    }

    #[test]
    fn unresolved_disagreement_is_not_published() {
        assert!(select_pitch_candidate(
            estimate(55.0, 0.82),
            estimate(82.4, 0.78),
            PitchGuidance::none(),
        )
        .is_none());
    }

    #[test]
    fn resolved_frequency_must_remain_near_the_instrument() {
        let targets = [82.4069, 110.0];
        let guidance = PitchGuidance::new(None, &targets);
        assert!(guidance.supports_resolved(82.0));
        assert!(!guidance.supports_resolved(55.0));

        let selected = PitchGuidance::new(Some(82.4069), &targets);
        assert!(selected.supports_resolved(82.0));
        assert!(!selected.supports_resolved(110.0));
    }

    #[test]
    fn coherent_guided_harmonics_can_replace_a_false_time_consensus() {
        let targets = [82.4069];
        let selected = prefer_guided_harmonic(
            estimate(54.86, 0.80),
            estimate(82.38, 0.84),
            PitchGuidance::new(Some(82.4069), &targets),
        )
        .expect("harmonic alternative");
        assert!((selected.frequency - 82.38).abs() < 0.01);
    }
}
