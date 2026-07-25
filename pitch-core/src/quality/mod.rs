//! Pure offline evaluation for timestamped pitch observations.
//!
//! This module consumes published trace values and never participates in the
//! realtime detector, tracker, or resolver path.

mod evaluator;
mod noise;
mod reverb;
mod thresholds;
mod types;
mod validation;

pub use evaluator::evaluate_pitch_quality;
pub use noise::mix_white_noise_at_snr;
pub use reverb::{apply_reverb, convolve, reverb_seed, synthesize_impulse_response};
pub use thresholds::evaluate_quality_thresholds;
pub use types::*;
