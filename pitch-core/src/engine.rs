use crate::{
    confidence::{ConfidenceEstimator, ConfidenceObservation},
    gate::AdaptiveSignalGate,
    tracking::PitchTracker,
};
use crate::{
    get_tunings, is_likely_power_chord_native, signal, DetectionFrame, DetectorConfig,
    FrameContext, FrameResolver, HybridPitchDetector, PipelineConfig, PipelineDecision,
    PipelineInterferenceTelemetry, SpectrumAnalyzer, Tuning,
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
    pub pipeline: PipelineConfig,
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
            pipeline: PipelineConfig::default(),
            tuning: None,
            spectrum_fft_size: DEFAULT_SPECTRUM_FFT_SIZE,
            spectrum_bins: DEFAULT_SPECTRUM_BINS,
        }
    }
}

pub struct TunerEngine {
    detector: HybridPitchDetector,
    confidence: ConfidenceEstimator,
    gate: AdaptiveSignalGate,
    resolver: FrameResolver,
    spectrum: Option<SpectrumAnalyzer>,
    spectrum_bins: usize,
    spectrum_fft_size: usize,
    rms_gate: f32,
    pipeline: PipelineConfig,
    tracker: PitchTracker,
    hold_streak: u8,
    held_reading: Option<(f32, f32)>,
}

impl TunerEngine {
    pub fn new(a4: f32) -> Self {
        Self::with_config(EngineConfig {
            a4,
            tuning: get_tunings().into_iter().next(),
            ..EngineConfig::default()
        })
    }

    pub fn with_config(config: EngineConfig) -> Self {
        let EngineConfig {
            a4,
            detector,
            frame_context,
            pipeline,
            tuning,
            spectrum_fft_size,
            spectrum_bins,
        } = config;
        let configured_spectrum_bins = if spectrum_bins == 0 {
            DEFAULT_SPECTRUM_BINS
        } else {
            spectrum_bins
        };
        let tuning = tuning.unwrap_or_else(|| Tuning {
            name: "Chromatic",
            strings: Vec::new(),
        });
        let pipeline = pipeline.normalized();
        let mut pitch_detector = HybridPitchDetector::new(detector);
        pitch_detector.set_pipeline_config(pipeline);
        Self {
            detector: pitch_detector,
            confidence: ConfidenceEstimator::default(),
            gate: AdaptiveSignalGate::new(detector.rms_gate, detector.peak_gate),
            resolver: FrameResolver::new(a4, tuning, frame_context),
            spectrum: (spectrum_bins > 0)
                .then(|| SpectrumAnalyzer::new(spectrum_fft_size, spectrum_bins)),
            spectrum_bins: configured_spectrum_bins,
            spectrum_fft_size,
            rms_gate: detector.rms_gate,
            pipeline,
            tracker: PitchTracker::new(),
            hold_streak: 0,
            held_reading: None,
        }
    }

    fn clear_tracking(&mut self) {
        self.tracker.reset();
        self.confidence.reset();
        self.hold_streak = 0;
        self.held_reading = None;
        self.resolver.reset();
    }

    fn reset_pipeline(&mut self) {
        self.clear_tracking();
        self.detector.reset_tracking_state();
        self.gate.reset();
    }

    pub fn set_a4(&mut self, a4: f32) {
        self.resolver.set_a4(a4);
        self.reset_pipeline();
    }

    pub fn set_tuning(&mut self, t: Tuning) {
        self.resolver.set_tuning(t);
        self.reset_pipeline();
    }

    pub fn set_frame_context(&mut self, context: Option<FrameContext>) {
        self.resolver.set_context(context);
        self.reset_pipeline();
    }

    pub fn set_detection_range(&mut self, min_frequency: f32, max_frequency: f32) {
        self.detector
            .set_frequency_range(min_frequency, max_frequency);
        self.reset_pipeline();
    }

    pub fn set_pipeline_config(&mut self, pipeline: PipelineConfig) {
        let pipeline = pipeline.normalized();
        if self.pipeline == pipeline {
            return;
        }
        self.pipeline = pipeline;
        self.detector.set_pipeline_config(pipeline);
        self.reset_pipeline();
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
        let signal_stats = signal::compute_centered_signal_stats(buffer);
        let level = signal::normalize_level(rms);
        let prior = self.resolver.tracking_prior();
        let mut estimate = self.detector.detect_guided(
            buffer,
            sample_rate,
            prior.selected_frequency(),
            prior.target_frequencies(),
        );
        let mut pipeline_telemetry = self.detector.telemetry();
        let interference_candidate = [pipeline_telemetry.yin, pipeline_telemetry.secondary]
            .into_iter()
            .flatten()
            .max_by(|left, right| left.confidence.total_cmp(&right.confidence));
        pipeline_telemetry.interference =
            interference_candidate.and_then(|candidate| {
                prior.competing_target(candidate.frequency).map(
                    |(selected, competing, distance)| PipelineInterferenceTelemetry {
                        candidate_frequency: candidate.frequency,
                        competing_target_frequency: competing,
                        distance_cents: distance,
                        selected_target_frequency: selected,
                    },
                )
            });
        // Diagnostic: what the detector itself said this frame, before any
        // suppression, gating, or tracking touches it.
        let raw_freq = estimate.map(|estimate| estimate.frequency);
        let octave_correction_pending = self.detector.has_unconfirmed_octave_correction();
        let octave_correction_started = self.detector.take_octave_correction_started();
        let gate_estimate = estimate;
        if octave_correction_pending {
            // Confirmation deliberately costs one frame. Publishing the
            // provisional octave would seed smoothing with a value the
            // detector already suspects is wrong.
            estimate = None;
            pipeline_telemetry.decision = PipelineDecision::OctavePending;
            // Keep the suspicion as a standalone flag: the decision below
            // may be overwritten by the readout outcome (e.g. Held while a
            // settled track rides out the suppressed frame), and the fact
            // that the detector doubted its own octave must survive that.
            pipeline_telemetry.octave_correction_pending = true;
        }

        let gate_open = !self.pipeline.adaptive_gate_enabled
            || self
                .gate
                .observe(signal_stats, gate_estimate, self.resolver.tracking_prior());
        pipeline_telemetry.adaptive_gate_open = gate_open;
        pipeline_telemetry.noise_floor = self.gate.noise_floor();
        pipeline_telemetry.gate_threshold = self.gate.threshold();

        // Track only coherent estimates. Brief detector dropouts ride on the
        // settled track while the signal remains open; sustained uncertainty
        // or a closed adaptive gate clears it before the next acquisition.
        let (freq_opt, detector_confidence) = if !gate_open {
            pipeline_telemetry.decision = PipelineDecision::AdaptiveGateRejected;
            self.clear_tracking();
            self.detector.reset_tracking_state();
            (None, 0.0)
        } else if let Some(estimate) = estimate {
            if octave_correction_started {
                // The detector just confirmed that its prior octave was
                // wrong. Start a fresh track at the corrected octave.
                self.clear_tracking();
            }
            let tracked = if self.pipeline.tracking_enabled {
                self.tracker
                    .update(estimate, self.resolver.tracking_prior())
                    .map(|tracked| (tracked.frequency, tracked.confidence))
            } else {
                Some((estimate.frequency, estimate.confidence))
            };
            if let Some((tracked_frequency, tracked_confidence)) = tracked {
                pipeline_telemetry.decision = PipelineDecision::Published;
                pipeline_telemetry.tracked = self.pipeline.tracking_enabled;
                self.hold_streak = 0;
                self.held_reading = Some((tracked_frequency, tracked_confidence));
                (Some(tracked_frequency), tracked_confidence)
            } else {
                pipeline_telemetry.decision = PipelineDecision::TrackingAcquiring;
                self.held_reading = None;
                (None, 0.0)
            }
        } else if self.pipeline.hold_enabled
            && signal_stats.rms >= self.rms_gate
            && self.held_reading.is_some()
            && self.hold_streak < DETECTION_HOLD_FRAMES
        {
            pipeline_telemetry.decision = PipelineDecision::Held;
            pipeline_telemetry.held = true;
            self.hold_streak += 1;
            let (frequency, held_confidence) = self.held_reading.unwrap_or_default();
            (Some(frequency), held_confidence)
        } else {
            self.clear_tracking();
            self.detector.reset_tracking_state();
            (None, 0.0)
        };

        let is_power = if self.pipeline.power_chord_enabled {
            freq_opt.is_some_and(|frequency| {
                is_likely_power_chord_native(buffer, sample_rate, frequency)
            })
        } else {
            false
        };

        let resolution = self.resolver.resolve(freq_opt);

        pipeline_telemetry.confidence = self.confidence.observe(ConfidenceObservation {
            decision: pipeline_telemetry.decision,
            noise_floor: pipeline_telemetry.noise_floor,
            output_confidence: detector_confidence,
            raw_frequency: raw_freq,
            rms: signal_stats.rms,
            secondary: pipeline_telemetry.secondary,
            yin: pipeline_telemetry.yin,
        });
        let confidence = freq_opt
            .map(|_| pipeline_telemetry.confidence.calibrated)
            .unwrap_or(0.0);

        let spectrum = self
            .spectrum
            .as_mut()
            .map(|analyzer| analyzer.analyze(buffer).to_vec())
            .unwrap_or_default();

        DetectionFrame {
            freq: freq_opt,
            raw_freq,
            confidence,
            rms,
            level,
            is_power,
            cents: resolution.cents,
            note: resolution.note,
            target: resolution.target,
            in_tune: resolution.in_tune,
            pipeline: pipeline_telemetry,
            spectrum,
        }
    }

    pub fn reset(&mut self) {
        self.reset_pipeline();
    }
}
