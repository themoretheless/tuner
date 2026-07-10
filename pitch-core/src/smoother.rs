const HISTORY_CAPACITY: usize = 5;

pub struct Smoother {
    alpha: f32,
    ema: Option<f32>,
    history: [f32; HISTORY_CAPACITY],
    history_cursor: usize,
    history_length: usize,
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
        }
    }

    pub fn add(&mut self, frequency: Option<f32>) -> Option<f32> {
        if let Some(value) = frequency.filter(|value| value.is_finite() && *value > 0.0) {
            let smoothed = self
                .ema
                .map_or(value, |ema| self.alpha * value + (1.0 - self.alpha) * ema);
            self.ema = Some(smoothed);
            self.history[self.history_cursor] = smoothed;
            self.history_cursor = (self.history_cursor + 1) % HISTORY_CAPACITY;
            self.history_length = (self.history_length + 1).min(HISTORY_CAPACITY);
        }

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

    pub fn reset(&mut self) {
        self.ema = None;
        self.history_cursor = 0;
        self.history_length = 0;
    }
}
