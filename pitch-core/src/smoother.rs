const HISTORY_CAPACITY: usize = 5;

/// How close a new estimate must be to exactly 2x or 0.5x the current
/// reference before it is treated as a candidate octave error. Guitar
/// pitch bends/vibrato move the reading by a few percent at most, so this
/// stays well clear of anything but a genuine harmonic/subharmonic lock.
const OCTAVE_RATIO_TOLERANCE: f32 = 0.06;

/// Consecutive frames a "looks like an octave error" reading must persist
/// before it is accepted as a real note change instead of folded back.
/// At the ~33ms detection cadence this is roughly 100-130ms, fast enough
/// for a deliberate octave jump, long enough to reject single-frame flukes.
const OCTAVE_CONFLICT_STREAK_LIMIT: u8 = 3;

pub struct Smoother {
    alpha: f32,
    ema: Option<f32>,
    history: [f32; HISTORY_CAPACITY],
    history_cursor: usize,
    history_length: usize,
    octave_conflict_streak: u8,
}

impl Default for Smoother {
    fn default() -> Self {
        Self::new()
    }
}

impl Smoother {
    pub fn new() -> Self {
        Self {
            alpha: 0.4,
            ema: None,
            history: [0.0; HISTORY_CAPACITY],
            history_cursor: 0,
            history_length: 0,
            octave_conflict_streak: 0,
        }
    }

    pub fn add(&mut self, frequency: Option<f32>) -> Option<f32> {
        let Some(raw) = frequency.filter(|value| value.is_finite() && *value > 0.0) else {
            self.reset();
            return None;
        };
        let value = self.resolve_octave_conflict(raw);
        let smoothed = self
            .ema
            .map_or(value, |ema| self.alpha * value + (1.0 - self.alpha) * ema);
        self.ema = Some(smoothed);
        self.history[self.history_cursor] = smoothed;
        self.history_cursor = (self.history_cursor + 1) % HISTORY_CAPACITY;
        self.history_length = (self.history_length + 1).min(HISTORY_CAPACITY);

        if self.history_length == 0 {
            return self.ema;
        }
        let mut sorted = self.history;
        sorted[..self.history_length].sort_by(f32::total_cmp);
        let middle = self.history_length / 2;
        Some(if self.history_length % 2 == 1 {
            sorted[middle]
        } else {
            (sorted[middle - 1] + sorted[middle]) * 0.5
        })
    }

    /// De-jitters transient octave errors: if `raw` sits within tolerance of
    /// exactly double or half the current smoothed reference, fold it back
    /// to the reference's octave instead of letting it yank the readout.
    /// A run of `OCTAVE_CONFLICT_STREAK_LIMIT` consecutive folds in a row is
    /// treated as a genuine octave change and let through unfolded.
    fn resolve_octave_conflict(&mut self, raw: f32) -> f32 {
        let Some(reference) = self.ema else {
            self.octave_conflict_streak = 0;
            return raw;
        };
        let folded = match octave_fold(raw, reference) {
            Some(folded) => folded,
            None => {
                self.octave_conflict_streak = 0;
                return raw;
            }
        };
        if self.octave_conflict_streak >= OCTAVE_CONFLICT_STREAK_LIMIT {
            self.octave_conflict_streak = 0;
            raw
        } else {
            self.octave_conflict_streak += 1;
            folded
        }
    }

    pub fn reset(&mut self) {
        self.ema = None;
        self.history_cursor = 0;
        self.history_length = 0;
        self.octave_conflict_streak = 0;
    }
}

/// Returns `raw` folded to `reference`'s octave if `raw` is within
/// [`OCTAVE_RATIO_TOLERANCE`] of exactly 2x or 0.5x `reference`; `None` if
/// `raw` doesn't look like an octave error relative to `reference`.
fn octave_fold(raw: f32, reference: f32) -> Option<f32> {
    if reference <= 0.0 || raw <= 0.0 {
        return None;
    }
    let ratio = raw / reference;
    if (ratio - 2.0).abs() < 2.0 * OCTAVE_RATIO_TOLERANCE {
        Some(raw * 0.5)
    } else if (ratio - 0.5).abs() < 0.5 * OCTAVE_RATIO_TOLERANCE {
        Some(raw * 2.0)
    } else {
        None
    }
}
