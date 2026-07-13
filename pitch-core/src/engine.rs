use crate::{
    get_tunings, is_likely_power_chord_native, signal, DetectionFrame, DetectorConfig,
    FrameContext, FrameResolver, HybridPitchDetector, PitchDetector, Smoother, SpectrumAnalyzer,
    Tuning,
};

const DEFAULT_SPECTRUM_FFT_SIZE: usize = 2048;
const DEFAULT_SPECTRUM_BINS: usize = 512;

/// How many consecutive failed detections to ride out while the signal is
/// still above the RMS gate, before the readout clears. A decaying string
/// hovers around the detector's gates/confidence floor and detection
/// flickers Some/None; without a hold, every flicker resets the smoother
/// and the next reading reaches the display raw and jittery. At the ~33ms
/// detection cadence this is roughly 200ms. True silence (RMS below the
/// gate) still clears immediately.
const DETECTION_HOLD_FRAMES: u8 = 6;

#[derive(Clone, Debug)]
pub struct EngineConfig {
    pub a4: f32,
    pub detector: DetectorConfig,
    pub frame_context: Option<FrameContext>,
    pub tuning: Option<Tuning>,
    pub spectrum_fft_size: usize,
    pub spectrum_bins: usize,
}

impl Default for EngineConfig {
    fn default() -> Self {
        Self {
            a4: 440.0,
            detector: DetectorConfig::default(),
            frame_context: None,
            tuning: None,
            spectrum_fft_size: DEFAULT_SPECTRUM_FFT_SIZE,
            spectrum_bins: DEFAULT_SPECTRUM_BINS,
        }
    }
}

pub struct TunerEngine {
    smoother: Smoother,
    detector: HybridPitchDetector,
    resolver: FrameResolver,
    spectrum: Option<SpectrumAnalyzer>,
    spectrum_bins: usize,
    spectrum_fft_size: usize,
    rms_gate: f32,
    hold_streak: u8,
    held_reading: Option<(f32, f32)>,
}

impl TunerEngine {
    pub fn new(a4: f32) -> Self {
        Self::with_config(EngineConfig {
            a4,
            ..EngineConfig::default()
        })
    }

    pub fn with_config(config: EngineConfig) -> Self {
        let EngineConfig {
            a4,
            detector,
            frame_context,
            tuning,
            spectrum_fft_size,
            spectrum_bins,
        } = config;
        let tunings = get_tunings();
        let configured_spectrum_bins = if spectrum_bins == 0 {
            DEFAULT_SPECTRUM_BINS
        } else {
            spectrum_bins
        };
        let tuning = tuning
            .or_else(|| tunings.into_iter().next())
            .unwrap_or_else(|| Tuning {
                name: "Chromatic",
                strings: Vec::new(),
            });
        Self {
            smoother: Smoother::new(),
            detector: HybridPitchDetector::new(detector),
            resolver: FrameResolver::new(a4, tuning, frame_context),
            spectrum: (spectrum_bins > 0)
                .then(|| SpectrumAnalyzer::new(spectrum_fft_size, spectrum_bins)),
            spectrum_bins: configured_spectrum_bins,
            spectrum_fft_size,
            rms_gate: detector.rms_gate,
            hold_streak: 0,
            held_reading: None,
        }
    }

    fn clear_smoothing(&mut self) {
        self.smoother.reset();
        self.hold_streak = 0;
        self.held_reading = None;
    }

    pub fn set_a4(&mut self, a4: f32) {
        self.resolver.set_a4(a4);
        self.clear_smoothing();
    }

    pub fn set_tuning(&mut self, t: Tuning) {
        self.resolver.set_tuning(t);
        self.clear_smoothing();
    }

    pub fn set_frame_context(&mut self, context: Option<FrameContext>) {
        self.resolver.set_context(context);
        self.clear_smoothing();
    }

    pub fn set_detection_range(&mut self, min_frequency: f32, max_frequency: f32) {
        self.detector
            .set_frequency_range(min_frequency, max_frequency);
        self.clear_smoothing();
        self.resolver.reset();
    }

    pub fn set_spectrum_enabled(&mut self, enabled: bool) {
        match (enabled, self.spectrum.is_some()) {
            (true, false) => {
                self.spectrum = Some(SpectrumAnalyzer::new(
                    self.spectrum_fft_size,
                    self.spectrum_bins,
                ));
            }
            (false, true) => self.spectrum = None,
            _ => {}
        }
    }

    pub fn process(&mut self, buffer: &[f32], sample_rate: f32) -> DetectionFrame {
        let rms = signal::compute_rms_volume(buffer);
        let level = signal::normalize_level(rms);
        let mut estimate = self.detector.detect(buffer, sample_rate);
        let octave_correction_pending = self.detector.has_unconfirmed_octave_correction();
        let octave_correction_started = self.detector.take_octave_correction_started();
        if octave_correction_pending {
            // Confirmation deliberately costs one frame. Publishing the
            // provisional octave would seed smoothing with a value the
            // detector already suspects is wrong.
            estimate = None;
        }
        let raw_opt = estimate.map(|estimate| estimate.frequency);

        // Smooth the detected pitch to de-jitter the readout. A failed
        // detection while the signal is still above the gate (a decaying
        // string flickering around the detector's thresholds) rides on the
        // last smoothed reading for a few frames, keeping the smoother's
        // history alive so re-acquired values stay smoothed. True silence
        // clears immediately instead of lingering on a stale value.
        let (freq_opt, confidence) = if let Some(estimate) = estimate {
            if octave_correction_started {
                // The detector just confirmed that its prior octave was
                // wrong. Do not let that stale EMA fold the correction back.
                self.clear_smoothing();
            }
            self.hold_streak = 0;
            let smoothed = self.smoother.add(raw_opt);
            self.held_reading = smoothed.map(|frequency| (frequency, estimate.confidence));
            (smoothed, estimate.confidence)
        } else if rms >= self.rms_gate
            && self.held_reading.is_some()
            && self.hold_streak < DETECTION_HOLD_FRAMES
        {
            self.hold_streak += 1;
            let (frequency, held_confidence) = self.held_reading.unwrap_or_default();
            (Some(frequency), held_confidence)
        } else {
            self.clear_smoothing();
            (None, 0.0)
        };

        let is_power = if let Some(f) = freq_opt {
            is_likely_power_chord_native(buffer, sample_rate, f)
        } else {
            false
        };

        let resolution = self.resolver.resolve(freq_opt);

        let spectrum = self
            .spectrum
            .as_mut()
            .map(|analyzer| analyzer.analyze(buffer).to_vec())
            .unwrap_or_default();

        DetectionFrame {
            freq: freq_opt,
            confidence,
            rms,
            level,
            is_power,
            cents: resolution.cents,
            note: resolution.note,
            target: resolution.target,
            in_tune: resolution.in_tune,
            spectrum,
        }
    }

    pub fn reset(&mut self) {
        self.clear_smoothing();
        self.resolver.reset();
    }
}
