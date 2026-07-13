import { describe, expect, it, vi } from 'vitest';

import {
  PitchCoreAdapter,
  type PitchCoreModuleLoader,
} from '../src/workers/pitchCoreAdapter';
import type { FrameContext } from '../src/types/frames';
import type { PitchDetectionRange, SignalStats } from '../src/utils/pitch';

const BUFFER = new Float32Array([0, 0.25, -0.25, 0]);
const RANGE: PitchDetectionRange = { minFrequency: 60, maxFrequency: 1_200 };
const STATS: SignalStats = { maxAbs: 0.25, rms: 0.125 };
const CONTEXT: FrameContext = {
  a4: 440,
  displayTargets: [{ frequency: 440, name: 'A', octave: 4 }],
  idleTarget: { frequency: 440, name: 'A', octave: 4 },
  inTuneEnterCents: 5,
  inTuneExitCents: 7,
  selectedTarget: { frequency: 440, name: 'A', octave: 4 },
  tuningTargets: [],
};

describe('PitchCoreAdapter', () => {
  it('reuses one full-frame WASM processor and applies context explicitly', async () => {
    const init = vi.fn(async () => undefined);
    const resultFree = vi.fn();
    const processorFree = vi.fn();
    const process = vi.fn(() => createWasmFrame(resultFree));
    const resetProcessor = vi.fn();
    const setFrameContext = vi.fn();
    const setFrequencyRange = vi.fn();

    class FakeProcessor {
      clear_frame_context() {}
      free = processorFree;
      process = process;
      reset = resetProcessor;
      set_frame_context = setFrameContext;
      set_frequency_range = setFrequencyRange;
    }

    const loadModule: PitchCoreModuleLoader = vi.fn(async () => ({
      default: init,
      TunerProcessor: FakeProcessor,
    }));
    const fallback = vi.fn(() => ({ confidence: 0.7, frequency: 220 }));
    const adapter = new PitchCoreAdapter('/wasm/pitch_core.js', loadModule, fallback);

    await expect(adapter.process(BUFFER, 48_000, STATS, RANGE, CONTEXT)).resolves.toEqual({
      backend: 'wasm',
      frame: {
        cents: 0,
        confidence: 1,
        freq: 440,
        inTune: true,
        isPower: false,
        level: 1,
        note: 'A4',
        rms: 0.125,
        target: { frequency: 440, name: 'A', octave: 4 },
      },
      semantics: 'resolved',
    });
    await adapter.process(BUFFER, 48_000, STATS, RANGE);

    expect(loadModule).toHaveBeenCalledOnce();
    expect(init).toHaveBeenCalledOnce();
    expect(setFrequencyRange).toHaveBeenCalledOnce();
    expect(setFrequencyRange).toHaveBeenCalledWith(60, 1_200);
    expect(setFrameContext).toHaveBeenCalledOnce();
    expect(setFrameContext.mock.calls[0]?.[1]).toEqual(new Int32Array([69]));
    expect(process).toHaveBeenCalledTimes(2);
    expect(resultFree).toHaveBeenCalledTimes(2);
    expect(fallback).not.toHaveBeenCalled();

    await adapter.reset();
    expect(resetProcessor).toHaveBeenCalledOnce();
    await adapter.dispose();
    expect(processorFree).toHaveBeenCalledOnce();
  });

  it('falls back with measured confidence when the WASM module is unavailable', async () => {
    const loadModule: PitchCoreModuleLoader = vi.fn(async () => {
      throw new Error('missing module');
    });
    const fallback = vi.fn(() => ({ confidence: 0.72, frequency: 220 }));
    const adapter = new PitchCoreAdapter('/wasm/missing.js', loadModule, fallback);

    await expect(adapter.process(BUFFER, 48_000, STATS, RANGE)).resolves.toEqual({
      backend: 'typescript',
      frame: {
        cents: 0,
        confidence: 0,
        freq: null,
        inTune: false,
        isPower: false,
        level: 1,
        note: '\u2014',
        rms: 0.125,
        target: null,
      },
      semantics: 'unresolved',
    });
    const confirmed = await adapter.process(BUFFER, 48_000, STATS, RANGE);
    expect(confirmed.frame.freq).toBeCloseTo(220);
    expect(confirmed.frame.confidence).toBe(0.72);

    expect(loadModule).toHaveBeenCalledOnce();
    expect(fallback).toHaveBeenCalledTimes(2);
  });

  it('keeps numeric pitch guidance available to the fallback detector', async () => {
    const loadModule: PitchCoreModuleLoader = vi.fn(async () => {
      throw new Error('missing module');
    });
    const fallback = vi.fn(() => ({ confidence: 0.92, frequency: 440 }));
    const adapter = new PitchCoreAdapter('/wasm/missing.js', loadModule, fallback);

    await adapter.process(BUFFER, 48_000, STATS, RANGE, CONTEXT);
    await adapter.process(BUFFER, 48_000, STATS, RANGE);

    expect(fallback.mock.calls[1]?.[4]).toEqual({
      selectedFrequency: 440,
      targetFrequencies: [],
    });
  });

  it('disables a broken processor and keeps serving the smoothed fallback', async () => {
    const processorFree = vi.fn();
    const process = vi.fn(() => {
      throw new Error('processor failed');
    });

    class BrokenProcessor {
      clear_frame_context() {}
      free = processorFree;
      process = process;
      reset() {}
      set_frame_context() {}
      set_frequency_range() {}
    }

    const loadModule: PitchCoreModuleLoader = vi.fn(async () => ({
      default: async () => undefined,
      TunerProcessor: BrokenProcessor,
    }));
    const fallback = vi.fn(() => ({ confidence: 0.64, frequency: 82.4069 }));
    const adapter = new PitchCoreAdapter('/wasm/pitch_core.js', loadModule, fallback);

    const first = await adapter.process(BUFFER, 48_000, STATS, RANGE);
    expect(first.backend).toBe('typescript');
    expect(first.frame.freq).toBeNull();
    expect(first.frame.confidence).toBe(0);
    const confirmed = await adapter.process(BUFFER, 48_000, STATS, RANGE);
    expect(confirmed.frame.freq).toBeCloseTo(82.4069);
    expect(confirmed.frame.confidence).toBe(0.64);

    expect(process).toHaveBeenCalledOnce();
    expect(processorFree).toHaveBeenCalledOnce();
    expect(fallback).toHaveBeenCalledTimes(2);
  });
});

function createWasmFrame(free: () => void) {
  return {
    cents: 0,
    confidence: 1.2,
    freq: 440,
    free,
    has_frequency: true,
    has_target: true,
    in_tune: true,
    is_power: false,
    level: 1.2,
    note: 'A4',
    rms: 0.125,
    target_frequency: 440,
    target_midi: 69,
  };
}
