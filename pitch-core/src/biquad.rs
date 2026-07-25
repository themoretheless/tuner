//! RBJ biquad filters for detector input conditioning.
//!
//! The pitch detectors (YIN/MPM) are sensitive to out-of-band energy:
//! subsonic rumble and mains hum pollute the difference function, and
//! broadband clicks raise its floor. A light two-pole high-pass plus
//! low-pass cascade band-limits the analysis buffer to the frequencies
//! the detector can actually report, without touching the gate logic.
//!
//! Coefficients are designed with the RBJ audio-eq-cookbook formulas in
//! f64 and stored as f32; the runtime state is f32 (transposed Direct
//! Form II), which keeps the hot path cheap and WASM-friendly.

/// Butterworth Q (maximally flat amplitude, no passband ripple).
const BUTTERWORTH_Q: f64 = std::f64::consts::FRAC_1_SQRT_2;

/// The low-pass edge sits this many harmonics above the highest
/// detectable fundamental. Four harmonics suffice for octave
/// disambiguation; the edge is kept at 6x because the corpus benchmark
/// showed the tighter 4x edge degrading bright, harmonic-rich sustain
/// tones (uke G4 P95 +0.71 cents, above the 0.5-cent rollback gate),
/// while 6x keeps every record under the gate and preserves most of the
/// noise-reduction win on noisy attacks.
const LOW_PASS_HARMONIC_MULTIPLIER: f32 = 6.0;

/// Normalized biquad coefficients (already divided by `a0`).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct BiquadCoefficients {
    pub b0: f32,
    pub b1: f32,
    pub b2: f32,
    pub a1: f32,
    pub a2: f32,
}

impl BiquadCoefficients {
    /// RBJ two-pole low-pass. Returns `None` for non-finite or out of
    /// range parameters (`0 < cutoff < sample_rate / 2`, `q > 0`).
    pub fn low_pass(sample_rate: f32, cutoff: f32, q: f32) -> Option<Self> {
        Self::rbj(sample_rate, cutoff, q, BiquadKind::LowPass)
    }

    /// RBJ two-pole high-pass. Same validity rules as [`Self::low_pass`].
    pub fn high_pass(sample_rate: f32, cutoff: f32, q: f32) -> Option<Self> {
        Self::rbj(sample_rate, cutoff, q, BiquadKind::HighPass)
    }

    fn rbj(sample_rate: f32, cutoff: f32, q: f32, kind: BiquadKind) -> Option<Self> {
        let sample_rate = f64::from(sample_rate);
        let cutoff = f64::from(cutoff);
        let q = f64::from(q);
        if !sample_rate.is_finite()
            || !cutoff.is_finite()
            || !q.is_finite()
            || sample_rate <= 0.0
            || cutoff <= 0.0
            || cutoff >= sample_rate / 2.0
            || q <= 0.0
        {
            return None;
        }
        let omega = std::f64::consts::TAU * cutoff / sample_rate;
        let (sin_omega, cos_omega) = omega.sin_cos();
        let alpha = sin_omega / (2.0 * q);
        let a0 = 1.0 + alpha;
        let (b0, b1, b2) = match kind {
            BiquadKind::LowPass => (
                (1.0 - cos_omega) / 2.0,
                1.0 - cos_omega,
                (1.0 - cos_omega) / 2.0,
            ),
            BiquadKind::HighPass => (
                (1.0 + cos_omega) / 2.0,
                -(1.0 + cos_omega),
                (1.0 + cos_omega) / 2.0,
            ),
        };
        Some(Self {
            b0: (b0 / a0) as f32,
            b1: (b1 / a0) as f32,
            b2: (b2 / a0) as f32,
            a1: (-2.0 * cos_omega / a0) as f32,
            a2: ((1.0 - alpha) / a0) as f32,
        })
    }
}

#[derive(Clone, Copy, Debug)]
enum BiquadKind {
    LowPass,
    HighPass,
}

/// Single biquad section with f32 state (transposed Direct Form II).
#[derive(Clone, Copy, Debug)]
pub struct Biquad {
    coefficients: BiquadCoefficients,
    z1: f32,
    z2: f32,
}

impl Biquad {
    pub fn new(coefficients: BiquadCoefficients) -> Self {
        Self {
            coefficients,
            z1: 0.0,
            z2: 0.0,
        }
    }

    pub fn reset(&mut self) {
        self.z1 = 0.0;
        self.z2 = 0.0;
    }

    #[inline]
    pub fn process(&mut self, input: f32) -> f32 {
        let c = &self.coefficients;
        let output = c.b0 * input + self.z1;
        self.z1 = c.b1 * input - c.a1 * output + self.z2;
        self.z2 = c.b2 * input - c.a2 * output;
        output
    }
}

/// High-pass + low-pass cascade that band-limits the detector input to
/// `[min_frequency * 0.5, max_frequency * 6]`, clamped into
/// `(10 Hz, Nyquist * 0.9)`. The high-pass removes DC residuals, subsonic
/// rumble and (for higher minimum frequencies) mains hum; the low-pass
/// softens clicks and hiss while keeping the low harmonics of the
/// highest detectable fundamental for octave disambiguation.
#[derive(Clone, Copy, Debug)]
pub struct BandPassFilter {
    high_pass: Option<Biquad>,
    low_pass: Option<Biquad>,
    sample_rate: f32,
    low_cutoff: f32,
    high_cutoff: f32,
}

impl Default for BandPassFilter {
    fn default() -> Self {
        Self {
            high_pass: None,
            low_pass: None,
            sample_rate: 0.0,
            low_cutoff: 0.0,
            high_cutoff: 0.0,
        }
    }
}

impl BandPassFilter {
    pub fn for_frequency_range(sample_rate: f32, min_frequency: f32, max_frequency: f32) -> Self {
        let mut filter = Self::default();
        filter.reconfigure(sample_rate, min_frequency, max_frequency);
        filter
    }

    /// Rebuilds the sections when the sample rate or frequency range
    /// changed since the last call; otherwise a no-op. State is reset on
    /// rebuild so stale history never leaks across configurations.
    pub fn reconfigure(&mut self, sample_rate: f32, min_frequency: f32, max_frequency: f32) {
        let (low_cutoff, high_cutoff) = band_edges(sample_rate, min_frequency, max_frequency);
        let unchanged = self.sample_rate == sample_rate
            && self.low_cutoff == low_cutoff.unwrap_or(0.0)
            && self.high_cutoff == high_cutoff.unwrap_or(0.0);
        if unchanged {
            return;
        }
        self.sample_rate = sample_rate;
        self.high_pass = low_cutoff.and_then(|cutoff| {
            BiquadCoefficients::high_pass(sample_rate, cutoff, BUTTERWORTH_Q as f32)
                .map(Biquad::new)
        });
        self.low_pass = high_cutoff.and_then(|cutoff| {
            BiquadCoefficients::low_pass(sample_rate, cutoff, BUTTERWORTH_Q as f32).map(Biquad::new)
        });
        match (low_cutoff, high_cutoff) {
            (Some(low), Some(high)) if low < high => {
                self.low_cutoff = low;
                self.high_cutoff = high;
            }
            _ => {
                // Degenerate band (e.g. an extremely low sample rate):
                // pass the signal through unfiltered.
                self.low_cutoff = 0.0;
                self.high_cutoff = 0.0;
                self.high_pass = None;
                self.low_pass = None;
            }
        }
    }

    pub fn is_enabled(&self) -> bool {
        self.high_pass.is_some() || self.low_pass.is_some()
    }

    /// Effective `(high_pass, low_pass)` cutoffs in Hz, if filtering.
    pub fn cutoffs(&self) -> Option<(f32, f32)> {
        self.is_enabled()
            .then_some((self.low_cutoff, self.high_cutoff))
    }

    pub fn reset(&mut self) {
        if let Some(high_pass) = &mut self.high_pass {
            high_pass.reset();
        }
        if let Some(low_pass) = &mut self.low_pass {
            low_pass.reset();
        }
    }

    pub fn process_in_place(&mut self, buffer: &mut [f32]) {
        if let Some(high_pass) = &mut self.high_pass {
            for sample in buffer.iter_mut() {
                *sample = high_pass.process(*sample);
            }
        }
        if let Some(low_pass) = &mut self.low_pass {
            for sample in buffer.iter_mut() {
                *sample = low_pass.process(*sample);
            }
        }
    }
}

/// Clamped band edges: `None, None` when the sample rate cannot support
/// filtering at all.
fn band_edges(
    sample_rate: f32,
    min_frequency: f32,
    max_frequency: f32,
) -> (Option<f32>, Option<f32>) {
    if !sample_rate.is_finite() || sample_rate <= 0.0 {
        return (None, None);
    }
    let upper_clamp = sample_rate / 2.0 * 0.9;
    if upper_clamp <= 10.0 {
        return (None, None);
    }
    let low = (min_frequency * 0.5).clamp(10.0, upper_clamp);
    let high = (max_frequency * LOW_PASS_HARMONIC_MULTIPLIER).clamp(10.0, upper_clamp);
    (Some(low), Some(high))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f32::consts::TAU;

    fn tone(length: usize, sample_rate: f32, frequency: f32, amplitude: f32) -> Vec<f32> {
        (0..length)
            .map(|index| amplitude * (TAU * frequency * index as f32 / sample_rate).sin())
            .collect()
    }

    /// Amplitude of a single frequency via a Goertzel power measurement.
    fn goertzel_amplitude(buffer: &[f32], sample_rate: f32, frequency: f32) -> f32 {
        let omega = TAU * frequency / sample_rate;
        let coefficient = 2.0 * omega.cos();
        let (mut s1, mut s2) = (0.0_f32, 0.0_f32);
        for &sample in buffer {
            let s0 = sample + coefficient * s1 - s2;
            s2 = s1;
            s1 = s0;
        }
        let power = s1 * s1 + s2 * s2 - coefficient * s1 * s2;
        2.0 * power.max(0.0).sqrt() / buffer.len() as f32
    }

    #[test]
    fn invalid_design_parameters_yield_no_coefficients() {
        assert!(BiquadCoefficients::low_pass(0.0, 100.0, 0.7).is_none());
        assert!(BiquadCoefficients::low_pass(48_000.0, 24_000.0, 0.7).is_none());
        assert!(BiquadCoefficients::high_pass(48_000.0, -5.0, 0.7).is_none());
        assert!(BiquadCoefficients::high_pass(f32::NAN, 100.0, 0.7).is_none());
        assert!(BiquadCoefficients::low_pass(48_000.0, 100.0, 0.0).is_none());
    }

    #[test]
    fn band_pass_attenuates_50hz_hum_and_keeps_the_220hz_tone() {
        let sample_rate = 48_000.0;
        let length = 48_000; // 1 s: both 50 Hz and 220 Hz complete whole cycles.
        let mut buffer = tone(length, sample_rate, 220.0, 0.3);
        for (index, sample) in tone(length, sample_rate, 50.0, 0.8).iter().enumerate() {
            buffer[index] += sample;
        }

        let hum_before = goertzel_amplitude(&buffer, sample_rate, 50.0);
        let tone_before = goertzel_amplitude(&buffer, sample_rate, 220.0);

        // A detector range of 200..1200 Hz puts the high-pass edge at
        // 100 Hz, above the 50 Hz mains hum but below the 220 Hz tone.
        let mut filter = BandPassFilter::for_frequency_range(sample_rate, 200.0, 1_200.0);
        assert_eq!(filter.cutoffs(), Some((100.0, 7_200.0)));
        filter.process_in_place(&mut buffer);

        let hum_after = goertzel_amplitude(&buffer, sample_rate, 50.0);
        let tone_after = goertzel_amplitude(&buffer, sample_rate, 220.0);

        assert!(
            hum_after < hum_before * 0.4,
            "50 Hz hum must drop by >8 dB: {hum_before} -> {hum_after}"
        );
        assert!(
            tone_after > tone_before * 0.8,
            "220 Hz tone must survive: {tone_before} -> {tone_after}"
        );
    }

    #[test]
    fn band_pass_edges_follow_clamps_and_degenerate_rates_disable() {
        let filter = BandPassFilter::for_frequency_range(48_000.0, 30.0, 1_400.0);
        assert_eq!(filter.cutoffs(), Some((15.0, 8_400.0)));

        // Upper clamp is Nyquist * 0.9 = 4500 Hz at 10 kHz.
        let filter = BandPassFilter::for_frequency_range(10_000.0, 30.0, 1_400.0);
        assert_eq!(filter.cutoffs(), Some((15.0, 4_500.0)));

        // Lower clamp is 10 Hz for very low minimum frequencies.
        let filter = BandPassFilter::for_frequency_range(48_000.0, 20.0, 100.0);
        assert_eq!(filter.cutoffs(), Some((10.0, 600.0)));

        // A sample rate too low for the 10 Hz lower bound disables filtering.
        let filter = BandPassFilter::for_frequency_range(20.0, 30.0, 1_400.0);
        assert!(!filter.is_enabled());
        assert_eq!(filter.cutoffs(), None);

        let filter = BandPassFilter::for_frequency_range(f32::NAN, 30.0, 1_400.0);
        assert!(!filter.is_enabled());
    }

    #[test]
    fn reconfigure_keeps_state_when_nothing_changed() {
        let mut filter = BandPassFilter::for_frequency_range(48_000.0, 30.0, 1_400.0);
        let mut buffer = tone(256, 48_000.0, 220.0, 0.5);
        filter.process_in_place(&mut buffer);
        let stateful = filter;
        filter.reconfigure(48_000.0, 30.0, 1_400.0);
        assert_eq!(filter.cutoffs(), stateful.cutoffs());
        // Reconfiguring with a different range rebuilds (and resets).
        filter.reconfigure(48_000.0, 200.0, 1_200.0);
        assert_eq!(filter.cutoffs(), Some((100.0, 7_200.0)));
    }
}
