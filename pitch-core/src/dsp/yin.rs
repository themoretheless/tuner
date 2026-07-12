use super::{DetectorConfig, PitchDetector, PitchEstimate};

pub struct YinDetector {
    cleaned: Vec<f32>,
    config: DetectorConfig,
    difference: Vec<f32>,
    normalized: Vec<f32>,
}

impl Default for YinDetector {
    fn default() -> Self {
        Self::new(DetectorConfig::default())
    }
}

impl YinDetector {
    pub fn new(config: DetectorConfig) -> Self {
        Self {
            cleaned: Vec::new(),
            config,
            difference: Vec::new(),
            normalized: Vec::new(),
        }
    }

    pub(crate) fn detect_centered(
        &mut self,
        buffer: &[f32],
        sample_rate: f32,
    ) -> Option<PitchEstimate> {
        let half = buffer.len() / 2;
        if half < 64 || !sample_rate.is_finite() || sample_rate <= 0.0 {
            return None;
        }

        let min_tau = (sample_rate / self.config.max_frequency).floor() as usize;
        let max_tau = half.min((sample_rate / self.config.min_frequency).floor() as usize);
        if max_tau <= min_tau + 2 {
            return None;
        }

        self.difference.resize(max_tau, 0.0);
        self.normalized.resize(max_tau, 1.0);
        self.difference[..max_tau].fill(0.0);
        self.normalized[..max_tau].fill(1.0);

        for tau in 1..max_tau {
            let mut sum = 0.0;
            for index in 0..half {
                let delta = buffer[index] - buffer[index + tau];
                sum += delta * delta;
            }
            self.difference[tau] = sum;
        }

        let mut running_sum = 0.0;
        for tau in 1..max_tau {
            running_sum += self.difference[tau];
            self.normalized[tau] = if running_sum > 0.0 {
                self.difference[tau] * tau as f32 / running_sum
            } else {
                1.0
            };
        }

        let rms =
            (buffer.iter().map(|sample| sample * sample).sum::<f32>() / buffer.len() as f32).sqrt();
        let adaptive_threshold = self.config.yin_threshold * (1.0 - 0.35 * (rms * 15.0).min(1.0));
        let estimate = (min_tau..max_tau).find_map(|tau| {
            if self.normalized[tau] >= adaptive_threshold {
                return None;
            }
            let mut best = tau;
            while best + 1 < max_tau && self.normalized[best + 1] < self.normalized[best] {
                best += 1;
            }
            Some(best)
        });

        let (tau, confidence) = estimate.map_or_else(
            || {
                let (tau, value) = self.normalized[min_tau..max_tau]
                    .iter()
                    .enumerate()
                    .min_by(|(_, left), (_, right)| left.total_cmp(right))
                    .map(|(index, value)| (index + min_tau, *value))?;
                (value <= 0.35).then_some((tau, (1.0 - value).clamp(0.0, 1.0)))
            },
            |tau| Some((tau, (1.0 - self.normalized[tau]).clamp(0.0, 1.0))),
        )?;

        if tau < 2 || tau + 1 >= max_tau {
            return None;
        }

        let left = self.normalized[tau - 1];
        let center = self.normalized[tau];
        let right = self.normalized[tau + 1];
        let denominator = 2.0 * center - left - right;
        let offset = if denominator.abs() > 1e-9 {
            ((right - left) / (2.0 * denominator)).clamp(-1.0, 1.0)
        } else {
            0.0
        };
        let frequency = sample_rate / (tau as f32 + offset);

        (self.config.min_frequency..=self.config.max_frequency)
            .contains(&frequency)
            .then_some(PitchEstimate {
                confidence,
                frequency,
            })
    }

    fn prepare_centered(&mut self, buffer: &[f32]) -> bool {
        if buffer.is_empty() {
            return false;
        }
        let mean = buffer.iter().sum::<f32>() / buffer.len() as f32;
        self.cleaned.resize(buffer.len(), 0.0);
        for (output, sample) in self.cleaned.iter_mut().zip(buffer) {
            *output = *sample - mean;
        }
        let rms = (self
            .cleaned
            .iter()
            .map(|sample| sample * sample)
            .sum::<f32>()
            / self.cleaned.len() as f32)
            .sqrt();
        let max_abs = self
            .cleaned
            .iter()
            .fold(0.0_f32, |maximum, sample| maximum.max(sample.abs()));
        rms >= self.config.rms_gate && max_abs >= self.config.peak_gate
    }
}

impl PitchDetector for YinDetector {
    fn detect(&mut self, buffer: &[f32], sample_rate: f32) -> Option<PitchEstimate> {
        if !self.prepare_centered(buffer) {
            return None;
        }
        let cleaned = std::mem::take(&mut self.cleaned);
        let estimate = self
            .detect_centered(&cleaned, sample_rate)
            .filter(|estimate| self.config.accepts_confidence(estimate.confidence));
        self.cleaned = cleaned;
        estimate
    }

    fn set_config(&mut self, config: DetectorConfig) {
        self.config = config;
    }
}
