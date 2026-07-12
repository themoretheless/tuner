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

/// Power at the sub-octave's odd multiples (0.5f, 1.5f, 2.5f) must exceed
/// this fraction of the power at the estimate's own harmonics (f, 2f, 3f)
/// before the estimate is folded down to f/2. True fundamentals put no
/// energy at those in-between frequencies, so anything past window leakage
/// (Hann sidelobes are below -31 dB, i.e. under 0.001 in power) is a real
/// subharmonic series; 0.3 leaves a wide safety margin.
const FOLD_DOWN_EVIDENCE_RATIO: f32 = 0.3;

/// Power at the estimate's odd multiples (f, 3f, 5f) must fall below this
/// fraction of the power at its even multiples (2f, 4f, 6f) before the
/// estimate is folded up to 2f. Kept small on purpose: a weak-but-present
/// fundamental (e.g. a low string through a high-pass-filtered mic) still
/// has clear odd-harmonic energy and must keep the periodicity-based
/// estimate, which is exactly where YIN beats a naive spectral peak.
const FOLD_UP_EVIDENCE_RATIO: f32 = 0.15;

/// Probes per parity group. Three odd and three even multiples are enough
/// to separate the octave hypotheses without probing into the noise floor.
const PROBES_PER_GROUP: usize = 3;

/// Skip probe frequencies above this fraction of the sample rate; Goertzel
/// responses degrade approaching Nyquist.
const MAX_PROBE_NYQUIST_FRACTION: f32 = 0.45;

/// Cross-checks a time-domain pitch estimate against the frame's actual
/// spectral content and folds octave errors (2x / 0.5x locks) back to the
/// supported octave. Owns a scratch buffer so per-frame use does not
/// allocate after warm-up.
pub struct OctaveDisambiguator {
    windowed: Vec<f32>,
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
        }
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
        if buffer.len() < 64
            || !sample_rate.is_finite()
            || sample_rate <= 0.0
            || !frequency.is_finite()
            || frequency <= 0.0
        {
            return frequency;
        }
        self.apply_hann_window(buffer);

        let odd_of_half = self.parity_power(sample_rate, frequency * 0.5, 1);
        let base_harmonics = self.group_power(sample_rate, frequency, [1.0, 2.0, 3.0]);
        if frequency * 0.5 >= min_frequency
            && odd_of_half > 0.0
            && odd_of_half > FOLD_DOWN_EVIDENCE_RATIO * base_harmonics
        {
            return frequency * 0.5;
        }

        let odd = self.parity_power(sample_rate, frequency, 1);
        let even = self.parity_power(sample_rate, frequency, 2);
        if frequency * 2.0 <= max_frequency && even > 0.0 && odd < FOLD_UP_EVIDENCE_RATIO * even {
            return frequency * 2.0;
        }

        frequency
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

    fn apply_hann_window(&mut self, buffer: &[f32]) {
        let length = buffer.len();
        self.windowed.resize(length, 0.0);
        let scale = std::f32::consts::TAU / (length - 1) as f32;
        for (index, (output, sample)) in self.windowed.iter_mut().zip(buffer).enumerate() {
            let window = 0.5 * (1.0 - (scale * index as f32).cos());
            *output = sample * window;
        }
    }
}

/// Spectral power of `samples` at `frequency` via the Goertzel recurrence.
fn goertzel_power(samples: &[f32], sample_rate: f32, frequency: f32) -> f32 {
    let omega = std::f32::consts::TAU * frequency / sample_rate;
    let coefficient = 2.0 * omega.cos();
    let mut delayed_1 = 0.0_f32;
    let mut delayed_2 = 0.0_f32;
    for sample in samples {
        let current = sample + coefficient * delayed_1 - delayed_2;
        delayed_2 = delayed_1;
        delayed_1 = current;
    }
    delayed_1 * delayed_1 + delayed_2 * delayed_2 - coefficient * delayed_1 * delayed_2
}
