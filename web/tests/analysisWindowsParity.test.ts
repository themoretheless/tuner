// Parity: the TypeScript fallback lane selection must mirror
// pitch-core/src/windows.rs exactly. The expected values below duplicate the
// Rust unit-test vectors (48 kHz, [2048, 8192] lanes) so any drift between
// the generated mirror and the Rust source of truth fails here and in
// `npm run codegen:check`.
import { describe, expect, it, vi } from 'vitest';

import {
  AnalysisLaneSelector,
  laneEnterThreshold,
  laneExitThreshold,
  laneMinFrequency,
  normalizeAnalysisWindows,
  selectChromaticLane,
  selectLaneForFrequency,
  STANDARD_ANALYSIS_WINDOWS,
} from '../src/domain/analysisWindows';
import { ANALYSIS_WINDOWS } from '../src/generated/analysisWindows';
import {
  PitchCoreAdapter,
  type FallbackPitchDetector,
} from '../src/workers/pitchCoreAdapter';
import type { FrameContext } from '../src/types/frames';

const SR = 48_000;
const DUAL = [2_048, 8_192] as const;
const SHORT = 0;
const LONG = 1;

describe('analysis windows mirror (Rust windows.rs parity)', () => {
  it('exposes the canonical dual-lane set from the generated mirror', () => {
    expect(ANALYSIS_WINDOWS.standardWindows).toEqual([2_048, 8_192]);
    expect(STANDARD_ANALYSIS_WINDOWS).toEqual([2_048, 8_192]);
    expect(ANALYSIS_WINDOWS.minPeriodsInWindow).toBe(10);
    expect(ANALYSIS_WINDOWS.switchCenterRatio).toBeCloseTo(1.43);
    expect(ANALYSIS_WINDOWS.hysteresisCents).toBe(50);
    expect(ANALYSIS_WINDOWS.minLaneWindowSamples).toBe(512);
    expect(ANALYSIS_WINDOWS.defaultWindowSamples).toBe(8_192);
  });

  it('normalizes like AnalysisWindowSet::new (sort, dedup, min, fallback)', () => {
    expect(normalizeAnalysisWindows([8_192, 2_048, 2_048])).toEqual([2_048, 8_192]);
    expect(normalizeAnalysisWindows([128, 256])).toEqual([8_192]);
    expect(normalizeAnalysisWindows([])).toEqual([8_192]);
  });

  it('computes the 10-period lane reach like the Rust lane_min_frequency', () => {
    // 2048 @ 48 kHz fits 10 periods down to ~234.4 Hz.
    expect(laneMinFrequency(2_048, SR)).toBeCloseTo(234.375);
    expect(laneMinFrequency(8_192, SR)).toBeCloseTo(58.593_75);
  });

  it('places the chromatic band edges at ~345/~326 Hz like the Rust core', () => {
    expect(laneEnterThreshold(2_048, SR)).toBeCloseTo(345.0, 0);
    expect(laneExitThreshold(2_048, SR)).toBeCloseTo(325.6, 0);
    expect(laneEnterThreshold(2_048, SR)).toBeGreaterThan(laneExitThreshold(2_048, SR));
  });

  it('guided mode picks the smallest lane with ten periods (Rust vectors)', () => {
    expect(selectLaneForFrequency(DUAL, 440, SR)).toBe(SHORT);
    expect(selectLaneForFrequency(DUAL, 234.5, SR)).toBe(SHORT);
    // 234.3 Hz needs more than 2048 samples for 10 periods.
    expect(selectLaneForFrequency(DUAL, 234.3, SR)).toBe(LONG);
    expect(selectLaneForFrequency(DUAL, 100, SR)).toBe(LONG);
    expect(selectLaneForFrequency(DUAL, 82.4, SR)).toBe(LONG);
    // Garbage input defers to the longest lane.
    expect(selectLaneForFrequency(DUAL, Number.NaN, SR)).toBe(LONG);
    expect(selectLaneForFrequency(DUAL, -5, SR)).toBe(LONG);
  });

  it('chromatic mode enters short above ~345 and exits below ~326 (Rust vectors)', () => {
    expect(selectChromaticLane(DUAL, LONG, 392, SR)).toBe(SHORT);
    expect(selectChromaticLane(DUAL, LONG, 345.5, SR)).toBe(SHORT);
    // Inside the dead zone the lane does not move, from either side.
    expect(selectChromaticLane(DUAL, LONG, 335, SR)).toBe(LONG);
    expect(selectChromaticLane(DUAL, SHORT, 335, SR)).toBe(SHORT);
    // E4 (329.6 Hz) inside the band: holds whichever lane it had.
    expect(selectChromaticLane(DUAL, LONG, 329.63, SR)).toBe(LONG);
    expect(selectChromaticLane(DUAL, SHORT, 329.63, SR)).toBe(SHORT);
    expect(selectChromaticLane(DUAL, SHORT, 326, SR)).toBe(SHORT);
    expect(selectChromaticLane(DUAL, SHORT, 325, SR)).toBe(LONG);
    expect(selectChromaticLane(DUAL, SHORT, 293.66, SR)).toBe(LONG);
  });

  it('clamps an out-of-range current lane like the Rust core', () => {
    expect(selectChromaticLane(DUAL, 7, 440, SR)).toBe(SHORT);
    expect(selectChromaticLane(DUAL, 7, 100, SR)).toBe(LONG);
  });

  it('never flaps when the track flickers inside the hysteresis band', () => {
    for (const start of [SHORT, LONG]) {
      let lane = start;
      for (let frame = 0; frame < 1_000; frame += 1) {
        const tracked = frame % 2 === 0 ? 330 : 340;
        const next = selectChromaticLane(DUAL, lane, tracked, SR);
        expect(next).toBe(lane);
        lane = next;
      }
    }
  });
});

describe('AnalysisLaneSelector (engine branch parity)', () => {
  it('runs the longest lane before the first lock', () => {
    const selector = new AnalysisLaneSelector();
    expect(selector.selectLane(SR, null, null)).toBe(LONG);
    expect(selector.selectLane(SR, undefined, Number.NaN)).toBe(LONG);
  });

  it('guided selection wins over the tracked frequency', () => {
    const selector = new AnalysisLaneSelector();
    expect(selector.selectLane(SR, 82.4, 440)).toBe(LONG);
    expect(selector.selectLane(SR, 440, 82.4)).toBe(SHORT);
  });

  it('chromatic selection follows the track with hysteresis', () => {
    const selector = new AnalysisLaneSelector();
    expect(selector.selectLane(SR, null, 440)).toBe(SHORT);
    // 335 Hz is inside the dead zone: the short lane holds.
    expect(selector.selectLane(SR, null, 335)).toBe(SHORT);
    // Below the exit edge the lane demotes to long and holds there.
    expect(selector.selectLane(SR, null, 325)).toBe(LONG);
    expect(selector.selectLane(SR, null, 335)).toBe(LONG);
  });

  it('losing the track returns to the longest lane, as does reset()', () => {
    const selector = new AnalysisLaneSelector();
    expect(selector.selectLane(SR, null, 440)).toBe(SHORT);
    expect(selector.selectLane(SR, null, null)).toBe(LONG);
    expect(selector.selectLane(SR, null, 440)).toBe(SHORT);
    selector.reset();
    expect(selector.selectLane(SR, null, 335)).toBe(LONG);
  });

  it('collapses to lane 0 for a single-lane set', () => {
    const selector = new AnalysisLaneSelector([8_192]);
    expect(selector.selectLane(SR, 440, 440)).toBe(0);
    expect(selector.selectLane(SR, null, null)).toBe(0);
  });
});

describe('PitchCoreAdapter fallback lane wiring', () => {
  const FRAME = new Float32Array(8_192).fill(0.05);
  const RANGE = { minFrequency: 60, maxFrequency: 1_200 };
  const STATS = { maxAbs: 0.05, rms: 0.05 };
  const missingModule = async () => {
    throw new Error('missing module');
  };

  function contextWithSelected(frequency: number): FrameContext {
    const target = { frequency, name: 'A', octave: 4 } as const;
    return {
      a4: 440,
      displayTargets: [target],
      idleTarget: target,
      inTuneEnterCents: 5,
      inTuneExitCents: 7,
      selectedTarget: target,
      tuningTargets: [],
    };
  }

  it('guided high target analyzes the 2048-sample tail, low target the full frame', async () => {
    const fallback = vi.fn<FallbackPitchDetector>(() => ({ confidence: 0.9, frequency: 440 }));
    const adapter = new PitchCoreAdapter('/wasm/missing.js', missingModule, fallback);

    await adapter.process(FRAME, SR, STATS, RANGE, contextWithSelected(440));
    expect(fallback.mock.calls.at(-1)?.[0].length).toBe(2_048);

    await adapter.process(FRAME, SR, STATS, RANGE, contextWithSelected(100));
    expect(fallback.mock.calls.at(-1)?.[0].length).toBe(8_192);
  });

  it('sliced lanes get their own gate stats (Rust detector parity)', async () => {
    const fallback = vi.fn<FallbackPitchDetector>(() => ({ confidence: 0.9, frequency: 440 }));
    const adapter = new PitchCoreAdapter('/wasm/missing.js', missingModule, fallback);

    await adapter.process(FRAME, SR, STATS, RANGE, contextWithSelected(440));
    const [slice, , sliceStats] = fallback.mock.calls.at(-1)!;
    expect(slice.length).toBe(2_048);
    // Recomputed on the tail slice, not the full-frame stats passed in.
    expect(sliceStats.rms).toBeCloseTo(0.05);
    expect(sliceStats).not.toBe(STATS);
  });

  it('retries a short-lane miss once on the longest lane, like the Rust engine', async () => {
    const fallback = vi.fn<FallbackPitchDetector>()
      .mockImplementationOnce(() => null)
      .mockImplementationOnce(() => ({ confidence: 0.9, frequency: 440 }));
    const adapter = new PitchCoreAdapter('/wasm/missing.js', missingModule, fallback);

    await adapter.process(FRAME, SR, STATS, RANGE, contextWithSelected(440));
    expect(fallback).toHaveBeenCalledTimes(2);
    expect(fallback.mock.calls[0]?.[0].length).toBe(2_048);
    expect(fallback.mock.calls[1]?.[0].length).toBe(8_192);
  });

  it('keeps the miss on the short lane when the long-lane retry also misses', async () => {
    const fallback = vi.fn<FallbackPitchDetector>(() => null);
    const adapter = new PitchCoreAdapter('/wasm/missing.js', missingModule, fallback);

    await adapter.process(FRAME, SR, STATS, RANGE, contextWithSelected(440));
    expect(fallback).toHaveBeenCalledTimes(2);
    expect(fallback.mock.calls[0]?.[0].length).toBe(2_048);
    expect(fallback.mock.calls[1]?.[0].length).toBe(8_192);
  });

  it('chromatic mode starts long, then follows a settled high track to the short lane', async () => {
    const fallback = vi.fn<FallbackPitchDetector>(() => ({ confidence: 0.9, frequency: 440 }));
    const adapter = new PitchCoreAdapter('/wasm/missing.js', missingModule, fallback);

    // No context: chromatic. Before the first lock the longest lane runs.
    await adapter.process(FRAME, SR, STATS, RANGE);
    expect(fallback.mock.calls.at(-1)?.[0].length).toBe(8_192);
    // The tracker acquires after two coherent frames; 440 Hz is above the
    // ~345 Hz promote edge, so the short lane takes over.
    await adapter.process(FRAME, SR, STATS, RANGE);
    await adapter.process(FRAME, SR, STATS, RANGE);
    expect(fallback.mock.calls.at(-1)?.[0].length).toBe(2_048);
  });
});
