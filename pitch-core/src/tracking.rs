use crate::{get_cents, Note, PitchEstimate};

const ACQUIRE_CONFIRM_FRAMES: u8 = 2;
const ACQUIRE_TOLERANCE_CENTS: f32 = 45.0;
const INLIER_TOLERANCE_CENTS: f32 = 85.0;
const CHANGE_CONFIRM_FRAMES: u8 = 3;
const OCTAVE_CHANGE_CONFIRM_FRAMES: u8 = 7;
const PENDING_TOLERANCE_CENTS: f32 = 55.0;
const MAX_UNSTABLE_FRAMES: u8 = 7;
const OCTAVE_TOLERANCE_CENTS: f32 = 100.0;
const PRIOR_MAX_DISTANCE_CENTS: f32 = 80.0;
const PRIOR_MIN_DIRECT_DISTANCE_CENTS: f32 = 120.0;
const PRIOR_MIN_IMPROVEMENT_CENTS: f32 = 50.0;
const HISTORY_CAPACITY: usize = 3;

#[derive(Clone, Debug, Default, PartialEq)]
pub(crate) struct PitchPrior {
    selected_frequency: Option<f32>,
    target_frequencies: Vec<f32>,
}

impl PitchPrior {
    pub(crate) fn new(selected: Option<&Note>, targets: &[Note]) -> Self {
        let selected_frequency = selected
            .map(|note| note.frequency)
            .filter(|frequency| valid_frequency(*frequency));
        let mut target_frequencies = targets
            .iter()
            .map(|note| note.frequency)
            .filter(|frequency| valid_frequency(*frequency))
            .collect::<Vec<_>>();
        target_frequencies.sort_by(f32::total_cmp);
        target_frequencies.dedup_by(|left, right| (*left - *right).abs() < 0.01);
        Self {
            selected_frequency,
            target_frequencies,
        }
    }

    pub(crate) fn is_empty(&self) -> bool {
        self.selected_frequency.is_none() && self.target_frequencies.is_empty()
    }

    pub(crate) fn direct_distance_cents(&self, frequency: f32) -> Option<f32> {
        self.nearest_distance_cents(frequency)
    }

    pub(crate) fn correct_octave(&self, frequency: f32) -> f32 {
        if !valid_frequency(frequency) || self.is_empty() {
            return frequency;
        }

        let direct_distance = self
            .nearest_distance_cents(frequency)
            .unwrap_or(f32::INFINITY);
        let mut best_frequency = frequency;
        let mut best_distance = direct_distance;
        // A dominant second harmonic can make a detector report 2f. Folding
        // downward toward a known string is useful and conservative. Never
        // fold upward from f/2 solely because a target exists: that would
        // hide a genuinely low note (and can turn mains hum into a string).
        for factor in [0.5_f32] {
            let candidate = frequency * factor;
            let Some(distance) = self.nearest_distance_cents(candidate) else {
                continue;
            };
            if distance < best_distance {
                best_distance = distance;
                best_frequency = candidate;
            }
        }

        if best_frequency != frequency
            && best_distance <= PRIOR_MAX_DISTANCE_CENTS
            && direct_distance >= PRIOR_MIN_DIRECT_DISTANCE_CENTS
            && direct_distance - best_distance >= PRIOR_MIN_IMPROVEMENT_CENTS
        {
            best_frequency
        } else {
            frequency
        }
    }

    fn nearest_distance_cents(&self, frequency: f32) -> Option<f32> {
        if !valid_frequency(frequency) {
            return None;
        }
        if let Some(selected) = self.selected_frequency {
            return Some(get_cents(frequency, selected).abs());
        }
        self.target_frequencies
            .iter()
            .map(|target| get_cents(frequency, *target).abs())
            .min_by(f32::total_cmp)
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) struct TrackedPitch {
    pub(crate) confidence: f32,
    pub(crate) frequency: f32,
}

/// Converts independent frame estimates into one stable pitch track.
///
/// Frequencies are filtered in log2 space, where equal musical intervals
/// have equal distance. A new track needs two agreeing frames, isolated
/// outliers hold the settled value, and a genuine note change is published
/// as a jump only after consecutive confirmation. This prevents the old EMA
/// failure mode where a noise estimate at 55 Hz was blended through 67/74 Hz
/// into the real low E at 82 Hz.
pub(crate) struct PitchTracker {
    stable_log2: Option<f32>,
    stable_confidence: f32,
    pending_log2: Option<f32>,
    pending_confidence: f32,
    pending_streak: u8,
    unstable_streak: u8,
    history: [f32; HISTORY_CAPACITY],
    history_cursor: usize,
    history_length: usize,
}

impl Default for PitchTracker {
    fn default() -> Self {
        Self::new()
    }
}

impl PitchTracker {
    pub(crate) fn new() -> Self {
        Self {
            stable_log2: None,
            stable_confidence: 0.0,
            pending_log2: None,
            pending_confidence: 0.0,
            pending_streak: 0,
            unstable_streak: 0,
            history: [0.0; HISTORY_CAPACITY],
            history_cursor: 0,
            history_length: 0,
        }
    }

    pub(crate) fn update(
        &mut self,
        estimate: PitchEstimate,
        prior: &PitchPrior,
    ) -> Option<TrackedPitch> {
        let frequency = prior.correct_octave(estimate.frequency);
        if !valid_frequency(frequency) || !estimate.confidence.is_finite() {
            return self.current();
        }
        let candidate_log2 = frequency.log2();

        let Some(stable_log2) = self.stable_log2 else {
            return self.acquire(candidate_log2, estimate.confidence);
        };

        let distance = cents_between_logs(candidate_log2, stable_log2).abs();
        if distance <= INLIER_TOLERANCE_CENTS {
            self.clear_pending();
            self.unstable_streak = 0;
            self.push_history(candidate_log2);
            let median = self.history_median();
            let residual = cents_between_logs(median, stable_log2).abs();
            let alpha = if residual < 12.0 {
                0.20
            } else if residual < 35.0 {
                0.35
            } else {
                0.55
            };
            self.stable_log2 = Some(stable_log2 + alpha * (median - stable_log2));
            self.stable_confidence = 0.25 * estimate.confidence + 0.75 * self.stable_confidence;
            return self.current();
        }

        self.unstable_streak = self.unstable_streak.saturating_add(1);
        self.update_pending(candidate_log2, estimate.confidence, PENDING_TOLERANCE_CENTS);
        let required = if looks_like_octave_change(candidate_log2, stable_log2) {
            OCTAVE_CHANGE_CONFIRM_FRAMES
        } else {
            CHANGE_CONFIRM_FRAMES
        };
        if self.pending_streak >= required {
            self.commit_pending();
            return self.current();
        }

        if self.unstable_streak >= MAX_UNSTABLE_FRAMES {
            let pending_log2 = self.pending_log2;
            let pending_confidence = self.pending_confidence;
            let pending_streak = self.pending_streak;
            self.reset();
            self.pending_log2 = pending_log2;
            self.pending_confidence = pending_confidence;
            self.pending_streak = pending_streak.min(ACQUIRE_CONFIRM_FRAMES - 1);
            return None;
        }

        self.current()
    }

    pub(crate) fn current(&self) -> Option<TrackedPitch> {
        self.stable_log2.map(|frequency| TrackedPitch {
            confidence: self.stable_confidence.clamp(0.0, 1.0),
            frequency: frequency.exp2(),
        })
    }

    pub(crate) fn reset(&mut self) {
        self.stable_log2 = None;
        self.stable_confidence = 0.0;
        self.clear_pending();
        self.unstable_streak = 0;
        self.history_cursor = 0;
        self.history_length = 0;
    }

    fn acquire(&mut self, candidate_log2: f32, confidence: f32) -> Option<TrackedPitch> {
        self.update_pending(candidate_log2, confidence, ACQUIRE_TOLERANCE_CENTS);
        if self.pending_streak < ACQUIRE_CONFIRM_FRAMES {
            return None;
        }
        self.commit_pending();
        self.current()
    }

    fn update_pending(&mut self, candidate_log2: f32, confidence: f32, tolerance_cents: f32) {
        let agrees = self.pending_log2.is_some_and(|pending| {
            cents_between_logs(candidate_log2, pending).abs() <= tolerance_cents
        });
        if agrees {
            let weight = 1.0 / (self.pending_streak as f32 + 1.0);
            self.pending_log2 = self
                .pending_log2
                .map(|pending| pending + weight * (candidate_log2 - pending));
            self.pending_confidence += weight * (confidence - self.pending_confidence);
            self.pending_streak = self.pending_streak.saturating_add(1);
        } else {
            self.pending_log2 = Some(candidate_log2);
            self.pending_confidence = confidence;
            self.pending_streak = 1;
        }
    }

    fn commit_pending(&mut self) {
        let Some(value) = self.pending_log2 else {
            return;
        };
        self.stable_log2 = Some(value);
        self.stable_confidence = self.pending_confidence;
        self.history_cursor = 0;
        self.history_length = 0;
        self.push_history(value);
        self.clear_pending();
        self.unstable_streak = 0;
    }

    fn clear_pending(&mut self) {
        self.pending_log2 = None;
        self.pending_confidence = 0.0;
        self.pending_streak = 0;
    }

    fn push_history(&mut self, value: f32) {
        self.history[self.history_cursor] = value;
        self.history_cursor = (self.history_cursor + 1) % HISTORY_CAPACITY;
        self.history_length = (self.history_length + 1).min(HISTORY_CAPACITY);
    }

    fn history_median(&self) -> f32 {
        let mut values = self.history;
        values[..self.history_length].sort_by(f32::total_cmp);
        values[self.history_length / 2]
    }
}

fn cents_between_logs(left: f32, right: f32) -> f32 {
    1_200.0 * (left - right)
}

fn looks_like_octave_change(candidate: f32, stable: f32) -> bool {
    let distance = cents_between_logs(candidate, stable).abs();
    distance >= 900.0
        && (distance - (distance / 1_200.0).round() * 1_200.0).abs() <= OCTAVE_TOLERANCE_CENTS
}

fn valid_frequency(frequency: f32) -> bool {
    frequency.is_finite() && frequency > 0.0
}

#[cfg(test)]
mod tests {
    use super::*;

    fn estimate(frequency: f32) -> PitchEstimate {
        PitchEstimate {
            confidence: 0.9,
            frequency,
        }
    }

    fn note(name: &'static str, octave: i32, frequency: f32) -> Note {
        Note {
            name,
            octave,
            frequency,
        }
    }

    #[test]
    fn acquisition_requires_two_consistent_frames() {
        let mut tracker = PitchTracker::new();
        assert!(tracker
            .update(estimate(67.0), &PitchPrior::default())
            .is_none());
        assert!(tracker
            .update(estimate(74.0), &PitchPrior::default())
            .is_none());
        assert!(tracker
            .update(estimate(82.4), &PitchPrior::default())
            .is_none());
        let acquired = tracker
            .update(estimate(82.5), &PitchPrior::default())
            .expect("confirmed pitch");
        assert!((acquired.frequency - 82.45).abs() < 0.2);
    }

    #[test]
    fn isolated_outlier_never_enters_the_filter() {
        let mut tracker = PitchTracker::new();
        tracker.update(estimate(110.0), &PitchPrior::default());
        tracker.update(estimate(110.1), &PitchPrior::default());
        let held = tracker
            .update(estimate(67.0), &PitchPrior::default())
            .expect("settled pitch is held");
        assert!((held.frequency - 110.05).abs() < 0.5);
        let recovered = tracker
            .update(estimate(110.2), &PitchPrior::default())
            .expect("settled pitch");
        assert!((recovered.frequency - 110.1).abs() < 0.5);
    }

    #[test]
    fn genuine_note_change_jumps_without_blending() {
        let mut tracker = PitchTracker::new();
        tracker.update(estimate(110.0), &PitchPrior::default());
        tracker.update(estimate(110.0), &PitchPrior::default());
        assert!(
            (tracker
                .update(estimate(146.8), &PitchPrior::default())
                .unwrap()
                .frequency
                - 110.0)
                .abs()
                < 0.5
        );
        assert!(
            (tracker
                .update(estimate(146.9), &PitchPrior::default())
                .unwrap()
                .frequency
                - 110.0)
                .abs()
                < 0.5
        );
        let changed = tracker
            .update(estimate(146.85), &PitchPrior::default())
            .expect("confirmed change");
        assert!((changed.frequency - 146.85).abs() < 0.5);
    }

    #[test]
    fn tuning_prior_corrects_a_second_harmonic_but_not_a_nearby_pitch() {
        let e2 = note("E", 2, 82.4069);
        let a2 = note("A", 2, 110.0);
        let d3 = note("D", 3, 146.8324);
        let prior = PitchPrior::new(None, &[e2, a2, d3]);
        assert!((prior.correct_octave(164.9) - 82.45).abs() < 0.2);
        assert!((prior.correct_octave(160.0) - 80.0).abs() < 0.01);
        assert!((prior.correct_octave(111.0) - 111.0).abs() < 0.01);
    }
}
