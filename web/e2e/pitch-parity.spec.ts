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
  minimumConfidence: number;
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
        if (!detection) return { id: fixture.id, frequency: null, confidence: 0 };
        try {
          return {
            id: fixture.id,
            confidence: detection.confidence,
            frequency: detection.freq,
          };
        } finally {
          detection.free();
        }
      });
    } finally {
      detector.free();
    }
  }, manifest.fixtures);

  expect(manifest.schemaVersion).toBe(2);
  for (const fixture of manifest.fixtures) {
    const result = results.find((candidate) => candidate.id === fixture.id);
    expect(result?.frequency, `${fixture.id} should produce a detection`).not.toBeNull();
    expect(result!.confidence, `${fixture.id} confidence`).toBeGreaterThanOrEqual(
      fixture.minimumConfidence,
    );
    expect(
      centsError(result!.frequency!, fixture.frequency),
      `${fixture.id} cents error`,
    ).toBeLessThanOrEqual(fixture.toleranceCents);
  }
});

test('full-frame WASM processor resolves context and clears state on silence', async ({ page }) => {
  await page.goto('/');

  const result = await page.evaluate(async () => {
    const moduleUrl = new URL('wasm/pitch_core.js', document.baseURI).href;
    const pitchCore = await import(/* @vite-ignore */ moduleUrl) as {
      default(): Promise<unknown>;
      TunerProcessor: new () => {
        free(): void;
        process(buffer: Float32Array, sampleRate: number): {
          cents: number;
          confidence: number;
          freq: number;
          free(): void;
          has_frequency: boolean;
          has_target: boolean;
          in_tune: boolean;
          note: string;
          target_midi: number;
        };
        reset(): void;
        set_frame_context(
          a4: number,
          displayMidis: Int32Array,
          displayFrequencies: Float32Array,
          tuningMidis: Int32Array,
          tuningFrequencies: Float32Array,
          selectedMidi: number,
          selectedFrequency: number,
          idleMidi: number,
          idleFrequency: number,
          enterCents: number,
          exitCents: number,
        ): void;
        set_frequency_range(minFrequency: number, maxFrequency: number): void;
      };
    };
    await pitchCore.default();
    const processor = new pitchCore.TunerProcessor();
    const sampleRate = 48_000;
    const samples = new Float32Array(4096);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = Math.sin(Math.PI * 2 * 440 * index / sampleRate);
    }

    try {
      processor.set_frequency_range(180, 500);
      processor.set_frame_context(
        440,
        new Int32Array([69]),
        new Float32Array([440]),
        new Int32Array(),
        new Float32Array(),
        69,
        440,
        69,
        440,
        5,
        7,
      );
      const provisional = processor.process(samples, sampleRate);
      const provisionalFrequency = provisional.has_frequency ? provisional.freq : null;
      provisional.free();
      const detected = processor.process(samples, sampleRate);
      const detectedFrame = {
        cents: detected.cents,
        confidence: detected.confidence,
        frequency: detected.has_frequency ? detected.freq : null,
        hasTarget: detected.has_target,
        inTune: detected.in_tune,
        note: detected.note,
        targetMidi: detected.target_midi,
      };
      detected.free();

      processor.reset();
      const lowerSamples = new Float32Array(samples.length);
      for (let index = 0; index < lowerSamples.length; index += 1) {
        lowerSamples[index] = Math.sin(Math.PI * 2 * 220 * index / sampleRate);
      }
      const afterResetProvisional = processor.process(lowerSamples, sampleRate);
      const afterResetProvisionalFrequency = afterResetProvisional.has_frequency
        ? afterResetProvisional.freq
        : null;
      afterResetProvisional.free();
      const afterReset = processor.process(lowerSamples, sampleRate);
      const afterResetFrequency = afterReset.has_frequency ? afterReset.freq : null;
      afterReset.free();

      const silent = processor.process(new Float32Array(samples.length), sampleRate);
      const silentFrame = {
        confidence: silent.confidence,
        frequency: silent.has_frequency ? silent.freq : null,
        inTune: silent.in_tune,
        note: silent.note,
        targetMidi: silent.target_midi,
      };
      silent.free();
      return {
        afterResetFrequency,
        afterResetProvisionalFrequency,
        detectedFrame,
        provisionalFrequency,
        silentFrame,
      };
    } finally {
      processor.free();
    }
  });

  expect(result.provisionalFrequency).toBeNull();
  expect(result.detectedFrame.frequency).toBeCloseTo(440, 0);
  expect(result.detectedFrame.confidence).toBeGreaterThanOrEqual(0.75);
  expect(result.detectedFrame.cents).toBeCloseTo(0, 0);
  expect(result.detectedFrame.hasTarget).toBe(true);
  expect(result.detectedFrame.inTune).toBe(true);
  expect(result.detectedFrame.note).toBe('A4');
  expect(result.detectedFrame.targetMidi).toBe(69);
  expect(result.afterResetProvisionalFrequency).toBeNull();
  expect(result.afterResetFrequency).toBeCloseTo(220, 0);
  expect(result.silentFrame).toEqual({
    confidence: 0,
    frequency: null,
    inTune: false,
    note: '\u2014',
    targetMidi: 69,
  });
});

function centsError(actual: number, expected: number) {
  return Math.abs(1_200 * Math.log2(actual / expected));
}
