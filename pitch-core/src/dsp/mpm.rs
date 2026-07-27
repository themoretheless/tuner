use super::{DetectorConfig, PitchDetector, PitchEstimate};

pub struct MpmDetector {
    cleaned: Vec<f32>,
    config: DetectorConfig,
    normalized_square_difference: Vec<f32>,
    /// Optional per-frame narrowing of the lag search (min/max frequency),
    /// set by the hybrid detector when a single target string is selected.
    /// Only the tau search window shrinks; the analysis buffer itself is
    /// untouched, so spectral guards keep the full frame.
    search_range: Option<(f32, f32)>,
}

impl Default for MpmDetector {
    fn default() -> Self {
        Self::new(DetectorConfig::default())
    }
}

impl MpmDetector {
    pub fn new(config: DetectorConfig) -> Self {
        Self {
            cleaned: Vec::new(),
            config,
            normalized_square_difference: Vec::new(),
            search_range: None,
        }
    }

    pub(crate) fn set_search_range(&mut self, search_range: Option<(f32, f32)>) {
        self.search_range = search_range;
    }

    fn effective_frequency_range(&self) -> (f32, f32) {
        let full = (self.config.min_frequency, self.config.max_frequency);
        let Some((low, high)) = self.search_range else {
            return full;
        };
        let min_frequency = full.0.max(low);
        let max_frequency = full.1.min(high);
        // A degenerate intersection (selected target far outside the
        // instrument range) falls back to the full configured range instead
        // of producing an empty tau window.
        if max_frequency > min_frequency * 1.05 {
            (min_frequency, max_frequency)
        } else {
            full
        }
    }

    pub(crate) fn detect_centered(
        &mut self,
        buffer: &[f32],
        sample_rate: f32,
    ) -> Option<PitchEstimate> {
        let length = buffer.len();
        let (min_frequency, max_frequency) = self.effective_frequency_range();
        let min_tau = (sample_rate / max_frequency).floor() as usize;
        let max_tau = (length / 2).min((sample_rate / min_frequency) as usize);
        if max_tau <= min_tau + 2 {
            return None;
        }

        self.normalized_square_difference.resize(max_tau, 0.0);
        let calculation_start = min_tau.saturating_sub(1);
        // Same rationale as YIN: accumulate the NSDF sums in f64 so long
        // windows do not lose precision near the peak-picking thresholds.
        for tau in calculation_start..max_tau {
            let mut numerator = 0.0_f64;
            let mut denominator = 0.0_f64;
            for index in 0..(length - tau) {
                let left = f64::from(buffer[index]);
                let right = f64::from(buffer[index + tau]);
                numerator += left * right;
                denominator += left * left + right * right;
            }
            self.normalized_square_difference[tau] = if denominator > 0.0 {
                (2.0 * numerator / denominator) as f32
            } else {
                0.0
            };
        }

        let maximum_peak = (min_tau.max(2)..max_tau - 1)
            .filter_map(|tau| {
                let value = self.normalized_square_difference[tau];
                (value > self.normalized_square_difference[tau - 1]
                    && value > self.normalized_square_difference[tau + 1])
                    .then_some((tau, value))
            })
            .map(|(_, value)| value)
            .max_by(f32::total_cmp)?;
        if maximum_peak <= 0.25 {
            return None;
        }
        let peak_threshold = (maximum_peak * 0.93).max(0.25);
        let peak = (min_tau.max(2)..max_tau - 1).find(|&tau| {
            let value = self.normalized_square_difference[tau];
            value >= peak_threshold
                && value > self.normalized_square_difference[tau - 1]
                && value > self.normalized_square_difference[tau + 1]
        })?;
        let confidence = self.normalized_square_difference[peak];

        let left = self.normalized_square_difference[peak - 1];
        let center = self.normalized_square_difference[peak];
        let right = self.normalized_square_difference[peak + 1];
        let denominator = left - 2.0 * center + right;
        let offset = if denominator.abs() > 1e-9 {
            (0.5 * (left - right) / denominator).clamp(-1.0, 1.0)
        } else {
            0.0
        };
        let frequency = sample_rate / (peak as f32 + offset);

        (self.config.min_frequency..=self.config.max_frequency)
            .contains(&frequency)
            .then_some(PitchEstimate {
                confidence: confidence.clamp(0.0, 1.0),
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

impl PitchDetector for MpmDetector {
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
