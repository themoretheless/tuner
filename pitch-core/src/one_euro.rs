//! One-euro filter (Casiez, Roussel, Vogel — CHI 2012).
//!
//! A first-order low-pass whose cutoff adapts to the signal's speed:
//! slow motion is smoothed hard (minimum jitter on a held note), fast
//! motion is passed with almost no lag (slides and bends stay crisp).
//! Pure `f32`, fixed size, no allocations — safe for the wasm hot path.

use std::f32::consts::TAU;

/// Smoothing factor for a given cutoff frequency and frame period.
fn smoothing_alpha(cutoff_hz: f32, dt: f32) -> f32 {
    let tau = 1.0 / (TAU * cutoff_hz);
    1.0 / (1.0 + tau / dt)
}

#[derive(Clone, Debug)]
pub(crate) struct OneEuroFilter {
    mincutoff: f32,
    beta: f32,
    dcutoff: f32,
    dt: f32,
    /// Previous raw input (derivative is estimated on the raw signal).
    prev_raw: Option<f32>,
    /// Low-passed derivative estimate.
    dx_hat: f32,
    /// Previous filtered output.
    prev_filtered: Option<f32>,
}

impl OneEuroFilter {
    /// `beta` is expressed against the derivative in the same units the
    /// filter is fed with, per second.
    pub(crate) fn new(mincutoff: f32, beta: f32, dcutoff: f32, dt: f32) -> Self {
        Self {
            mincutoff,
            beta,
            dcutoff,
            dt,
            prev_raw: None,
            dx_hat: 0.0,
            prev_filtered: None,
        }
    }

    /// Drops all state; the next input passes through unfiltered.
    pub(crate) fn reset(&mut self) {
        self.prev_raw = None;
        self.dx_hat = 0.0;
        self.prev_filtered = None;
    }

    /// Re-seeds the filter at a known value without history. Used when the
    /// tracker commits a new note: the readout must jump, never blend.
    pub(crate) fn seed(&mut self, value: f32) {
        self.prev_raw = Some(value);
        self.dx_hat = 0.0;
        self.prev_filtered = Some(value);
    }

    pub(crate) fn filter(&mut self, value: f32) -> f32 {
        let dx = self.prev_raw.map_or(0.0, |prev| (value - prev) / self.dt);
        self.prev_raw = Some(value);

        let alpha_d = smoothing_alpha(self.dcutoff, self.dt);
        self.dx_hat += alpha_d * (dx - self.dx_hat);

        let cutoff = self.mincutoff + self.beta * self.dx_hat.abs();
        let alpha = smoothing_alpha(cutoff, self.dt);
        let filtered = self
            .prev_filtered
            .map_or(value, |prev| prev + alpha * (value - prev));
        self.prev_filtered = Some(filtered);
        filtered
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const DT: f32 = 1.0 / 30.0;

    fn filter() -> OneEuroFilter {
        // Same parameters the tracker uses: beta is passed in log2-domain
        // units (0.01 Hz per cent/sec * 1200); see tracking.rs.
        OneEuroFilter::new(0.9, 0.02 * 1_200.0, 1.2, DT)
    }

    /// Deterministic ±5-cent peak jitter around a constant pitch, expressed
    /// in log2 units around 110 Hz.
    fn jittered_constant(frames: usize) -> Vec<f32> {
        let base = 110.0_f32.log2();
        let jitter_log2 = 5.0 / 1_200.0;
        (0..frames)
            .map(|i| {
                let phase = (i % 4) as f32;
                base + jitter_log2 * (phase - 1.5) / 1.5
            })
            .collect()
    }

    fn peak_deviation(outputs: &[f32], center: f32) -> f32 {
        outputs
            .iter()
            .map(|value| (value - center).abs())
            .fold(0.0, f32::max)
    }

    /// Median-of-3 over a sliding window, matching the tracker's inlier
    /// history: the filter never sees raw detector output, so jitter
    /// comparisons must run on the same pre-filtered signal.
    fn median3(inputs: &[f32]) -> Vec<f32> {
        inputs
            .windows(3)
            .map(|w| {
                let mut v = [w[0], w[1], w[2]];
                v.sort_by(f32::total_cmp);
                v[1]
            })
            .collect()
    }

    #[test]
    fn steady_jitter_is_suppressed_harder_than_fixed_ema() {
        let base = 110.0_f32.log2();
        let inputs = median3(&jittered_constant(122));

        let mut one_euro = filter();
        let mut ema: Option<f32> = None;
        let mut oe_tail = Vec::new();
        let mut ema_tail = Vec::new();
        for (index, input) in inputs.iter().enumerate() {
            let oe = one_euro.filter(*input);
            let ema_value = ema.map_or(*input, |prev| 0.2 * input + 0.8 * prev);
            ema = Some(ema_value);
            if index >= 60 {
                oe_tail.push(oe);
                ema_tail.push(ema_value);
            }
        }

        let oe_dev = peak_deviation(&oe_tail, base);
        let ema_dev = peak_deviation(&ema_tail, base);
        assert!(
            oe_dev < ema_dev,
            "one-euro jitter {oe_dev} should beat fixed-EMA jitter {ema_dev}"
        );
        // In cents: output jitter must sit well under the ±5 input jitter.
        assert!(oe_dev * 1_200.0 < 1.5, "jitter {} cents", oe_dev * 1_200.0);
    }

    #[test]
    fn fast_slide_settles_at_least_as_fast_as_fixed_ema() {
        // A 30-cent-per-frame slide: inside the inlier tolerance, this is
        // the fastest continuous motion the tracker ever filters.
        let base = 110.0_f32.log2();
        let step_log2 = 30.0 / 1_200.0;
        let target = base + 10.0 * step_log2;

        let mut one_euro = filter();
        let mut ema = base;
        // Settle both at the start value.
        for _ in 0..60 {
            one_euro.filter(base);
            ema = 0.55 * base + 0.45 * ema;
        }
        // Fastest stepped-alpha tier of the legacy tracker was 0.55.
        let mut oe_settle = None;
        let mut ema_settle = None;
        for frame in 0..30 {
            let input = base + step_log2 * (frame.min(10) as f32);
            let oe = one_euro.filter(input);
            ema = 0.55 * input + 0.45 * ema;
            if oe_settle.is_none() && (oe - target).abs() * 1_200.0 < 3.0 {
                oe_settle = Some(frame);
            }
            if ema_settle.is_none() && (ema - target).abs() * 1_200.0 < 3.0 {
                ema_settle = Some(frame);
            }
        }
        assert!(
            oe_settle.expect("one-euro settles") <= ema_settle.expect("ema settles"),
            "one-euro settled at {oe_settle:?}, ema at {ema_settle:?}"
        );
    }

    #[test]
    fn output_is_deterministic() {
        let inputs = jittered_constant(60);
        let run = |inputs: &[f32]| {
            let mut f = filter();
            inputs.iter().map(|v| f.filter(*v)).collect::<Vec<_>>()
        };
        assert_eq!(run(&inputs), run(&inputs));
    }

    #[test]
    fn seeded_filter_does_not_blend_across_a_note_change() {
        let mut f = filter();
        let low = 110.0_f32.log2();
        let high = 220.0_f32.log2();
        for _ in 0..30 {
            f.filter(low);
        }
        f.seed(high);
        // First frame after a seed must already sit at the new note.
        let out = f.filter(high);
        assert!((out - high).abs() * 1_200.0 < 0.01);
    }

    #[test]
    fn first_frame_passes_through_unfiltered() {
        let mut f = filter();
        let value = 440.0_f32.log2();
        assert_eq!(f.filter(value), value);
    }
}
