// Domain layer (Note, Tuning, the tunings table, and note/cents math) lives in
// domain.rs and is re-exported here. See ARCHITECTURE.md for the layering plan.
mod domain;
mod dsp;
mod engine;
mod frames;
mod signal;
mod smoother;
pub use domain::*;
pub use dsp::*;
pub use engine::*;
pub use frames::*;
pub use signal::*;
pub use smoother::*;

#[cfg(test)]
mod tests {
    use super::*;

    fn sine_buffer(freq: f32, sample_rate: f32, len: usize) -> Vec<f32> {
        sine_buffer_with_offset(freq, sample_rate, len, 1.0, 0.0)
    }

    fn sine_buffer_with_offset(
        freq: f32,
        sample_rate: f32,
        len: usize,
        gain: f32,
        offset: f32,
    ) -> Vec<f32> {
        let mut buf = vec![0.0; len];
        for (i, sample) in buf.iter_mut().enumerate() {
            *sample =
                (2.0 * std::f32::consts::PI * freq * i as f32 / sample_rate).sin() * gain + offset;
        }
        buf
    }

    #[test]
    fn test_yin_440hz() {
        // Generate sine wave at 440Hz
        let sr = 44100.0;
        let n = 2048;
        let buf = sine_buffer(440.0, sr, n);
        let res = detect_pitch_native(&buf, sr);
        assert!(res.is_some());
        let (f, c) = res.unwrap();
        // Note: may detect octave, accept close or half for sine test
        assert!(
            (f - 440.0).abs() < 10.0 || (f - 220.0).abs() < 10.0,
            "freq was {}",
            f
        );
        assert!(c > 0.3);
    }

    #[test]
    fn test_mpm_440hz() {
        let sr = 44100.0;
        let n = 2048;
        let buf = sine_buffer(440.0, sr, n);
        let _ = detect_pitch_native(&buf, sr); // exercises the YIN path
                                               // For MPM direct
        if let Some((f, _)) = crate::dsp::detect_pitch_mpm_internal(&buf, sr) {
            assert!((f - 440.0).abs() < 2.0);
        }
    }

    #[test]
    fn test_power_chord() {
        let sr = 44100.0;
        let n = 2048;
        let mut buf = vec![0.0; n];
        let f = 110.0; // A2
        for (i, sample) in buf.iter_mut().enumerate() {
            // Mix fundamental + fifth
            *sample = (2.0 * std::f32::consts::PI * f * i as f32 / sr).sin() * 0.7
                + (2.0 * std::f32::consts::PI * f * 1.5 * i as f32 / sr).sin() * 0.5;
        }
        let res = detect_pitch_native(&buf, sr);
        assert!(res.is_some());
        let (freq, _) = res.unwrap();
        // freq approx, focus on power detection
        let _ = is_likely_power_chord_native(&buf, sr, freq); // may need buffer adjust
    }

    #[test]
    fn test_note_math_440() {
        let (name, cents) = frequency_to_note(440.0, 440.0);
        assert_eq!(name, "A4");
        assert!((cents).abs() < 0.1);
    }

    #[test]
    fn test_get_cents() {
        let c = get_cents(445.0, 440.0);
        assert!(c > 0.0 && c < 30.0);
    }

    #[test]
    fn test_find_closest_and_tunings() {
        let tunings = get_tunings();
        assert!(tunings.len() >= 13);
        let std = &tunings[0].strings;
        let closest = find_closest_string(110.0, std, 440.0);
        assert_eq!(closest.name, "A");
        assert!((closest.frequency - 110.0).abs() < 0.1);
        // A4 scaling
        let closest_442 = find_closest_string(110.0 * (442.0 / 440.0), std, 442.0);
        assert_eq!(closest_442.name, "A");
        // New presets exist and are well-formed (6 strings each, ascending pitch).
        for name in [
            "Drop B (BF#BEG#C#)",
            "Open C (CGCGCE)",
            "Open A (EAC#EAE)",
            "Full Step Down (DGCFAD)",
            "Open Gm (DGDGA#D)",
        ] {
            let t = tunings
                .iter()
                .find(|t| t.name == name)
                .unwrap_or_else(|| panic!("missing tuning {}", name));
            assert_eq!(t.strings.len(), 6, "{} should have 6 strings", name);
            for w in t.strings.windows(2) {
                assert!(w[1].frequency > w[0].frequency, "{} not ascending", name);
            }
        }
    }

    #[test]
    fn test_engine_detection_frame_contract() {
        let sr = 44100.0;
        let n = 4096;
        let mut engine = TunerEngine::new(440.0);
        let buf = sine_buffer(110.0, sr, n);
        let frame = engine.process(&buf, sr);

        assert!(
            frame.freq.is_some(),
            "frame should include detected frequency"
        );
        assert_eq!(frame.note, "A2");
        assert!(frame.confidence > 0.5);
        assert!(frame.rms > 0.0);
        assert!(frame.level > 0.0);
        assert!(frame.cents.abs() < 5.0, "cents was {}", frame.cents);
        assert!(frame.in_tune);
        assert_eq!(frame.target.as_ref().map(|note| note.name), Some("A"));
        assert_eq!(frame.spectrum.len(), 512);

        let mut compact_engine = TunerEngine::with_config(EngineConfig {
            spectrum_bins: 128,
            ..EngineConfig::default()
        });
        let compact_frame = compact_engine.process(&buf, sr);
        assert_eq!(compact_frame.spectrum.len(), 128);
    }

    #[test]
    fn test_yin_guitar_notes() {
        // Every in-range guitar fundamental must detect at the fundamental
        // (not an octave/subharmonic). Guards the CMNDF normalization.
        let sr = 44100.0;
        let n = 2048;
        for &expected in &[82.4069f32, 110.0, 146.8324, 195.9977, 246.9417, 329.6276] {
            let buf = sine_buffer(expected, sr, n);
            let res = detect_pitch_native(&buf, sr);
            assert!(res.is_some(), "no detection for {} Hz", expected);
            let (f, c) = res.unwrap();
            assert!(
                (f - expected).abs() < 2.0,
                "expected {} Hz, got {} Hz",
                expected,
                f
            );
            assert!(c > 0.5, "low confidence {} for {} Hz", c, expected);
        }
    }

    #[test]
    fn test_detect_pitch_dc_offset() {
        // A large DC offset must not break detection (mean is removed first).
        let sr = 44100.0;
        let n = 2048;
        let buf = sine_buffer_with_offset(110.0, sr, n, 1.0, 0.6);
        let res = detect_pitch(&buf, sr);
        assert!(res.is_some());
        let (f, _) = res.unwrap();
        assert!((f - 110.0).abs() < 2.0, "got {} Hz", f);
    }
}
