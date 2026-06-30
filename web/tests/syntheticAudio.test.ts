import { describe, expect, it } from 'vitest';

import { computeSignalStats, detectPitch } from '../src/utils/pitch';
import { fillSyntheticAudioBuffer, resolveSyntheticAudioFixture } from '../src/utils/syntheticAudio';

describe('synthetic audio fixtures', () => {
  it('resolves note and hertz fixtures', () => {
    expect(resolveSyntheticAudioFixture('E2')?.label).toBe('E2');
    expect(resolveSyntheticAudioFixture('110hz')?.frequency).toBe(110);
    expect(resolveSyntheticAudioFixture('off')).toBeNull();
  });

  it('feeds the pitch detector headlessly', () => {
    const fixture = resolveSyntheticAudioFixture('E2');
    expect(fixture).not.toBeNull();

    const buffer = new Float32Array(4096);
    fillSyntheticAudioBuffer(buffer, fixture!, 0);
    const detected = detectPitch(buffer, fixture!.sampleRate, computeSignalStats(buffer), {
      minFrequency: 60,
      maxFrequency: 120,
    });

    expect(detected).not.toBeNull();
    expect(Math.abs(detected! - fixture!.frequency)).toBeLessThan(1.5);
  });
});
