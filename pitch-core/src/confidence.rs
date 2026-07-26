use crate::{PipelineCandidate, PipelineConfidenceTelemetry, PipelineDecision};

const HISTORY_CAPACITY: usize = 5;
const MAX_UNCERTAINTY_CENTS: f32 = 100.0;

/// Builds a user-facing confidence score from independent evidence without
/// changing detector acceptance thresholds. Consecutive realtime windows
/// overlap heavily, so their raw-frequency dispersion is a cheap window-jitter
/// probe that does not run the expensive pitch detectors additional times.
pub(crate) struct ConfidenceEstimator {
    history: [f32; HISTORY_CAPACITY],
    history_cursor: usize,
    history_length: usize,
    last: PipelineConfidenceTelemetry,
}

impl Default for ConfidenceEstimator {
    fn default() -> Self {
        Self {
            history: [0.0; HISTORY_CAPACITY],
            history_cursor: 0,
            history_length: 0,
            last: PipelineConfidenceTelemetry::default(),
        }
    }
}

pub(crate) struct ConfidenceObservation {
    pub(crate) decision: PipelineDecision,
    pub(crate) noise_floor: f32,
    pub(crate) output_confidence: f32,
    pub(crate) raw_frequency: Option<f32>,
    pub(crate) rms: f32,
    pub(crate) secondary: Option<PipelineCandidate>,
    pub(crate) yin: Option<PipelineCandidate>,
}

impl ConfidenceEstimator {
    pub(crate) fn observe(
        &mut self,
        observation: ConfidenceObservation,
    ) -> PipelineConfidenceTelemetry {
        if observation.decision == PipelineDecision::Held {
            let mut held = self.last;
            held.calibrated = (held.calibrated * 0.94).clamp(0.0, 1.0);
            held.stability = (held.stability * 0.92).clamp(0.0, 1.0);
            held.uncertainty_cents =
                (held.uncertainty_cents + 4.0).clamp(2.0, MAX_UNCERTAINTY_CENTS);
            self.last = held;
            return held;
        }

        // Rejected, pending, and acquiring frames must not present fresh
        // evidence: the raw detector output behind them was not published
        // (octave-pending frequencies are suspected wrong outright), so
        // seeding the jitter history with it would let the panel show a
        // confident readout that contradicts the frame's own decision.
        if observation.decision != PipelineDecision::Published {
            self.reset();
            return self.last;
        }

        let Some(frequency) = observation
            .raw_frequency
            .filter(|value| valid_frequency(*value))
        else {
            self.reset();
            return self.last;
        };

        self.push_frequency(frequency);
        let temporal_spread = self.temporal_spread_cents();
        let stability = if self.history_length == 1 {
            0.72
        } else {
            (1.0 - temporal_spread / 45.0).clamp(0.0, 1.0)
        };
        let (agreement, detector_spread) =
            detector_agreement(observation.yin, observation.secondary);
        let periodicity = observation
            .output_confidence
            .max(observation.yin.map_or(0.0, |value| value.confidence))
            .max(observation.secondary.map_or(0.0, |value| value.confidence))
            .clamp(0.0, 1.0);
        let signal = signal_evidence(observation.rms, observation.noise_floor);
        let calibrated = (0.45 * periodicity + 0.20 * agreement + 0.20 * stability + 0.15 * signal)
            .clamp(0.0, 1.0);
        let uncertainty_cents =
            (2.0 + detector_spread * 0.5 + temporal_spread + (1.0 - calibrated) * 18.0)
                .clamp(2.0, MAX_UNCERTAINTY_CENTS);

        let evidence = PipelineConfidenceTelemetry {
            agreement,
            calibrated,
            periodicity,
            signal,
            stability,
            uncertainty_cents,
        };
        self.last = evidence;
        evidence
    }

    pub(crate) fn reset(&mut self) {
        self.history_cursor = 0;
        self.history_length = 0;
        self.last = PipelineConfidenceTelemetry::default();
    }

    /// Samples currently held by the fixed-capacity raw-frequency history.
    /// Soak tests assert this stays bounded over long runs.
    pub(crate) fn history_len(&self) -> usize {
        self.history_length
    }

    fn push_frequency(&mut self, frequency: f32) {
        self.history[self.history_cursor] = frequency.log2();
        self.history_cursor = (self.history_cursor + 1) % HISTORY_CAPACITY;
        self.history_length = (self.history_length + 1).min(HISTORY_CAPACITY);
    }

    fn temporal_spread_cents(&self) -> f32 {
        if self.history_length < 2 {
            return 0.0;
        }
        let mut values = self.history;
        values[..self.history_length].sort_by(f32::total_cmp);
        let median = values[self.history_length / 2];
        let mut deviations = [0.0; HISTORY_CAPACITY];
        for (output, value) in deviations
            .iter_mut()
            .zip(values[..self.history_length].iter())
        {
            *output = 1_200.0 * (*value - median).abs();
        }
        deviations[..self.history_length].sort_by(f32::total_cmp);
        deviations[self.history_length / 2]
    }
}

fn detector_agreement(
    yin: Option<PipelineCandidate>,
    secondary: Option<PipelineCandidate>,
) -> (f32, f32) {
    match (yin, secondary) {
        (Some(left), Some(right))
            if valid_frequency(left.frequency) && valid_frequency(right.frequency) =>
        {
            let spread = (1_200.0 * (left.frequency / right.frequency).log2()).abs();
            (
                (1.0 - spread / 70.0).clamp(0.0, 1.0),
                spread.min(MAX_UNCERTAINTY_CENTS),
            )
        }
        (Some(_), None) | (None, Some(_)) => (0.68, 10.0),
        _ => (0.0, MAX_UNCERTAINTY_CENTS),
    }
}

fn signal_evidence(rms: f32, noise_floor: f32) -> f32 {
    if !rms.is_finite() || rms <= 0.0 || !noise_floor.is_finite() || noise_floor <= 0.0 {
        return 0.0;
    }
    ((rms / noise_floor - 1.0) / 3.0).clamp(0.0, 1.0)
}

fn valid_frequency(value: f32) -> bool {
    value.is_finite() && value > 0.0
}

#[cfg(test)]
mod tests {
    use super::*;

    fn candidate(frequency: f32, confidence: f32) -> Option<PipelineCandidate> {
        Some(PipelineCandidate {
            confidence,
            frequency,
        })
    }

    fn observation(frequency: f32) -> ConfidenceObservation {
        ConfidenceObservation {
            decision: PipelineDecision::Published,
            noise_floor: 0.003,
            output_confidence: 0.92,
            raw_frequency: Some(frequency),
            rms: 0.05,
            secondary: candidate(frequency + 0.02, 0.90),
            yin: candidate(frequency - 0.02, 0.94),
        }
    }

    #[test]
    fn coherent_overlapping_windows_gain_stability() {
        let mut estimator = ConfidenceEstimator::default();
        let first = estimator.observe(observation(82.40));
        let second = estimator.observe(observation(82.41));
        let third = estimator.observe(observation(82.40));

        assert!(first.calibrated > 0.8);
        assert!(third.stability > first.stability);
        assert!(third.uncertainty_cents < first.uncertainty_cents);
        assert!(second.agreement > 0.9);
    }

    #[test]
    fn unstable_windows_and_detector_conflict_lower_confidence() {
        let mut estimator = ConfidenceEstimator::default();
        estimator.observe(observation(82.4));
        estimator.observe(observation(82.5));
        estimator.observe(observation(90.0));
        estimator.observe(observation(74.0));
        let mut conflicted = observation(96.0);
        conflicted.secondary = candidate(110.0, 0.91);
        let evidence = estimator.observe(conflicted);

        assert!(evidence.agreement < 0.1);
        assert!(evidence.stability < 0.5);
        assert!(evidence.uncertainty_cents > 40.0);
    }

    #[test]
    fn held_frames_decay_instead_of_claiming_fresh_evidence() {
        let mut estimator = ConfidenceEstimator::default();
        let published = estimator.observe(observation(220.0));
        let mut held_observation = observation(220.0);
        held_observation.decision = PipelineDecision::Held;
        held_observation.raw_frequency = None;
        let held = estimator.observe(held_observation);

        assert!(held.calibrated < published.calibrated);
        assert!(held.uncertainty_cents > published.uncertainty_cents);
    }

    #[test]
    fn rejected_frames_do_not_claim_fresh_evidence() {
        let mut estimator = ConfidenceEstimator::default();
        estimator.observe(observation(82.4));
        let mut rejected = observation(82.4);
        rejected.decision = PipelineDecision::AdaptiveGateRejected;
        let evidence = estimator.observe(rejected);

        assert_eq!(evidence, PipelineConfidenceTelemetry::default());
        let reacquired = estimator.observe(observation(82.4));
        assert!((reacquired.stability - 0.72).abs() < f32::EPSILON);
    }

    #[test]
    fn octave_pending_frequency_does_not_seed_history() {
        let mut estimator = ConfidenceEstimator::default();
        let mut pending = observation(164.8);
        pending.decision = PipelineDecision::OctavePending;
        let evidence = estimator.observe(pending);

        assert_eq!(evidence.calibrated, 0.0);
        let published = estimator.observe(observation(82.4));
        assert!((published.stability - 0.72).abs() < f32::EPSILON);
    }

    #[test]
    fn a_real_gap_resets_window_history() {
        let mut estimator = ConfidenceEstimator::default();
        estimator.observe(observation(82.4));
        estimator.observe(observation(110.0));
        let mut gap = observation(110.0);
        gap.decision = PipelineDecision::NoCandidate;
        gap.raw_frequency = None;
        estimator.observe(gap);

        let reacquired = estimator.observe(observation(146.8));
        assert!((reacquired.stability - 0.72).abs() < f32::EPSILON);
    }
}
