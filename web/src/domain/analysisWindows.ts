// Multi-window ("lane") selection for the TypeScript fallback detector.
// Mirrors pitch-core/src/windows.rs semantics exactly; all constants come
// from the generated mirror (generated/analysisWindows.ts), which
// `npm run codegen:check` keeps in lockstep with the Rust source of truth.
//
// Lane choice is a pure function of the musical frequency we are looking
// for:
// - Guided (a string is selected): the smallest lane that still fits at
//   least `minPeriodsInWindow` periods of the selected target.
// - Chromatic (no selected string): before the first lock the longest lane
//   runs; once the tracker holds a frequency, the lane follows it with a
//   hysteresis band (in above ~345 Hz, out below ~326 Hz at 48 kHz / 2048
//   samples) so a note hovering near the boundary cannot make the lane flap.
//
// Note: the detection cadence (~33 ms hop) is intentionally unchanged on the
// short lane, matching the Rust hosts. Shortening the hop for the 2048 lane
// is a separate later task.

import { ANALYSIS_WINDOWS } from '../generated/analysisWindows';

const MIN_PERIODS_IN_WINDOW = ANALYSIS_WINDOWS.minPeriodsInWindow;
const SWITCH_CENTER_RATIO = ANALYSIS_WINDOWS.switchCenterRatio;
const HYSTERESIS_CENTS = ANALYSIS_WINDOWS.hysteresisCents;

/** Normalized, ascending analysis window set (never empty). */
export const STANDARD_ANALYSIS_WINDOWS: readonly number[] = normalizeAnalysisWindows(
  ANALYSIS_WINDOWS.standardWindows,
);

/**
 * Mirrors `AnalysisWindowSet::new`: drops lanes below the absolute minimum,
 * sorts ascending, dedups, and falls back to the default single lane when
 * nothing valid remains.
 */
export function normalizeAnalysisWindows(windows: readonly number[]): number[] {
  const normalized = [...new Set(
    windows.filter((window) => window >= ANALYSIS_WINDOWS.minLaneWindowSamples),
  )].sort((left, right) => left - right);
  return normalized.length > 0 ? normalized : [ANALYSIS_WINDOWS.defaultWindowSamples];
}

/** Lowest frequency (Hz) a lane of `windowSamples` at `sampleRate` can analyze. */
export function laneMinFrequency(windowSamples: number, sampleRate: number): number {
  return (MIN_PERIODS_IN_WINDOW * sampleRate) / windowSamples;
}

function switchCenter(windowSamples: number, sampleRate: number): number {
  return laneMinFrequency(windowSamples, sampleRate) * SWITCH_CENTER_RATIO;
}

/** Tracked frequency must exceed this to promote into this lane. */
export function laneEnterThreshold(windowSamples: number, sampleRate: number): number {
  return switchCenter(windowSamples, sampleRate) * 2 ** (HYSTERESIS_CENTS / 1_200);
}

/** Tracked frequency must fall below this to demote out of this lane. */
export function laneExitThreshold(windowSamples: number, sampleRate: number): number {
  return switchCenter(windowSamples, sampleRate) * 2 ** (-HYSTERESIS_CENTS / 1_200);
}

/**
 * Lane for a known target frequency: the smallest lane that still fits
 * `minPeriodsInWindow` periods of `frequency`. Falls back to the longest lane
 * when the frequency is below every lane's reach. Mirrors the Rust
 * `select_lane_for_frequency`; `windows` are ascending, the return value is
 * an index into them.
 */
export function selectLaneForFrequency(
  windows: readonly number[],
  frequency: number,
  sampleRate: number,
): number {
  if (Number.isFinite(frequency) && frequency > 0 && Number.isFinite(sampleRate) && sampleRate > 0) {
    for (let index = 0; index < windows.length; index += 1) {
      if (frequency >= laneMinFrequency(windows[index], sampleRate)) return index;
    }
  }
  return windows.length - 1;
}

/**
 * Chromatic lane following with hysteresis. `current` is the lane used for
 * the previous frame; `tracked` is the last tracked frequency. The lane only
 * changes when the tracked frequency crosses the far edge of the hysteresis
 * band, so values hovering inside the band keep the current lane (no
 * flapping). Mirrors the Rust `select_chromatic_lane`.
 */
export function selectChromaticLane(
  windows: readonly number[],
  current: number,
  tracked: number,
  sampleRate: number,
): number {
  let lane = Math.min(current, windows.length - 1);
  // Demote toward longer windows while the track sits below this lane's
  // exit edge.
  while (lane + 1 < windows.length && tracked < laneExitThreshold(windows[lane], sampleRate)) {
    lane += 1;
  }
  // Promote toward shorter windows while the track sits above the next
  // shorter lane's enter edge.
  while (lane > 0 && tracked > laneEnterThreshold(windows[lane - 1], sampleRate)) {
    lane -= 1;
  }
  return lane;
}

/**
 * Stateful lane selector mirroring the engine's per-frame branch: guided by
 * the selected target when present, otherwise chromatic hysteresis following
 * the settled track, otherwise (no lock yet) the longest lane.
 */
export class AnalysisLaneSelector {
  readonly windows: readonly number[];
  private activeLane: number;

  constructor(windows: readonly number[] = STANDARD_ANALYSIS_WINDOWS) {
    this.windows = normalizeAnalysisWindows(windows);
    // Until the first lock the longest lane runs: it has the deepest
    // low-frequency reach and no track exists to follow yet.
    this.activeLane = this.windows.length - 1;
  }

  reset() {
    this.activeLane = this.windows.length - 1;
  }

  /** Index of the longest lane. */
  get longestLaneIndex() {
    return this.windows.length - 1;
  }

  selectLane(
    sampleRate: number,
    selectedFrequency?: number | null,
    trackedFrequency?: number | null,
  ): number {
    if (this.windows.length <= 1) {
      this.activeLane = 0;
      return 0;
    }
    if (isValidFrequency(selectedFrequency)) {
      // Guided: the target string is known, so the smallest lane that fits
      // ten of its periods is always the right one.
      this.activeLane = selectLaneForFrequency(this.windows, selectedFrequency, sampleRate);
    } else if (isValidFrequency(trackedFrequency)) {
      // Chromatic: follow the settled track with a hysteresis band so
      // boundary notes cannot flap the lane.
      this.activeLane = selectChromaticLane(
        this.windows,
        this.activeLane,
        trackedFrequency,
        sampleRate,
      );
    } else {
      // No lock yet: the longest lane has the deepest reach.
      this.activeLane = this.windows.length - 1;
    }
    return this.activeLane;
  }
}

function isValidFrequency(value: number | null | undefined): value is number {
  return Number.isFinite(value) && (value ?? 0) > 0;
}
