use super::PitchEstimate;

const AGREEMENT_CENTS: f32 = 35.0;
const GUIDED_IMPROVEMENT_CENTS: f32 = 80.0;
const GUIDED_RAW_DISTANCE_CENTS: f32 = 300.0;
const SELECTED_RESOLVED_DISTANCE_CENTS: f32 = 350.0;
const TUNING_RESOLVED_DISTANCE_CENTS: f32 = 450.0;
const UNGUIDED_STRONG_CONFIDENCE: f32 = 0.90;
/// Reliability margin required to publish one side of an unresolved
/// disagreement: the winner's predicted error must be at least this factor
/// below the loser's. Replaces the old raw-confidence margin, which compared
/// incomparable scales (YIN 1−CMNDF vs raw MPM NSDF peak).
const UNGUIDED_RELIABILITY_MARGIN: f32 = 1.3;
/// Bounds for the fused weight ratio. The calibration curves capture a
/// stable ~2-2.5x reliability ratio between the detectors; clamping keeps
/// the calibration from ever dominating the measurements themselves.
///
/// Round-10 revisit (representativeness-extended probe: reverb RT60 0.8 s,
/// SNR down to 8/10 dB, pluck attacks, vocal vibrato, bass E1, >660 Hz —
/// 1933 agreeing frame pairs): the clamp binds only at the upper edge
/// (39% of frames, never at the lower edge), and relaxing it — unclamped
/// or [0.25, 4.0] — changes fused MAE by <= 0.002 cents in EVERY stratum
/// (SNR, reverb, band, profile, modifier, phase). No stratum showed an
/// optimal ratio inside a wider range, so the clamp stays [0.5, 2.0]:
/// it is a safeguard for conditions the calibration has not seen (real
/// recordings, where fusion measurably helps), not a tuning knob.
const MIN_FUSION_WEIGHT_RATIO: f32 = 0.5;
const MAX_FUSION_WEIGHT_RATIO: f32 = 2.0;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum CandidateSelectionReason {
    None,
    YinOnly,
    SecondaryOnly,
    Fused,
    GuidedYin,
    GuidedSecondary,
    ConfidenceYin,
    ConfidenceSecondary,
    RejectedDisagreement,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) struct CandidateSelection {
    pub(crate) estimate: Option<PitchEstimate>,
    pub(crate) reason: CandidateSelectionReason,
}

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
#[cfg(test)]
fn select_pitch_candidate(
    yin: Option<PitchEstimate>,
    mpm: Option<PitchEstimate>,
    guidance: PitchGuidance<'_>,
) -> Option<PitchEstimate> {
    select_pitch_candidate_with_reason(yin, mpm, guidance).estimate
}

pub(crate) fn select_pitch_candidate_with_reason(
    yin: Option<PitchEstimate>,
    mpm: Option<PitchEstimate>,
    guidance: PitchGuidance<'_>,
) -> CandidateSelection {
    match (yin.filter(valid_estimate), mpm.filter(valid_estimate)) {
        (Some(yin), Some(mpm)) => {
            if cents_distance(yin.frequency, mpm.frequency) <= AGREEMENT_CENTS {
                return CandidateSelection {
                    estimate: Some(fuse(yin, mpm)),
                    reason: CandidateSelectionReason::Fused,
                };
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
                        return CandidateSelection {
                            estimate: Some(preferred),
                            reason: if preferred == yin {
                                CandidateSelectionReason::GuidedYin
                            } else {
                                CandidateSelectionReason::GuidedSecondary
                            },
                        };
                    }
                }
            }

            // Unguided disagreement: prefer the detector predicted to be more
            // accurate on this frame, not the one with the higher raw score
            // — the raw scales are not comparable (C82).
            let yin_error = predicted_error_yin(yin.confidence);
            let mpm_error = predicted_error_mpm(mpm.confidence);
            let (stronger, stronger_error, weaker_error, reason) = if yin_error <= mpm_error {
                (
                    yin,
                    yin_error,
                    mpm_error,
                    CandidateSelectionReason::ConfidenceYin,
                )
            } else {
                (
                    mpm,
                    mpm_error,
                    yin_error,
                    CandidateSelectionReason::ConfidenceSecondary,
                )
            };
            let estimate = (stronger.confidence >= UNGUIDED_STRONG_CONFIDENCE
                && weaker_error / stronger_error >= UNGUIDED_RELIABILITY_MARGIN)
                .then_some(stronger);
            CandidateSelection {
                estimate,
                reason: if estimate.is_some() {
                    reason
                } else {
                    CandidateSelectionReason::RejectedDisagreement
                },
            }
        }
        (Some(estimate), None) => CandidateSelection {
            estimate: Some(estimate),
            reason: CandidateSelectionReason::YinOnly,
        },
        (None, Some(estimate)) => CandidateSelection {
            estimate: Some(estimate),
            reason: CandidateSelectionReason::SecondaryOnly,
        },
        (None, None) => CandidateSelection {
            estimate: None,
            reason: CandidateSelectionReason::None,
        },
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

/// Predicted absolute error (cents) of a raw YIN score.
///
/// Both detectors emit a proxy for the lag-domain correlation at the chosen
/// period (YIN: 1−CMNDF, MPM: raw NSDF peak), but the proxies are not on the
/// same scale (C82). A synthetic probe grid (3 harmonic profiles × 8
/// fundamentals × SNR ∞/25/15/8 dB × pluck decay × vibrato × inharmonicity —
/// deliberately disjoint from the evaluation corpus) shows that at equal raw
/// confidence the YIN estimate errs ~2-2.5x more than the MPM estimate, and
/// that this ratio is stable across condition families. These affine curves
/// capture only that robust ratio; their absolute values encode the probe's
/// conditions and are never used as an absolute error claim.
fn predicted_error_yin(confidence: f32) -> f32 {
    8.5 + 160.0 * (1.0 - confidence).max(0.0)
}

/// Predicted absolute error (cents) of a raw MPM score; see
/// [`predicted_error_yin`].
fn predicted_error_mpm(confidence: f32) -> f32 {
    3.5 + 115.0 * (1.0 - confidence).max(0.0)
}

/// Reliability weights for fusing a YIN/MPM pair. Each weight is the inverse
/// predicted error; the ratio is clamped to
/// [`MIN_FUSION_WEIGHT_RATIO`]..=[`MAX_FUSION_WEIGHT_RATIO`] so the
/// calibration can tilt the fusion toward the more reliable detector but can
/// never silence the other one.
fn fusion_weights(yin: &PitchEstimate, mpm: &PitchEstimate) -> (f32, f32) {
    let yin_weight = predicted_error_yin(yin.confidence).recip();
    let mpm_weight = predicted_error_mpm(mpm.confidence).recip();
    let ratio = (mpm_weight / yin_weight).clamp(MIN_FUSION_WEIGHT_RATIO, MAX_FUSION_WEIGHT_RATIO);
    (yin_weight, yin_weight * ratio)
}

fn fuse(yin: PitchEstimate, mpm: PitchEstimate) -> PitchEstimate {
    let (yin_weight, mpm_weight) = fusion_weights(&yin, &mpm);
    let frequency = ((yin.frequency.log2() * yin_weight + mpm.frequency.log2() * mpm_weight)
        / (yin_weight + mpm_weight))
        .exp2();
    PitchEstimate {
        confidence: ((yin.confidence + mpm.confidence) * 0.5).clamp(0.0, 1.0),
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

    #[test]
    fn calibration_is_monotone_and_penalizes_the_inflated_yin_scale() {
        for confidence in [0.70, 0.80, 0.90, 0.95, 0.99, 1.0] {
            assert!(predicted_error_yin(confidence) > predicted_error_mpm(confidence));
        }
        assert!(predicted_error_yin(0.90) > predicted_error_yin(0.95));
        assert!(predicted_error_mpm(0.90) > predicted_error_mpm(0.95));
    }

    #[test]
    fn fusion_at_equal_raw_confidence_tilts_toward_mpm_not_yin() {
        // Equal raw scores: the probe shows MPM is ~2x more reliable here, so
        // the fused frequency must sit at or closer to the MPM candidate —
        // never biased toward the systematically inflated YIN scale.
        let fused = fuse(
            PitchEstimate {
                confidence: 0.95,
                frequency: 82.20,
            },
            PitchEstimate {
                confidence: 0.95,
                frequency: 82.60,
            },
        );
        let log_midpoint = (82.20_f32 * 82.60).sqrt();
        assert!(fused.frequency >= log_midpoint);
        assert!(fused.frequency <= 82.60);
    }

    #[test]
    fn fusion_is_unbiased_when_calibrated_reliability_matches() {
        // σ_yin(0.97) = 13.3 equals σ_mpm(~0.9148); the fusion must then land
        // on the log-space midpoint instead of favoring either detector.
        let yin_confidence = 0.97;
        let mpm_confidence = 1.0 - (predicted_error_yin(yin_confidence) - 3.5) / 115.0;
        assert!((0.0..=1.0).contains(&mpm_confidence));
        let fused = fuse(
            PitchEstimate {
                confidence: yin_confidence,
                frequency: 110.0,
            },
            PitchEstimate {
                confidence: mpm_confidence,
                frequency: 110.4,
            },
        );
        let log_midpoint = (110.0_f32 * 110.4).sqrt();
        assert!(
            (fused.frequency - log_midpoint).abs() < 0.01,
            "fused {} must equal log-midpoint {}",
            fused.frequency,
            log_midpoint
        );
    }

    #[test]
    fn fusion_weight_ratio_is_clamped() {
        let (yin_weight, mpm_weight) = fusion_weights(
            &PitchEstimate {
                confidence: 0.70,
                frequency: 100.0,
            },
            &PitchEstimate {
                confidence: 1.0,
                frequency: 100.0,
            },
        );
        assert!(mpm_weight / yin_weight <= MAX_FUSION_WEIGHT_RATIO + f32::EPSILON);
        assert!(mpm_weight / yin_weight >= MIN_FUSION_WEIGHT_RATIO - f32::EPSILON);
    }

    #[test]
    fn fusion_weight_ratio_clamps_at_both_edges() {
        // Upper edge: YIN 0.70 vs MPM 1.0 → σ ratio 120.5/3.5 ≈ 34 → 2.0.
        let (yin_weight, mpm_weight) = fusion_weights(
            &PitchEstimate {
                confidence: 0.70,
                frequency: 100.0,
            },
            &PitchEstimate {
                confidence: 1.0,
                frequency: 100.0,
            },
        );
        assert!((mpm_weight / yin_weight - MAX_FUSION_WEIGHT_RATIO).abs() < f32::EPSILON);

        // Lower edge: YIN 1.0 vs MPM 0.85 → σ ratio 8.5/20.75 ≈ 0.41 → 0.5.
        // The round-10 probe never hit this edge on synthetic data, but the
        // clamp must still protect it (real signals can favor YIN).
        let (yin_weight, mpm_weight) = fusion_weights(
            &PitchEstimate {
                confidence: 1.0,
                frequency: 100.0,
            },
            &PitchEstimate {
                confidence: 0.85,
                frequency: 100.0,
            },
        );
        assert!((mpm_weight / yin_weight - MIN_FUSION_WEIGHT_RATIO).abs() < f32::EPSILON);
    }

    #[test]
    fn unclamped_calibration_ratio_stays_near_the_documented_bounds() {
        // Sanity guard for the round-10 decision to keep [0.5, 2.0]: over the
        // confidence range both detectors actually publish (>= 0.7), the raw
        // σ_yin/σ_mpm ratio spans roughly [0.22, 16.1] — the clamp trims only
        // the extreme tails and leaves the bulk of the calibration intact.
        let mut lowest = f32::INFINITY;
        let mut highest = 0.0_f32;
        for yin_confidence in [0.70, 0.80, 0.90, 0.95, 0.99, 1.0] {
            for mpm_confidence in [0.70, 0.80, 0.90, 0.95, 0.99, 1.0] {
                let ratio =
                    predicted_error_yin(yin_confidence) / predicted_error_mpm(mpm_confidence);
                lowest = lowest.min(ratio);
                highest = highest.max(ratio);
            }
        }
        assert!(
            lowest > 0.2 && highest < 17.0,
            "ratio span {lowest}..{highest}"
        );
    }

    #[test]
    fn disagreement_prefers_the_more_reliable_detector_over_the_higher_score() {
        // YIN holds the higher raw score, but its scale is inflated: MPM at
        // 0.97 is predicted ~1.45x more accurate than YIN at 0.99, so the
        // arbitration must publish MPM.
        let selection = select_pitch_candidate_with_reason(
            estimate(55.0, 0.99),
            estimate(82.4, 0.97),
            PitchGuidance::none(),
        );
        assert_eq!(
            selection.reason,
            CandidateSelectionReason::ConfidenceSecondary
        );
        let selected = selection.estimate.expect("reliable side published");
        assert!((selected.frequency - 82.4).abs() < 0.01);
    }

    #[test]
    fn disagreement_without_a_clear_reliability_margin_is_still_rejected() {
        // 0.85 (YIN) vs 0.80 (MPM): predicted errors 32.5 vs 26.5 — the ratio
        // stays below the 1.3 margin, so nothing may be published.
        let unresolved = select_pitch_candidate_with_reason(
            estimate(55.0, 0.85),
            estimate(82.4, 0.80),
            PitchGuidance::none(),
        );
        assert_eq!(
            unresolved.reason,
            CandidateSelectionReason::RejectedDisagreement
        );
        assert!(unresolved.estimate.is_none());
    }

    #[test]
    fn disagreement_can_still_resolve_for_yin_when_its_lead_is_decisive() {
        // YIN 1.0 vs MPM 0.90: predicted errors 8.5 vs 15.0 — YIN is both the
        // higher score and the predicted-more-accurate side here.
        let selection = select_pitch_candidate_with_reason(
            estimate(82.4, 1.0),
            estimate(55.0, 0.90),
            PitchGuidance::none(),
        );
        assert_eq!(selection.reason, CandidateSelectionReason::ConfidenceYin);
        assert!(selection.estimate.is_some());
    }
}
