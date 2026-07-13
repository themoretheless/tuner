mod candidates;
mod detector;
mod harmonic;
mod mpm;
mod octave;
mod power;
mod spectral;
mod yin;

pub(crate) use candidates::{prefer_guided_harmonic, select_pitch_candidate, PitchGuidance};
pub use detector::{
    DetectorConfig, HybridPitchDetector, PitchDetector, PitchEstimate, MIN_USABLE_CONFIDENCE,
};
pub(crate) use harmonic::HarmonicPitchDetector;
pub use mpm::MpmDetector;
pub use octave::OctaveDisambiguator;
pub use yin::YinDetector;

pub fn detect_pitch(buffer: &[f32], sample_rate: f32) -> Option<(f32, f32)> {
    let mut detector = HybridPitchDetector::default();
    detector
        .detect(buffer, sample_rate)
        .map(PitchEstimate::into_tuple)
}

pub fn detect_pitch_native(buffer: &[f32], sample_rate: f32) -> Option<(f32, f32)> {
    detect_pitch(buffer, sample_rate)
}

pub fn is_likely_power_chord_native(buffer: &[f32], sample_rate: f32, fundamental: f32) -> bool {
    power::is_likely_power_chord(buffer, sample_rate, fundamental)
}
