#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;

#[derive(Default)]
pub struct Smoother {
    ema: Option<f32>,
    hist: Vec<f32>,
    alpha: f32,
    maxh: usize,
}

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
        if let Some(v) = f {
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
        s.sort_by(|a, b| a.partial_cmp(b).unwrap());
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
