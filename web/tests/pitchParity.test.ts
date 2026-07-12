import { describe, expect, it } from 'vitest';

import manifest from '../../fixtures/pitch-parity.json';
import {
  computeSignalStats,
  detectPitchEstimate,
  MIN_USABLE_PITCH_CONFIDENCE,
} from '../src/utils/pitch';

interface PitchFixture {
  id: string;
  frequency: number;
  sampleRate: number;
  bufferSize: number;
  amplitude: number;
  dcOffset: number;
  harmonics: number[];
  minFrequency: number;
  maxFrequency: number;
  minimumConfidence: number;
  toleranceCents: number;
}

describe('TypeScript pitch fallback parity', () => {
  it('matches the shared native/WASM fixture manifest', () => {
    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.confidenceModel).toBe('normalized-periodicity-v1');
    expect(manifest.minimumUsableConfidence).toBe(MIN_USABLE_PITCH_CONFIDENCE);

    for (const fixture of manifest.fixtures as PitchFixture[]) {
      const samples = renderFixture(fixture);
      const detected = detectPitchEstimate(
        samples,
        fixture.sampleRate,
        computeSignalStats(samples),
        {
          minFrequency: fixture.minFrequency,
          maxFrequency: fixture.maxFrequency,
        },
      );

      expect(detected, `${fixture.id} should produce a detection`).not.toBeNull();
      expect(detected!.confidence, `${fixture.id} confidence`).toBeGreaterThanOrEqual(
        fixture.minimumConfidence,
      );
      expect(
        centsError(detected!.frequency, fixture.frequency),
        `${fixture.id} cents error`,
      ).toBeLessThanOrEqual(fixture.toleranceCents);
    }
  });
});

function renderFixture(fixture: PitchFixture) {
  const samples = new Float32Array(fixture.bufferSize);
  for (let index = 0; index < samples.length; index += 1) {
    const phase = Math.PI * 2 * fixture.frequency * index / fixture.sampleRate;
    const harmonicSum = fixture.harmonics.reduce((sum, weight, harmonic) => (
      sum + weight * Math.sin(phase * (harmonic + 1))
    ), 0);
    samples[index] = fixture.dcOffset + fixture.amplitude * harmonicSum;
  }
  return samples;
}

function centsError(actual: number, expected: number) {
  return Math.abs(1_200 * Math.log2(actual / expected));
}
