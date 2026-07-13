//! Spectral cross-check for octave errors in time-domain pitch estimates.
//!
//! YIN/MPM occasionally lock onto a harmonic (2x) or subharmonic (0.5x) of
//! the note actually being played. The time-domain estimate itself cannot
//! tell those apart, but the spectrum can: a true fundamental at `f` puts
//! energy on the odd multiples of `f` (f, 3f, 5f), while an octave-up error
//! leaves the odd multiples of the reported pitch empty and an octave-down
//! error leaves real energy below the reported pitch. This module probes a
//! handful of those frequencies directly (Goertzel on the Hann-windowed
//! frame, no full FFT needed) and folds the estimate when the spectral
//! evidence contradicts it.

use super::spectral::{apply_hann_window, goertzel_power};

/// Power at the sub-octave's odd multiples (0.5f, 1.5f, 2.5f) must exceed
/// this fraction of the power at the estimate's own harmonics (f, 2f, 3f)
/// before a fold down to f/2 engages. True fundamentals put no energy at
/// those in-between frequencies, so anything past window leakage (Hann
/// sidelobes are below -31 dB, i.e. under 0.001 in power) is a real
/// subharmonic series; 0.3 leaves a wide safety margin.
const FOLD_DOWN_ENTER_RATIO: f32 = 0.3;

/// Once a fold down is active it stays active until the sub-octave
/// evidence drops below this weaker ratio. The gap between enter and exit
/// keeps borderline frames from toggling the fold on and off, which would
/// slam the readout across a whole octave every few frames.
const FOLD_DOWN_EXIT_RATIO: f32 = 0.15;

/// Power at the estimate's odd multiples (f, 3f, 5f) must fall below this
/// fraction of the power at its even multiples (2f, 4f, 6f) before a fold
/// up to 2f engages. This must stay near the spectral leakage floor: guitar
/// microphones routinely make the second harmonic much louder than the
/// fundamental, while YIN still correctly sees the longer period. Only an
/// effectively absent odd series is evidence that the estimate is truly a
/// subharmonic lock.
const FOLD_UP_ENTER_RATIO: f32 = 0.02;

/// An active fold up disengages once odd-harmonic evidence recovers past
/// this ratio (see [`FOLD_DOWN_EXIT_RATIO`] for why enter/exit differ).
const FOLD_UP_EXIT_RATIO: f32 = 0.05;

/// A fold engages only after its evidence holds for this many consecutive
/// frames, so one borderline frame cannot yank the readout an octave.
/// Disengaging is immediate (the enter/exit ratio gap provides the
/// hysteresis on that side).
const FOLD_CONFIRM_FRAMES: u8 = 2;

/// Probes per parity group. Three odd and three even multiples are enough
/// to separate the octave hypotheses without probing into the noise floor.
const PROBES_PER_GROUP: usize = 3;

/// Skip probe frequencies above this fraction of the sample rate; Goertzel
/// responses degrade approaching Nyquist.
const MAX_PROBE_NYQUIST_FRACTION: f32 = 0.45;

#[derive(Clone, Copy, Debug, PartialEq)]
enum FoldDirection {
    None,
    Down,
    Up,
}

/// Cross-checks a time-domain pitch estimate against the frame's actual
/// spectral content and folds octave errors (2x / 0.5x locks) back to the
/// supported octave. Stateful: a fold needs consecutive-frame confirmation
/// to engage and weaker evidence to disengage, so borderline frames cannot
/// flip the decision back and forth. Owns a scratch buffer so per-frame
/// use does not allocate after warm-up.
pub struct OctaveDisambiguator {
    windowed: Vec<f32>,
    active: FoldDirection,
    pending: FoldDirection,
    pending_streak: u8,
    correction_started: bool,
}

impl Default for OctaveDisambiguator {
    fn default() -> Self {
        Self::new()
    }
}

impl OctaveDisambiguator {
    pub fn new() -> Self {
        Self {
            windowed: Vec::new(),
            active: FoldDirection::None,
            pending: FoldDirection::None,
            pending_streak: 0,
            correction_started: false,
        }
    }

    /// Clears the fold state. Call when the signal drops (gate closed) so a
    /// fold engaged on the previous note cannot carry over to the next one.
    pub fn reset(&mut self) {
        self.active = FoldDirection::None;
        self.pending = FoldDirection::None;
        self.pending_streak = 0;
        self.correction_started = false;
    }

    /// A pending fold has spectral evidence, but has not yet survived enough
    /// consecutive frames to be safe to publish as pitch.
    pub(crate) fn has_unconfirmed_correction(&self) -> bool {
        self.pending != FoldDirection::None
    }

    /// Reports a newly engaged fold once. The engine uses this boundary to
    /// discard smoothing history that was seeded by the wrong octave.
    pub(crate) fn take_correction_started(&mut self) -> bool {
        std::mem::take(&mut self.correction_started)
    }

    /// Returns `frequency` unchanged when the spectrum supports it, `frequency / 2`
    /// when the frame carries a subharmonic series the estimate skipped, or
    /// `frequency * 2` when the estimate's own odd harmonics are absent.
    /// Folded results are only produced inside `[min_frequency, max_frequency]`.
    ///
    /// `buffer` is expected to be DC-centered (the detectors already center
    /// their input before estimating).
    pub fn resolve(
        &mut self,
        buffer: &[f32],
        sample_rate: f32,
        frequency: f32,
        min_frequency: f32,
        max_frequency: f32,
    ) -> f32 {
        self.correction_started = false;
        if buffer.len() < 64
            || !sample_rate.is_finite()
            || sample_rate <= 0.0
            || !frequency.is_finite()
            || frequency <= 0.0
        {
            return frequency;
        }
        apply_hann_window(buffer, &mut self.windowed);

        let desired = self.desired_fold(sample_rate, frequency, min_frequency, max_frequency);
        let previous_active = self.active;

        if desired == self.active {
            self.pending = FoldDirection::None;
            self.pending_streak = 0;
        } else if desired == FoldDirection::None {
            // Disengage immediately: the enter/exit ratio gap already keeps
            // borderline frames from getting here.
            self.active = FoldDirection::None;
            self.pending = FoldDirection::None;
            self.pending_streak = 0;
        } else {
            if self.pending == desired {
                self.pending_streak = self.pending_streak.saturating_add(1);
            } else {
                self.pending = desired;
                self.pending_streak = 1;
            }
            if self.pending_streak >= FOLD_CONFIRM_FRAMES {
                self.active = desired;
                self.pending = FoldDirection::None;
                self.pending_streak = 0;
            }
        }

        self.correction_started =
            self.active != FoldDirection::None && self.active != previous_active;

        match self.active {
            FoldDirection::Down => frequency * 0.5,
            FoldDirection::Up => frequency * 2.0,
            FoldDirection::None => frequency,
        }
    }

    /// What the current frame's spectral evidence says the fold should be,
    /// with hysteresis: an active fold uses the weaker exit ratio, an
    /// inactive one the stricter enter ratio.
    fn desired_fold(
        &self,
        sample_rate: f32,
        frequency: f32,
        min_frequency: f32,
        max_frequency: f32,
    ) -> FoldDirection {
        if frequency * 0.5 >= min_frequency {
            let odd_of_half = self.parity_power(sample_rate, frequency * 0.5, 1);
            let base_harmonics = self.group_power(sample_rate, frequency, [1.0, 2.0, 3.0]);
            let ratio = if self.active == FoldDirection::Down {
                FOLD_DOWN_EXIT_RATIO
            } else {
                FOLD_DOWN_ENTER_RATIO
            };
            if odd_of_half > 0.0 && odd_of_half > ratio * base_harmonics {
                return FoldDirection::Down;
            }
        }

        if frequency * 2.0 <= max_frequency {
            let odd = self.parity_power(sample_rate, frequency, 1);
            let even = self.parity_power(sample_rate, frequency, 2);
            let ratio = if self.active == FoldDirection::Up {
                FOLD_UP_EXIT_RATIO
            } else {
                FOLD_UP_ENTER_RATIO
            };
            if even > 0.0 && odd < ratio * even {
                return FoldDirection::Up;
            }
        }

        FoldDirection::None
    }

    /// Sum of spectral power at `fundamental` times each multiplier, skipping
    /// probes too close to Nyquist.
    fn group_power(&self, sample_rate: f32, fundamental: f32, multipliers: [f32; 3]) -> f32 {
        let limit = sample_rate * MAX_PROBE_NYQUIST_FRACTION;
        multipliers
            .into_iter()
            .map(|multiplier| fundamental * multiplier)
            .filter(|probe| *probe > 0.0 && *probe < limit)
            .map(|probe| goertzel_power(&self.windowed, sample_rate, probe))
            .sum()
    }

    /// Power at `fundamental`'s odd (`start = 1`: f, 3f, 5f) or even
    /// (`start = 2`: 2f, 4f, 6f) multiples.
    fn parity_power(&self, sample_rate: f32, fundamental: f32, start: u32) -> f32 {
        let mut multipliers = [0.0_f32; PROBES_PER_GROUP];
        for (index, multiplier) in multipliers.iter_mut().enumerate() {
            *multiplier = (start + 2 * index as u32) as f32;
        }
        self.group_power(sample_rate, fundamental, multipliers)
    }
}
