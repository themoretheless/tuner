#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;

pub struct Smoother {
    ema: Option<f32>,
    hist: Vec<f32>,
    alpha: f32,
    maxh: usize,
}

impl Default for Smoother {
    fn default() -> Self {
        Self::new()
    }
}

const RESEED_JUMP_CENTS: f32 = 250.0;

impl Smoother {
    pub fn new() -> Self {
        Self {
            ema: None,
            hist: vec![],
            alpha: 0.4,
            maxh: 5,
        }
    }

    pub fn add(&mut self, f: Option<f32>) -> Option<f32> {
        if let Some(v) = f.filter(|value| value.is_finite() && *value > 0.0) {
            if self
                .ema
                .is_some_and(|ema| (1200.0 * (v / ema).log2()).abs() > RESEED_JUMP_CENTS)
            {
                self.reset();
            }
            self.ema = Some(
                self.ema
                    .map_or(v, |e| self.alpha * v + (1.0 - self.alpha) * e),
            );
            if let Some(e) = self.ema {
                self.hist.push(e);
                if self.hist.len() > self.maxh {
                    self.hist.remove(0);
                }
            }
        }
        if self.hist.is_empty() {
            return self.ema;
        }
        let mut s = self.hist.clone();
        s.sort_by(f32::total_cmp);
        let m = s.len() / 2;
        Some(if s.len() % 2 == 1 {
            s[m]
        } else {
            (s[m - 1] + s[m]) * 0.5
        })
    }

    pub fn reset(&mut self) {
        self.hist.clear();
        self.ema = None;
    }
}

#[cfg(test)]
mod tests {
    use super::Smoother;

    #[test]
    fn ignores_non_finite_and_non_positive_values() {
        let mut smoother = Smoother::new();
        assert_eq!(smoother.add(Some(f32::NAN)), None);
        assert_eq!(smoother.add(Some(f32::INFINITY)), None);
        assert_eq!(smoother.add(Some(0.0)), None);
        assert_eq!(smoother.add(Some(-1.0)), None);

        assert_eq!(smoother.add(Some(110.0)), Some(110.0));
        assert_eq!(smoother.add(Some(f32::NAN)), Some(110.0));
    }

    #[test]
    fn reseeds_instead_of_blending_across_string_jumps() {
        let mut smoother = Smoother::new();
        assert_eq!(smoother.add(Some(82.4069)), Some(82.4069));
        let switched = smoother.add(Some(110.0)).unwrap();
        assert!((switched - 110.0).abs() < f32::EPSILON);
    }

    #[test]
    fn still_smooths_small_pitch_jitter() {
        let mut smoother = Smoother::default();
        smoother.add(Some(110.0));
        let smoothed = smoother.add(Some(111.0)).unwrap();
        assert!(smoothed > 110.0 && smoothed < 111.0);
    }
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub struct WasmSmoother {
    inner: Smoother,
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
impl WasmSmoother {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: Smoother::new(),
        }
    }

    pub fn add(&mut self, f: Option<f32>) -> Option<f32> {
        self.inner.add(f)
    }

    pub fn reset(&mut self) {
        self.inner.reset();
    }
}

#[cfg(feature = "wasm")]
impl Default for WasmSmoother {
    fn default() -> Self {
        Self::new()
    }
}
