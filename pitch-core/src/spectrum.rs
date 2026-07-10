use rustfft::{num_complex::Complex, Fft};
use std::sync::Arc;

pub struct SpectrumAnalyzer {
    fft: Arc<dyn Fft<f32>>,
    fft_size: usize,
    input: Vec<Complex<f32>>,
    output: Vec<f32>,
}

impl SpectrumAnalyzer {
    pub fn new(fft_size: usize, bins: usize) -> Self {
        let fft_size = fft_size.max(64);
        let bins = bins.clamp(1, fft_size / 2);
        let mut planner = rustfft::FftPlanner::<f32>::new();
        Self {
            fft: planner.plan_fft_forward(fft_size),
            fft_size,
            input: vec![Complex::new(0.0, 0.0); fft_size],
            output: vec![0.0; bins],
        }
    }

    pub fn analyze(&mut self, buffer: &[f32]) -> &[f32] {
        self.output.fill(0.0);
        if buffer.len() < self.fft_size {
            return &self.output;
        }

        let denominator = self.fft_size.saturating_sub(1) as f32;
        for (index, sample) in buffer.iter().take(self.fft_size).enumerate() {
            let window =
                0.5 * (1.0 - (2.0 * std::f32::consts::PI * index as f32 / denominator).cos());
            self.input[index] = Complex::new(sample * window, 0.0);
        }
        self.fft.process(&mut self.input);

        for (index, magnitude) in self.output.iter_mut().enumerate() {
            *magnitude = self.input[index].norm();
        }
        let maximum = self.output.iter().copied().fold(0.0, f32::max).max(1e-6);
        for magnitude in &mut self.output {
            *magnitude /= maximum;
        }
        &self.output
    }
}
