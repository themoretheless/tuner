import { describe, expect, it } from 'vitest';

import { pipelinePresetConfig } from '../src/domain/pipelineConfig';
import {
  cloneNativeAudioConfiguration,
  createNativeAudioConfiguration,
  normalizeNativeFrame,
  withNativePipelineConfig,
} from '../src/platform/nativeAudioContract';

describe('native DetectionFrame wire contract', () => {
  it('normalizes the canonical frame shape', () => {
    expect(normalizeNativeFrame({
      cents: -2.5,
      confidence: 1.2,
      freq: 440,
      inTune: true,
      isPower: false,
      level: 0.4,
      note: 'A4',
      rms: 0.1,
      target: { frequency: 442, name: 'A', octave: 4 },
    })).toEqual({
      cents: -2.5,
      confidence: 1,
      freq: 440,
      rawFreq: null,
      inTune: true,
      isPower: false,
      level: 0.4,
      note: 'A4',
      rms: 0.1,
      target: { frequency: 442, name: 'A', octave: 4 },
    });
  });

  it('does not accept the removed top-level frequency alias', () => {
    const legacyPayload = { frequency: 440 } as unknown as Parameters<typeof normalizeNativeFrame>[0];
    expect(normalizeNativeFrame(legacyPayload).freq).toBeNull();
  });

  it('contains malformed numeric and target fields', () => {
    const frame = normalizeNativeFrame({
      cents: Number.POSITIVE_INFINITY,
      confidence: Number.NaN,
      freq: -1,
      level: 4,
      rms: -2,
      target: { frequency: 0, name: 'wat', octave: 99 },
    });
    expect(frame).toMatchObject({
      cents: 0,
      confidence: 0,
      freq: null,
      level: 1,
      rms: 0,
      target: null,
    });
  });

  it('clones pipeline configuration into the native payload', () => {
    const configuration = withNativePipelineConfig(
      createNativeAudioConfiguration(),
      pipelinePresetConfig('raw'),
    );
    const cloned = cloneNativeAudioConfiguration(configuration);

    expect(cloned.pipeline).toEqual(pipelinePresetConfig('raw'));
    expect(cloned.pipeline).not.toBe(configuration.pipeline);
  });
});
