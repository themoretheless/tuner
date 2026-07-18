//! Pure offline evaluation for timestamped pitch observations.
//!
//! This module consumes published trace values and never participates in the
//! realtime detector, tracker, or resolver path.

mod evaluator;
mod thresholds;
mod types;
mod validation;

pub use evaluator::evaluate_pitch_quality;
pub use thresholds::evaluate_quality_thresholds;
pub use types::*;
