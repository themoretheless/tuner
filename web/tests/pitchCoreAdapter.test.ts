import { describe, expect, it, vi } from 'vitest';

import {
  PitchCoreAdapter,
  type PitchCoreModuleLoader,
} from '../src/workers/pitchCoreAdapter';
import type { FrameContext } from '../src/types/frames';
import { pipelinePresetConfig } from '../src/domain/pipelineConfig';
import { createPipelineTelemetry } from '../src/domain/pipelineTelemetry';
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
    const setPipelineConfig = vi.fn();

    class FakeProcessor {
      clear_frame_context() {}
      free = processorFree;
      process = process;
      reset = resetProcessor;
      set_frame_context = setFrameContext;
      set_frequency_range = setFrequencyRange;
      set_pipeline_config = setPipelineConfig;
    }

    const loadModule: PitchCoreModuleLoader = vi.fn(async () => ({
      default: init,
      TunerProcessor: FakeProcessor,
    }));
    const fallback = vi.fn(() => ({ confidence: 0.7, frequency: 220 }));
    const adapter = new PitchCoreAdapter('/wasm/pitch_core.js', loadModule, fallback);

    const first = await adapter.process(
      BUFFER,
      48_000,
      STATS,
      RANGE,
      CONTEXT,
      pipelinePresetConfig('raw'),
    );
    first.frame.pipeline.processingMs = 0;
    expect(first).toEqual({
      backend: 'wasm',
      frame: {
        cents: 0,
        confidence: 1,
        freq: 440,
        rawFreq: 439.5,
        inTune: true,
        isPower: false,
        level: 1,
        note: 'A4',
        pipeline: createPipelineTelemetry({
          adaptiveGateOpen: true,
          arbitration: 'fused',
          decision: 'published',
          fixedGateOpen: true,
          secondary: { confidence: 0.88, frequency: 440.2 },
          selected: { confidence: 0.9, frequency: 440 },
          tracked: true,
          yin: { confidence: 0.92, frequency: 439.8 },
        }),
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
    expect(setPipelineConfig).toHaveBeenCalledOnce();
    expect(setPipelineConfig).toHaveBeenCalledWith(
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      true,
      false,
      true,
    );
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

    const first = await adapter.process(BUFFER, 48_000, STATS, RANGE);
    first.frame.pipeline.processingMs = 0;
    expect(first).toEqual({
      backend: 'typescript',
      frame: {
        cents: 0,
        confidence: 0,
        freq: null,
        rawFreq: 220,
        inTune: false,
        isPower: false,
        level: 1,
        note: '\u2014',
        pipeline: createPipelineTelemetry({
          adaptiveGateOpen: true,
          arbitration: 'yin-only',
          decision: 'tracking-acquiring',
          fixedGateOpen: true,
          gateThreshold: 0.003125,
          noiseFloor: 0.0025,
          sampleRate: 48_000,
          selected: { confidence: 0.72, frequency: 220 },
          windowSamples: BUFFER.length,
          yin: { confidence: 0.72, frequency: 220 },
        }),
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
      set_pipeline_config() {}
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
    adaptive_gate_open: true,
    arbitration: 'fused',
    cents: 0,
    confidence: 1.2,
    decision: 'published',
    freq: 440,
    fixed_gate_open: true,
    gate_threshold: 0,
    free,
    harmonic_1: 0,
    harmonic_2: 0,
    harmonic_3: 0,
    harmonic_4: 0,
    harmonic_5: 0,
    has_frequency: true,
    has_raw_frequency: true,
    has_secondary_candidate: true,
    has_selected_candidate: true,
    has_spectral_evidence: false,
    has_target: true,
    has_yin_candidate: true,
    held: false,
    in_tune: true,
    is_power: false,
    level: 1.2,
    noise_floor: 0,
    note: 'A4',
    octave_active: 0,
    octave_base_frequency: 0,
    octave_center_score: 0,
    octave_down_score: 0,
    octave_pending: 0,
    octave_up_score: 0,
    raw_freq: 439.5,
    rms: 0.125,
    sample_rate: 0,
    secondary_confidence: 0.88,
    secondary_frequency: 440.2,
    selected_confidence: 0.9,
    selected_frequency: 440,
    target_frequency: 440,
    target_midi: 69,
    tracked: true,
    window_samples: 0,
    yin_confidence: 0.92,
    yin_frequency: 439.8,
  };
}
