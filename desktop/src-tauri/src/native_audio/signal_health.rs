//! Signal-quality watchdog for the native audio stream.
//!
//! Emits the same stable diagnostic codes as the shared cross-platform
//! contract (web/src/domain/diagnostics.ts): the web shell matches these
//! codes by name and renders localized actionable hints for them. Keep the
//! thresholds and code strings in sync with that contract.

use pitch_core::{FIXED_GATE_PEAK, FIXED_GATE_RMS};

pub(crate) const SIGNAL_SILENT: &str = "signal-silent";
pub(crate) const SIGNAL_CLIPPING: &str = "signal-clipping";
pub(crate) const SIGNAL_DC_OFFSET: &str = "signal-dc-offset";
pub(crate) const SIGNAL_HUM: &str = "signal-hum";

const HUM_CANDIDATE_FREQUENCIES: [f32; 2] = [50.0, 60.0];
const HUM_ANALYSIS_MAX_SAMPLES: usize = 16384;
/// The hum component must carry at least this share of the signal RMS.
const HUM_DOMINANCE_RATIO: f32 = 0.35;
/// Absolute amplitude floor so near-silence never reports hum.
const HUM_MIN_AMPLITUDE: f32 = 0.005;
/// Peak at/above this fraction of full scale is treated as clipping.
const CLIPPING_PEAK_THRESHOLD: f32 = 0.97;
/// |mean| at/above this value means a harmful DC offset.
const DC_OFFSET_THRESHOLD: f32 = 0.02;

/// Evaluate signal health for one analysis window and return the stable
/// diagnostic codes that apply, in contract order.
pub(crate) fn signal_health_codes(samples: &[f32], sample_rate: f32) -> Vec<&'static str> {
    if samples.is_empty() || !sample_rate.is_finite() || sample_rate <= 0.0 {
        return vec![SIGNAL_SILENT];
    }
    let mut sum = 0.0f32;
    let mut sum_sq = 0.0f32;
    let mut peak = 0.0f32;
    for &sample in samples {
        sum += sample;
        sum_sq += sample * sample;
        peak = peak.max(sample.abs());
    }
    let length = samples.len() as f32;
    let dc_offset = sum / length;
    let rms = (sum_sq / length).sqrt();

    // Silence masks every other signal-quality finding.
    if rms < FIXED_GATE_RMS && peak < FIXED_GATE_PEAK {
        return vec![SIGNAL_SILENT];
    }

    let mut codes = Vec::new();
    if peak >= CLIPPING_PEAK_THRESHOLD {
        codes.push(SIGNAL_CLIPPING);
    }
    if dc_offset.abs() >= DC_OFFSET_THRESHOLD {
        codes.push(SIGNAL_DC_OFFSET);
    }

    let window = samples.len().min(HUM_ANALYSIS_MAX_SAMPLES);
    let mut hum_amplitude = 0.0f32;
    for &candidate in &HUM_CANDIDATE_FREQUENCIES {
        hum_amplitude = hum_amplitude.max(goertzel_amplitude(
            &samples[..window],
            sample_rate,
            candidate,
        ));
    }
    if rms > 0.0 && hum_amplitude / rms >= HUM_DOMINANCE_RATIO && hum_amplitude >= HUM_MIN_AMPLITUDE
    {
        codes.push(SIGNAL_HUM);
    }
    codes
}

/// Single-bin Goertzel amplitude estimate (2|G|/N) for `frequency`.
fn goertzel_amplitude(samples: &[f32], sample_rate: f32, frequency: f32) -> f32 {
    let coefficient = 2.0 * (2.0 * std::f32::consts::PI * frequency / sample_rate).cos();
    let mut previous = 0.0f32;
    let mut before_previous = 0.0f32;
    for &sample in samples {
        let current = sample + coefficient * previous - before_previous;
        before_previous = previous;
        previous = current;
    }
    let power = before_previous * before_previous + previous * previous
        - coefficient * previous * before_previous;
    2.0 * power.max(0.0).sqrt() / samples.len() as f32
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_RATE: f32 = 48_000.0;

    fn sine(frequency: f32, amplitude: f32, samples: usize) -> Vec<f32> {
        (0..samples)
            .map(|index| {
                amplitude
                    * (2.0 * std::f32::consts::PI * frequency * index as f32 / SAMPLE_RATE).sin()
            })
            .collect()
    }

    #[test]
    fn silence_reports_signal_silent() {
        let codes = signal_health_codes(&vec![0.0; 8192], SAMPLE_RATE);
        assert_eq!(codes, vec![SIGNAL_SILENT]);
    }

    #[test]
    fn clipping_reports_signal_clipping() {
        // A 440 Hz sine driven past full scale.
        let samples = sine(440.0, 1.2, 8192)
            .into_iter()
            .map(|sample| sample.clamp(-1.0, 1.0))
            .collect::<Vec<_>>();
        let codes = signal_health_codes(&samples, SAMPLE_RATE);
        assert!(codes.contains(&SIGNAL_CLIPPING), "{codes:?}");
    }

    #[test]
    fn dc_offset_reports_signal_dc_offset() {
        let mut samples = sine(440.0, 0.2, 8192);
        for sample in &mut samples {
            *sample += 0.05;
        }
        let codes = signal_health_codes(&samples, SAMPLE_RATE);
        assert!(codes.contains(&SIGNAL_DC_OFFSET), "{codes:?}");
        assert!(!codes.contains(&SIGNAL_CLIPPING), "{codes:?}");
    }

    #[test]
    fn mains_hum_reports_signal_hum() {
        // 50 Hz hum with a quiet 440 Hz tone on top.
        let mut samples = sine(50.0, 0.1, 8192);
        for (index, sample) in samples.iter_mut().enumerate() {
            *sample +=
                0.01 * (2.0 * std::f32::consts::PI * 440.0 * index as f32 / SAMPLE_RATE).sin();
        }
        let codes = signal_health_codes(&samples, SAMPLE_RATE);
        assert_eq!(codes, vec![SIGNAL_HUM]);
    }

    #[test]
    fn clean_tone_reports_no_codes() {
        let samples = sine(440.0, 0.3, 8192);
        let codes = signal_health_codes(&samples, SAMPLE_RATE);
        assert!(codes.is_empty(), "{codes:?}");
    }
}
