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

use super::hps::{HpsGuard, HpsVerdict};
use super::spectral::{apply_hann_window, goertzel_power};
use crate::PipelineSpectralTelemetry;

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

/// Skip probe frequencies above this fraction of the sample rate; Goertzel
/// responses degrade approaching Nyquist.
const MAX_PROBE_NYQUIST_FRACTION: f32 = 0.45;
const DIAGNOSTIC_HARMONICS: usize = 5;
const OCTAVE_HARMONIC_PROBES: usize = 6;

#[derive(Clone, Copy, Debug, PartialEq)]
enum FoldDirection {
    None,
    Down,
    Up,
}

/// All spectral powers needed by both octave correction and diagnostics.
/// Keeping this as one frame snapshot avoids repeating Goertzel probes for
/// the UI after the realtime decision has already measured the same bins.
#[derive(Clone, Copy, Debug, Default)]
struct FrameSpectralPowers {
    /// Integer multiples f..6f of the reported estimate.
    harmonics: [f32; OCTAVE_HARMONIC_PROBES],
    /// Odd multiples of the sub-octave: 0.5f, 1.5f and 2.5f.
    half_odd: f32,
}

impl FrameSpectralPowers {
    fn base_support(self) -> f32 {
        self.harmonics[0] + self.harmonics[1] + self.harmonics[2]
    }

    fn odd_support(self) -> f32 {
        self.harmonics[0] + self.harmonics[2] + self.harmonics[4]
    }

    fn even_support(self) -> f32 {
        self.harmonics[1] + self.harmonics[3] + self.harmonics[5]
    }
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
    evidence: Option<PipelineSpectralTelemetry>,
    hps: HpsGuard,
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
            evidence: None,
            hps: HpsGuard::new(),
        }
    }

    /// Clears the fold state. Call when the signal drops (gate closed) so a
    /// fold engaged on the previous note cannot carry over to the next one.
    pub fn reset(&mut self) {
        self.active = FoldDirection::None;
        self.pending = FoldDirection::None;
        self.pending_streak = 0;
        self.correction_started = false;
        self.evidence = None;
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

    pub(crate) fn evidence(&self) -> Option<PipelineSpectralTelemetry> {
        self.evidence
    }

    pub(crate) fn begin_frame(&mut self) {
        self.evidence = None;
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
        // Public callers supply no confidence; use a mid-range value so the
        // HPS guard runs with its strictest dominance requirement.
        self.resolve_with_confidence(
            buffer,
            sample_rate,
            frequency,
            min_frequency,
            max_frequency,
            0.90,
        )
    }

    /// Same as [`Self::resolve`], but the time-domain estimate's confidence
    /// gates the HPS guard (very confident frames are never flipped).
    pub(crate) fn resolve_with_confidence(
        &mut self,
        buffer: &[f32],
        sample_rate: f32,
        frequency: f32,
        min_frequency: f32,
        max_frequency: f32,
        confidence: f32,
    ) -> f32 {
        self.correction_started = false;
        if buffer.len() < 64
            || !sample_rate.is_finite()
            || sample_rate <= 0.0
            || !frequency.is_finite()
            || frequency <= 0.0
        {
            self.evidence = None;
            return frequency;
        }
        apply_hann_window(buffer, &mut self.windowed);

        let powers = self.measure_powers(sample_rate, frequency, min_frequency);
        let mut desired = self.desired_fold(powers, frequency, min_frequency, max_frequency);
        if desired == FoldDirection::None {
            // The Goertzel probes saw nothing conclusive; ask the harmonic
            // product spectrum. The HPS verdict feeds the same confirmation
            // state machine below, so it needs the same consecutive-frame
            // evidence before it can move the readout.
            desired = match self.hps.verdict(
                buffer,
                sample_rate,
                frequency,
                confidence,
                min_frequency,
                max_frequency,
            ) {
                HpsVerdict::Double => FoldDirection::Up,
                HpsVerdict::Half => FoldDirection::Down,
                HpsVerdict::Neutral => FoldDirection::None,
            };
        }
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

        self.evidence = Some(self.measure_evidence(
            powers,
            frequency,
            frequency * 0.5 >= min_frequency,
            frequency * 2.0 <= max_frequency,
        ));

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
        powers: FrameSpectralPowers,
        frequency: f32,
        min_frequency: f32,
        max_frequency: f32,
    ) -> FoldDirection {
        if frequency * 0.5 >= min_frequency {
            let ratio = if self.active == FoldDirection::Down {
                FOLD_DOWN_EXIT_RATIO
            } else {
                FOLD_DOWN_ENTER_RATIO
            };
            if powers.half_odd > 0.0 && powers.half_odd > ratio * powers.base_support() {
                return FoldDirection::Down;
            }
        }

        if frequency * 2.0 <= max_frequency {
            let ratio = if self.active == FoldDirection::Up {
                FOLD_UP_EXIT_RATIO
            } else {
                FOLD_UP_ENTER_RATIO
            };
            if powers.even_support() > 0.0 && powers.odd_support() < ratio * powers.even_support() {
                return FoldDirection::Up;
            }
        }

        FoldDirection::None
    }

    /// Measure each unique frequency used by the decision exactly once. The
    /// previous diagnostics path repeated overlapping groups and added up to
    /// twenty extra Goertzel passes per frame; this snapshot needs at most
    /// nine total probes (f..6f plus 0.5f, 1.5f and 2.5f).
    fn measure_powers(
        &self,
        sample_rate: f32,
        frequency: f32,
        min_frequency: f32,
    ) -> FrameSpectralPowers {
        let limit = sample_rate * MAX_PROBE_NYQUIST_FRACTION;
        let mut powers = FrameSpectralPowers::default();
        for (index, power) in powers.harmonics.iter_mut().enumerate() {
            let probe = frequency * (index + 1) as f32;
            if probe > 0.0 && probe < limit {
                *power = goertzel_power(&self.windowed, sample_rate, probe);
            }
        }

        if frequency * 0.5 >= min_frequency {
            for multiplier in [0.5_f32, 1.5, 2.5] {
                let probe = frequency * multiplier;
                if probe > 0.0 && probe < limit {
                    powers.half_odd += goertzel_power(&self.windowed, sample_rate, probe);
                }
            }
        }
        powers
    }

    fn measure_evidence(
        &self,
        powers: FrameSpectralPowers,
        frequency: f32,
        down_available: bool,
        up_available: bool,
    ) -> PipelineSpectralTelemetry {
        let mut harmonics = [0.0; DIAGNOSTIC_HARMONICS];
        harmonics.copy_from_slice(&powers.harmonics[..DIAGNOSTIC_HARMONICS]);
        normalize_strengths(&mut harmonics);

        let mut octave_scores = [
            if down_available { powers.half_odd } else { 0.0 },
            powers.base_support(),
            if up_available {
                powers.even_support()
            } else {
                0.0
            },
        ];
        normalize_strengths(&mut octave_scores);

        PipelineSpectralTelemetry {
            active_octave: fold_shift(self.active),
            base_frequency: frequency,
            harmonics,
            octave_scores,
            pending_octave: fold_shift(self.pending),
        }
    }
}

fn fold_shift(direction: FoldDirection) -> i8 {
    match direction {
        FoldDirection::Down => -1,
        FoldDirection::None => 0,
        FoldDirection::Up => 1,
    }
}

fn normalize_strengths<const N: usize>(values: &mut [f32; N]) {
    let maximum = values.iter().copied().fold(0.0_f32, f32::max);
    if maximum <= f32::EPSILON || !maximum.is_finite() {
        values.fill(0.0);
        return;
    }
    for value in values {
        *value = (*value / maximum).clamp(0.0, 1.0);
    }
}
