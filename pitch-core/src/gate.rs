use crate::{signal::SignalStats, tracking::PitchPrior, PitchEstimate};

// Canonical adaptive-gate constants. These are the single source of truth:
// the WASM export in `wasm.rs` and the web fallback mirror
// (web/src/generated/gateThresholds.ts via scripts/generate-gate-thresholds.mjs)
// both derive from them.
pub(crate) const CALIBRATION_FRAMES: u8 = 4;
pub(crate) const CLOSE_CONFIRM_FRAMES: u8 = 3;
pub(crate) const OPEN_NOISE_RATIO: f32 = 1.8;
pub(crate) const CLOSE_NOISE_RATIO: f32 = 1.25;
pub(crate) const OPEN_BASE_RMS_FACTOR: f32 = 1.2;
pub(crate) const CLOSE_BASE_RMS_FACTOR: f32 = 0.9;
pub(crate) const CLOSE_PEAK_FACTOR: f32 = 0.75;
pub(crate) const STRONG_ATTACK_RMS: f32 = 0.012;
pub(crate) const STRONG_ATTACK_PEAK: f32 = 0.03;
pub(crate) const ONSET_RATIO: f32 = 1.6;
pub(crate) const ONSET_RMS_DELTA: f32 = 0.002;
pub(crate) const UNIVERSAL_CONFIDENCE: f32 = 0.90;
pub(crate) const TARGET_CONFIDENCE: f32 = 0.72;
pub(crate) const TARGET_DISTANCE_CENTS: f32 = 90.0;
pub(crate) const NOISE_FLOOR_DECAY: f32 = 0.85;
pub(crate) const NOISE_FLOOR_UPDATE_WEIGHT: f32 = 0.15;
pub(crate) const NOISE_FLOOR_CAP_FACTOR: f32 = 3.0;

/// Learns the local noise floor while idle and opens only for a plausible
/// pitched signal. The detector's fixed floor protects its math; this gate
/// protects the user-visible state from room hum that still looks periodic.
pub(crate) struct AdaptiveSignalGate {
    base_peak: f32,
    base_rms: f32,
    below_streak: u8,
    calibrated_frames: u8,
    noise_floor: f32,
    open: bool,
    previous_rms: f32,
}

impl AdaptiveSignalGate {
    pub(crate) fn new(base_rms: f32, base_peak: f32) -> Self {
        Self {
            base_peak,
            base_rms,
            below_streak: 0,
            calibrated_frames: 0,
            noise_floor: base_rms,
            open: false,
            previous_rms: 0.0,
        }
    }

    pub(crate) fn observe(
        &mut self,
        stats: SignalStats,
        estimate: Option<PitchEstimate>,
        prior: &PitchPrior,
    ) -> bool {
        let onset = self.previous_rms > 0.0
            && stats.rms >= self.base_rms
            && stats.rms - self.previous_rms >= ONSET_RMS_DELTA
            && stats.rms >= self.previous_rms * ONSET_RATIO;
        self.previous_rms = stats.rms;

        if self.open {
            let close_threshold =
                (self.noise_floor * CLOSE_NOISE_RATIO).max(self.base_rms * CLOSE_BASE_RMS_FACTOR);
            if stats.rms < close_threshold || stats.peak < self.base_peak * CLOSE_PEAK_FACTOR {
                self.below_streak = self.below_streak.saturating_add(1);
                if self.below_streak >= CLOSE_CONFIRM_FRAMES {
                    self.open = false;
                    self.below_streak = 0;
                }
            } else {
                self.below_streak = 0;
            }
            return self.open;
        }

        let strong_attack = stats.rms >= STRONG_ATTACK_RMS && stats.peak >= STRONG_ATTACK_PEAK;
        let has_detector_energy = stats.rms >= self.base_rms && stats.peak >= self.base_peak;
        let trusted_estimate = estimate.is_some_and(|estimate| {
            estimate.confidence >= UNIVERSAL_CONFIDENCE
                || (estimate.confidence >= TARGET_CONFIDENCE
                    && prior
                        .direct_distance_cents(estimate.frequency)
                        .is_some_and(|distance| distance <= TARGET_DISTANCE_CENTS))
        });
        let attack_open = estimate.is_some() && (strong_attack || onset);
        let dynamic_open =
            (self.noise_floor * OPEN_NOISE_RATIO).max(self.base_rms * OPEN_BASE_RMS_FACTOR);
        let quality_open = has_detector_energy && stats.rms >= dynamic_open && trusted_estimate;

        if attack_open || quality_open {
            self.open = true;
            self.below_streak = 0;
            return true;
        }

        if self.calibrated_frames < CALIBRATION_FRAMES {
            self.calibrated_frames += 1;
            self.update_noise_floor(stats.rms);
            return false;
        }

        if !strong_attack && !trusted_estimate {
            self.update_noise_floor(stats.rms);
        }
        false
    }

    pub(crate) fn reset(&mut self) {
        self.below_streak = 0;
        self.calibrated_frames = 0;
        self.noise_floor = self.base_rms;
        self.open = false;
        self.previous_rms = 0.0;
    }

    pub(crate) fn noise_floor(&self) -> f32 {
        self.noise_floor
    }

    pub(crate) fn threshold(&self) -> f32 {
        if self.open {
            (self.noise_floor * CLOSE_NOISE_RATIO).max(self.base_rms * CLOSE_BASE_RMS_FACTOR)
        } else {
            (self.noise_floor * OPEN_NOISE_RATIO).max(self.base_rms * OPEN_BASE_RMS_FACTOR)
        }
    }

    fn update_noise_floor(&mut self, rms: f32) {
        if !rms.is_finite() || rms < 0.0 {
            return;
        }
        let bounded = rms.min((self.noise_floor * NOISE_FLOOR_CAP_FACTOR).max(self.base_rms));
        self.noise_floor =
            NOISE_FLOOR_DECAY * self.noise_floor + NOISE_FLOOR_UPDATE_WEIGHT * bounded;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Note;

    fn stats(rms: f32) -> SignalStats {
        SignalStats {
            peak: rms * 4.0,
            rms,
        }
    }

    fn estimate(frequency: f32, confidence: f32) -> Option<PitchEstimate> {
        Some(PitchEstimate {
            confidence,
            frequency,
        })
    }

    #[test]
    fn periodic_room_noise_does_not_open_the_gate() {
        let e2 = Note {
            name: "E",
            octave: 2,
            frequency: 82.4069,
        };
        let prior = PitchPrior::new(None, &[e2]);
        let mut gate = AdaptiveSignalGate::new(0.0025, 0.012);
        for _ in 0..12 {
            assert!(!gate.observe(stats(0.004), estimate(55.0, 0.78), &prior));
        }
    }

    #[test]
    fn a_pluck_opens_immediately_after_noise_calibration() {
        let prior = PitchPrior::default();
        let mut gate = AdaptiveSignalGate::new(0.0025, 0.012);
        for _ in 0..4 {
            gate.observe(stats(0.003), None, &prior);
        }
        assert!(gate.observe(stats(0.02), estimate(82.4, 0.8), &prior));
    }

    #[test]
    fn a_clean_soft_note_is_not_learned_as_startup_noise() {
        let prior = PitchPrior::default();
        let mut gate = AdaptiveSignalGate::new(0.0025, 0.012);
        assert!(gate.observe(stats(0.006), estimate(220.0, 0.95), &prior));
    }
}
