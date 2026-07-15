import { describe, expect, it } from 'vitest';

import {
  createDefaultPipelineConfig,
  normalizePipelineConfig,
  pipelinePresetConfig,
  resolvePipelinePreset,
  updatePipelineBlock,
  type PipelinePresetId,
} from '../src/domain/pipelineConfig';
import { computeSignalStats, detectPitchEstimate } from '../src/utils/pitch';

describe('pipeline configuration', () => {
  it('keeps at least one candidate provider enabled', () => {
    const config = normalizePipelineConfig({
      yinEnabled: false,
      secondaryDetectorEnabled: false,
    });

    expect(config.yinEnabled).toBe(true);
    expect(config.secondaryDetectorEnabled).toBe(false);
  });

  it('recognizes presets and marks manual edits as custom', () => {
    const presets: PipelinePresetId[] = ['stable', 'balanced', 'fast', 'raw'];
    for (const preset of presets) {
      expect(resolvePipelinePreset(pipelinePresetConfig(preset))).toBe(preset);
    }

    const custom = updatePipelineBlock(
      pipelinePresetConfig('stable'),
      'trackingEnabled',
      false,
    );
    expect(resolvePipelinePreset(custom)).toBe('custom');
  });

  it('runs either fallback candidate provider independently', () => {
    const sampleRate = 48_000;
    const samples = Float32Array.from({ length: 4096 }, (_, index) => (
      Math.sin(2 * Math.PI * 220 * index / sampleRate)
    ));
    const stats = { maxAbs: 1, rms: Math.SQRT1_2 };
    const range = { minFrequency: 180, maxFrequency: 260 };

    const yinOnly = detectPitchEstimate(samples, sampleRate, stats, range, undefined, {
      ...createDefaultPipelineConfig(),
      secondaryDetectorEnabled: false,
    });
    const secondaryOnly = detectPitchEstimate(samples, sampleRate, stats, range, undefined, {
      ...createDefaultPipelineConfig(),
      yinEnabled: false,
    });

    expect(yinOnly?.frequency).toBeCloseTo(220, 0);
    expect(secondaryOnly?.frequency).toBeCloseTo(220, 0);
  });

  it('applies DC removal before the fallback detectors', () => {
    const sampleRate = 48_000;
    const samples = Float32Array.from({ length: 4096 }, (_, index) => (
      0.2 + 0.02 * Math.sin(2 * Math.PI * 220 * index / sampleRate)
    ));
    const stats = computeSignalStats(samples);
    const range = { minFrequency: 180, maxFrequency: 260 };
    const secondaryOnly = {
      ...createDefaultPipelineConfig(),
      yinEnabled: false,
    };

    const centered = detectPitchEstimate(
      samples,
      sampleRate,
      stats,
      range,
      undefined,
      secondaryOnly,
    );
    const raw = detectPitchEstimate(
      samples,
      sampleRate,
      stats,
      range,
      undefined,
      { ...secondaryOnly, dcRemovalEnabled: false },
    );

    expect(centered?.frequency).toBeCloseTo(220, 0);
    expect(Math.abs((raw?.frequency ?? 0) - 220)).toBeGreaterThan(10);
  });
});
