//! Multi-window ("lane") analysis configuration and lane selection.
//!
//! The host always feeds the engine a fixed-size frame (8192 samples in
//! every shipped client). The engine keeps one detector lane per configured
//! analysis window; a lane shorter than the frame analyzes the *tail* of the
//! frame, so a high note can be locked from the most recent 2048 samples
//! (~43 ms at 48 kHz) instead of waiting for a full 8192-sample window
//! (~171 ms). The default set is a single 8192-sample lane, which is
//! bit-for-bit the historical behavior.
//!
//! Lane choice is a pure function of the musical frequency we are looking
//! for:
//!
//! - **Guided** (a string is selected): the smallest lane that still fits at
//!   least [`MIN_PERIODS_IN_WINDOW`] periods of the selected target.
//! - **Chromatic** (no selected string): before the first lock the longest
//!   lane runs (maximum low-frequency reach); once the tracker holds a
//!   frequency, the lane follows it with a hysteresis band (in above
//!   ~345 Hz, out below ~326 Hz at 48 kHz / 2048 samples) so a note
//!   hovering near the boundary cannot make the lane flap.

/// Minimum number of full periods of the target frequency that must fit
/// inside a lane's window for the lane to be considered sufficient.
const MIN_PERIODS_IN_WINDOW: f32 = 10.0;

/// The bare 10-period limit is shifted up by this ratio to form the center
/// of the chromatic switching band. At 48 kHz with a 2048-sample lane the
/// center lands at ~335 Hz (promote above ~345 Hz, demote below ~326 Hz).
///
/// Deviation from the original design note (which sketched a ~253 Hz
/// center, enter 262 / exit 245): the quality corpus showed E4-class notes
/// (329.6 Hz) losing > 0.5 cents MAE under SNR-10 when they rode the 2048
/// lane — a decaying real timbre on 14 periods is measurably less accurate
/// than on 56. Moving the band above E4 keeps those notes on the long lane
/// while F4 (349 Hz) and up still get the fast lane (the short lane fixes
/// the 21-cent voice-F4 sustain smear, so it must stay reachable there).
/// Guided mode is unaffected: a selected string still picks its lane
/// directly from the 10-period rule.
const SWITCH_CENTER_RATIO: f32 = 1.43;

/// Half-width of the chromatic switching hysteresis, in cents: promote
/// above center×2^(+50/1200), demote below center×2^(−50/1200). The
/// ~100-cent dead zone absorbs tracker jitter and slow drift through the
/// boundary, so the lane cannot flap.
const HYSTERESIS_CENTS: f32 = 50.0;

/// Absolute smallest lane window: the phase refiner needs at least 512
/// samples, and anything shorter is musically useless for pitch.
pub const MIN_LANE_WINDOW_SAMPLES: usize = 512;

/// Default analysis window when the host does not configure lanes. Matches
/// the historical fixed engine window.
pub const DEFAULT_WINDOW_SAMPLES: usize = 8192;

/// Ordered (ascending), deduplicated set of analysis window lengths. One
/// detector lane is constructed per entry.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AnalysisWindowSet {
    windows: Vec<usize>,
}

impl Default for AnalysisWindowSet {
    fn default() -> Self {
        Self {
            windows: vec![DEFAULT_WINDOW_SAMPLES],
        }
    }
}

impl AnalysisWindowSet {
    /// Normalizes `windows`: drops entries below [`MIN_LANE_WINDOW_SAMPLES`],
    /// sorts ascending, dedups. Falls back to the default single lane when
    /// nothing valid remains, so construction never fails and the hot path
    /// never deals with an empty set.
    pub fn new(windows: impl IntoIterator<Item = usize>) -> Self {
        let mut windows: Vec<usize> = windows
            .into_iter()
            .filter(|window| *window >= MIN_LANE_WINDOW_SAMPLES)
            .collect();
        windows.sort_unstable();
        windows.dedup();
        if windows.is_empty() {
            return Self::default();
        }
        Self { windows }
    }

    /// Window lengths in ascending order. Never empty.
    pub fn windows(&self) -> &[usize] {
        &self.windows
    }

    pub fn is_single(&self) -> bool {
        self.windows.len() == 1
    }
}

/// Lowest frequency (Hz) a lane of `window` samples at `sample_rate` can
/// analyze: [`MIN_PERIODS_IN_WINDOW`] periods must fit inside the window.
fn lane_min_frequency(window: usize, sample_rate: f32) -> f32 {
    MIN_PERIODS_IN_WINDOW * sample_rate / window as f32
}

/// Center of the chromatic switching band for a lane (see
/// [`SWITCH_CENTER_RATIO`]).
fn switch_center(window: usize, sample_rate: f32) -> f32 {
    lane_min_frequency(window, sample_rate) * SWITCH_CENTER_RATIO
}

/// Tracked frequency must exceed this to promote into `window`'s lane.
fn enter_threshold(window: usize, sample_rate: f32) -> f32 {
    switch_center(window, sample_rate) * 2.0_f32.powf(HYSTERESIS_CENTS / 1_200.0)
}

/// Tracked frequency must fall below this to demote out of `window`'s lane.
fn exit_threshold(window: usize, sample_rate: f32) -> f32 {
    switch_center(window, sample_rate) * 2.0_f32.powf(-HYSTERESIS_CENTS / 1_200.0)
}

/// Lane for a known target frequency: the smallest lane that still fits
/// [`MIN_PERIODS_IN_WINDOW`] periods of `frequency`. Falls back to the
/// longest lane when the frequency is below every lane's reach.
///
/// `windows` are ascending; the returned value is an index into them.
pub(crate) fn select_lane_for_frequency(
    windows: &[usize],
    frequency: f32,
    sample_rate: f32,
) -> usize {
    debug_assert!(!windows.is_empty());
    if frequency.is_finite() && frequency > 0.0 && sample_rate.is_finite() && sample_rate > 0.0 {
        for (index, window) in windows.iter().enumerate() {
            if frequency >= lane_min_frequency(*window, sample_rate) {
                return index;
            }
        }
    }
    windows.len() - 1
}

/// Chromatic lane following with hysteresis. `current` is the lane used for
/// the previous frame; `tracked` is the last tracked frequency. The lane
/// only changes when the tracked frequency crosses the far edge of the
/// hysteresis band, so values hovering inside the band keep the current
/// lane (no flapping).
pub(crate) fn select_chromatic_lane(
    windows: &[usize],
    current: usize,
    tracked: f32,
    sample_rate: f32,
) -> usize {
    debug_assert!(!windows.is_empty());
    let mut lane = current.min(windows.len() - 1);
    // Demote toward longer windows while the track sits below this lane's
    // exit edge.
    while lane + 1 < windows.len() && tracked < exit_threshold(windows[lane], sample_rate) {
        lane += 1;
    }
    // Promote toward shorter windows while the track sits above the next
    // shorter lane's enter edge.
    while lane > 0 && tracked > enter_threshold(windows[lane - 1], sample_rate) {
        lane -= 1;
    }
    lane
}

#[cfg(test)]
mod tests {
    use super::*;

    const SR: f32 = 48_000.0;
    const DUAL: [usize; 2] = [2_048, 8_192];

    #[test]
    fn default_is_a_single_8192_lane() {
        let set = AnalysisWindowSet::default();
        assert_eq!(set.windows(), &[8_192]);
        assert!(set.is_single());
    }

    #[test]
    fn new_normalizes_and_never_empties() {
        assert_eq!(
            AnalysisWindowSet::new([8_192, 2_048, 2_048]).windows(),
            DUAL
        );
        assert_eq!(AnalysisWindowSet::new([128, 256]).windows(), &[8_192]);
        assert_eq!(AnalysisWindowSet::new([]).windows(), &[8_192]);
    }

    #[test]
    fn guided_picks_the_smallest_lane_with_ten_periods() {
        // 2048 @ 48 kHz fits 10 periods down to ~234.4 Hz.
        assert_eq!(select_lane_for_frequency(&DUAL, 440.0, SR), 0);
        assert_eq!(select_lane_for_frequency(&DUAL, 234.5, SR), 0);
        // 234.3 Hz needs more than 2048 samples for 10 periods.
        assert_eq!(select_lane_for_frequency(&DUAL, 234.3, SR), 1);
        assert_eq!(select_lane_for_frequency(&DUAL, 82.4, SR), 1);
        // Garbage input defers to the longest lane.
        assert_eq!(select_lane_for_frequency(&DUAL, f32::NAN, SR), 1);
        assert_eq!(select_lane_for_frequency(&DUAL, -5.0, SR), 1);
    }

    #[test]
    fn chromatic_enters_short_above_345_and_exits_below_326() {
        // Band edges at 48 kHz / 2048 samples (see SWITCH_CENTER_RATIO).
        let short = 0usize;
        let long = 1usize;
        assert_eq!(select_chromatic_lane(&DUAL, long, 392.0, SR), short);
        assert_eq!(select_chromatic_lane(&DUAL, long, 345.5, SR), short);
        // Inside the dead zone the lane does not move, from either side.
        assert_eq!(select_chromatic_lane(&DUAL, long, 335.0, SR), long);
        assert_eq!(select_chromatic_lane(&DUAL, short, 335.0, SR), short);
        // E4 (329.6 Hz) inside the band: holds whichever lane it had.
        assert_eq!(select_chromatic_lane(&DUAL, long, 329.63, SR), long);
        assert_eq!(select_chromatic_lane(&DUAL, short, 329.63, SR), short);
        assert_eq!(select_chromatic_lane(&DUAL, short, 326.0, SR), short);
        assert_eq!(select_chromatic_lane(&DUAL, short, 325.0, SR), long);
        assert_eq!(select_chromatic_lane(&DUAL, short, 293.66, SR), long);
    }

    #[test]
    fn chromatic_band_edges_do_not_overlap() {
        // enter(short) must sit strictly above exit(short), or the two
        // while-loops could fight.
        assert!(enter_threshold(2_048, SR) > exit_threshold(2_048, SR));
    }

    #[test]
    fn flicker_inside_the_band_never_changes_the_lane() {
        // A track oscillating 330↔340 Hz (inside 325.6..345) must hold
        // whichever lane it started in, forever.
        for start in [0usize, 1] {
            let mut lane = start;
            for frame in 0..1_000 {
                let tracked = if frame % 2 == 0 { 330.0 } else { 340.0 };
                let next = select_chromatic_lane(&DUAL, lane, tracked, SR);
                assert_eq!(next, lane, "lane flapped at frame {frame}");
                lane = next;
            }
        }
    }

    #[test]
    fn lane_out_of_range_current_is_clamped() {
        assert_eq!(select_chromatic_lane(&DUAL, 7, 440.0, SR), 0);
        assert_eq!(select_chromatic_lane(&DUAL, 7, 100.0, SR), 1);
    }
}
