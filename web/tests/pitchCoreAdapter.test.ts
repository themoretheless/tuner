import { describe, expect, it, vi } from 'vitest';

import {
  PitchCoreAdapter,
  type PitchCoreModuleLoader,
} from '../src/workers/pitchCoreAdapter';
import type { PitchDetectionRange, SignalStats } from '../src/utils/pitch';

const BUFFER = new Float32Array([0, 0.25, -0.25, 0]);
const RANGE: PitchDetectionRange = { minFrequency: 60, maxFrequency: 1_200 };
const STATS: SignalStats = { maxAbs: 0.25, rms: 0.125 };

describe('PitchCoreAdapter', () => {
  it('initializes one stateful WASM detector and reuses its range', async () => {
    const init = vi.fn(async () => undefined);
    const resultFree = vi.fn();
    const detectorFree = vi.fn();
    const detect = vi.fn(() => ({ confidence: 1.2, freq: 440, free: resultFree }));
    const setFrequencyRange = vi.fn();

    class FakeDetector {
      detect = detect;
      free = detectorFree;
      set_frequency_range = setFrequencyRange;
    }

    const loadModule: PitchCoreModuleLoader = vi.fn(async () => ({
      default: init,
      WasmPitchDetector: FakeDetector,
    }));
    const fallback = vi.fn(() => 220);
    const adapter = new PitchCoreAdapter('/wasm/pitch_core.js', loadModule, fallback);

    await expect(adapter.detect(BUFFER, 48_000, STATS, RANGE)).resolves.toEqual({
      backend: 'wasm',
      confidence: 1,
      frequency: 440,
    });
    await adapter.detect(BUFFER, 48_000, STATS, RANGE);

    expect(loadModule).toHaveBeenCalledOnce();
    expect(init).toHaveBeenCalledOnce();
    expect(setFrequencyRange).toHaveBeenCalledOnce();
    expect(setFrequencyRange).toHaveBeenCalledWith(60, 1_200);
    expect(detect).toHaveBeenCalledTimes(2);
    expect(resultFree).toHaveBeenCalledTimes(2);
    expect(fallback).not.toHaveBeenCalled();

    await adapter.dispose();
    expect(detectorFree).toHaveBeenCalledOnce();
  });

  it('falls back to TypeScript when the WASM module is unavailable', async () => {
    const loadModule: PitchCoreModuleLoader = vi.fn(async () => {
      throw new Error('missing module');
    });
    const fallback = vi.fn(() => null);
    const adapter = new PitchCoreAdapter('/wasm/missing.js', loadModule, fallback);

    await expect(adapter.detect(BUFFER, 48_000, STATS, RANGE)).resolves.toEqual({
      backend: 'typescript',
      confidence: 0,
      frequency: null,
    });
    await adapter.detect(BUFFER, 48_000, STATS, RANGE);

    expect(loadModule).toHaveBeenCalledOnce();
    expect(fallback).toHaveBeenCalledTimes(2);
  });

  it('disables a broken detector and keeps serving the fallback', async () => {
    const detectorFree = vi.fn();
    const detect = vi.fn(() => {
      throw new Error('detector failed');
    });

    class BrokenDetector {
      detect = detect;
      free = detectorFree;
      set_frequency_range() {}
    }

    const loadModule: PitchCoreModuleLoader = vi.fn(async () => ({
      default: async () => undefined,
      WasmPitchDetector: BrokenDetector,
    }));
    const fallback = vi.fn(() => 82.4069);
    const adapter = new PitchCoreAdapter('/wasm/pitch_core.js', loadModule, fallback);

    await expect(adapter.detect(BUFFER, 48_000, STATS, RANGE)).resolves.toEqual({
      backend: 'typescript',
      confidence: 1,
      frequency: 82.4069,
    });
    await adapter.detect(BUFFER, 48_000, STATS, RANGE);

    expect(detect).toHaveBeenCalledOnce();
    expect(detectorFree).toHaveBeenCalledOnce();
    expect(fallback).toHaveBeenCalledTimes(2);
  });
});
