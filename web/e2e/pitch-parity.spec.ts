import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

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
  toleranceCents: number;
}

const manifest = JSON.parse(readFileSync(
  new URL('../../fixtures/pitch-parity.json', import.meta.url),
  'utf8',
)) as { schemaVersion: number; fixtures: PitchFixture[] };

test('stateful WASM detector matches the shared pitch fixtures', async ({ page }) => {
  await page.goto('/');

  const results = await page.evaluate(async (fixtures) => {
    const moduleUrl = new URL('wasm/pitch_core.js', document.baseURI).href;
    const pitchCore = await import(/* @vite-ignore */ moduleUrl) as {
      default(): Promise<unknown>;
      WasmPitchDetector: new () => {
        detect(buffer: Float32Array, sampleRate: number): {
          confidence: number;
          freq: number;
          free(): void;
        } | undefined;
        free(): void;
        set_frequency_range(minFrequency: number, maxFrequency: number): void;
      };
    };
    await pitchCore.default();
    const detector = new pitchCore.WasmPitchDetector();

    try {
      return fixtures.map((fixture) => {
        const samples = new Float32Array(fixture.bufferSize);
        for (let index = 0; index < samples.length; index += 1) {
          const phase = Math.PI * 2 * fixture.frequency * index / fixture.sampleRate;
          const harmonicSum = fixture.harmonics.reduce((sum, weight, harmonic) => (
            sum + weight * Math.sin(phase * (harmonic + 1))
          ), 0);
          samples[index] = fixture.dcOffset + fixture.amplitude * harmonicSum;
        }

        detector.set_frequency_range(fixture.minFrequency, fixture.maxFrequency);
        const detection = detector.detect(samples, fixture.sampleRate);
        if (!detection) return { id: fixture.id, frequency: null };
        try {
          return { id: fixture.id, frequency: detection.freq };
        } finally {
          detection.free();
        }
      });
    } finally {
      detector.free();
    }
  }, manifest.fixtures);

  expect(manifest.schemaVersion).toBe(1);
  for (const fixture of manifest.fixtures) {
    const result = results.find((candidate) => candidate.id === fixture.id);
    expect(result?.frequency, `${fixture.id} should produce a detection`).not.toBeNull();
    expect(
      centsError(result!.frequency!, fixture.frequency),
      `${fixture.id} cents error`,
    ).toBeLessThanOrEqual(fixture.toleranceCents);
  }
});

function centsError(actual: number, expected: number) {
  return Math.abs(1_200 * Math.log2(actual / expected));
}
