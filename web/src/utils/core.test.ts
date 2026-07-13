import { describe, expect, it } from 'vitest';

import {
  BUILT_IN_TUNINGS,
  INSTRUMENTS,
  TEMPERAMENTS,
  applyCentsOffset,
  findClosestString,
  getNoteDisplay,
  noteWithA4,
  scaleTuning,
  temperamentOffset,
} from './notes';
import {
  DEFAULT_PITCH_DETECTION_RANGE,
  FrequencySmoother,
  computeSignalStats,
  detectPitch,
  selectPitchCandidate,
  normalizePitchDetectionRange,
} from './pitch';

function sineBuffer(frequency: number, sampleRate = 44100, size = 4096, gain = 0.4): Float32Array {
  const buffer = new Float32Array(size);
  for (let i = 0; i < buffer.length; i += 1) {
    buffer[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * gain;
  }
  return buffer;
}

function noisySineBuffer(frequency: number, sampleRate = 44100, size = 4096): Float32Array {
  const buffer = sineBuffer(frequency, sampleRate, size, 0.35);
  let seed = 0x12345678;
  for (let i = 0; i < buffer.length; i += 1) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    const noise = (seed / 0xffffffff - 0.5) * 0.04;
    buffer[i] += noise;
  }
  return buffer;
}

function expectDetectedPitch(
  buffer: Float32Array,
  expected: number,
  tolerance: number,
  label: string,
  sampleRate = 44100,
  range?: { minFrequency: number; maxFrequency: number },
) {
  const detected = detectPitch(buffer, sampleRate, computeSignalStats(buffer), range);
  expect(detected, `${label} should be detected`).not.toBeNull();
  expect(Math.abs((detected ?? 0) - expected), label).toBeLessThan(tolerance);
}

describe('music domain helpers', () => {
  it('formats and shifts notes by A4/capo inputs', () => {
    expect(getNoteDisplay(noteWithA4({ name: 'A', octave: 4 }))).toBe('A4');
    expect(Math.abs(noteWithA4({ name: 'A', octave: 4 }).frequency - 440)).toBeLessThan(0.001);

    const f2 = noteWithA4({ name: 'E', octave: 2 }, 440, 'equal', 1);
    expect(getNoteDisplay(f2)).toBe('F2');

    const standard = BUILT_IN_TUNINGS.find((tuning) => tuning.id === 'standard');
    if (!standard) {
      throw new Error('missing standard tuning');
    }
    const standardWithCapo = scaleTuning(standard, 440, 'equal', 1);
    expect(getNoteDisplay(standardWithCapo.strings[0])).toBe('F2');

    const sweetened = applyCentsOffset(noteWithA4({ name: 'A', octave: 4 }), 12);
    expect(sweetened.frequency).toBeGreaterThan(440);

    const closest = findClosestString(111, standardWithCapo.strings);
    expect(getNoteDisplay(closest)).toBe('A#2');
  });

  it('keeps core registry coverage visible', () => {
    expect(INSTRUMENTS.some((instrument) => instrument.id === 'guitar-7')).toBe(true);
    expect(INSTRUMENTS.some((instrument) => instrument.id === 'mandolin')).toBe(true);
    expect(TEMPERAMENTS.some((temperament) => temperament.id === 'vallotti')).toBe(true);
    expect(BUILT_IN_TUNINGS.find((tuning) => tuning.id === 'guitar-7-standard')?.strings).toHaveLength(7);
    expect(BUILT_IN_TUNINGS.find((tuning) => tuning.id === 'twelve-string-standard')?.strings).toHaveLength(12);
    expect(getNoteDisplay(BUILT_IN_TUNINGS.find((tuning) => tuning.id === 'cello-standard')!.strings[0])).toBe('C2');
  });

  it('applies temperament offsets including custom temperaments', () => {
    expect(temperamentOffset('C', 'just', 'C')).toBe(0);
    expect(temperamentOffset('C', 'just', 'A')).not.toBe(0);
    const customTemperaments = [
      ...TEMPERAMENTS,
      { id: 'custom-test', name: 'Custom Test', offsets: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
    ];
    expect(temperamentOffset('D', 'custom-test', 'C', customTemperaments)).toBe(2);
  });
});

describe('pitch utilities', () => {
  const sampleRate = 44100;

  it('detects clean, noisy, low and high synthetic tones', () => {
    expectDetectedPitch(sineBuffer(110, sampleRate), 110, 1.5, 'A2 sine');
    expectDetectedPitch(noisySineBuffer(110, sampleRate), 110, 2.0, 'noisy A2 sine');

    const b0Frequency = noteWithA4({ name: 'B', octave: 0 }).frequency;
    expectDetectedPitch(
      sineBuffer(b0Frequency, sampleRate),
      b0Frequency,
      0.8,
      'low bass B0',
      sampleRate,
      { minFrequency: 20, maxFrequency: 80 },
    );

    const e5Frequency = noteWithA4({ name: 'E', octave: 5 }).frequency;
    expectDetectedPitch(
      sineBuffer(e5Frequency, sampleRate),
      e5Frequency,
      2.5,
      'high mandolin/violin E5',
      sampleRate,
      { minFrequency: 180, maxFrequency: 1000 },
    );
  });

  it('rejects silence and normalizes invalid ranges', () => {
    const silence = new Float32Array(4096);
    const silenceStats = computeSignalStats(silence);
    expect(silenceStats.rms).toBe(0);
    expect(silenceStats.maxAbs).toBe(0);
    expect(detectPitch(silence, sampleRate, silenceStats)).toBeNull();

    expect(normalizePitchDetectionRange({ minFrequency: 100, maxFrequency: 110 })).toEqual(
      DEFAULT_PITCH_DETECTION_RANGE,
    );
  });

  it('reconciles independent fallback detector candidates', () => {
    const agreed = selectPitchCandidate(
      { confidence: 0.91, frequency: 82.3 },
      { confidence: 0.93, frequency: 82.5 },
    );
    expect(agreed?.frequency).toBeCloseTo(82.4, 1);
    expect(selectPitchCandidate(
      { confidence: 0.82, frequency: 55 },
      { confidence: 0.78, frequency: 82.4 },
    )).toBeNull();
    expect(selectPitchCandidate(
      { confidence: 0.82, frequency: 55 },
      { confidence: 0.78, frequency: 82.4 },
      { selectedFrequency: 82.4069, targetFrequencies: [82.4069] },
    )?.frequency).toBeCloseTo(82.4);
    expect(selectPitchCandidate(
      { confidence: Number.NaN, frequency: 82.4 },
      { confidence: 0.91, frequency: 82.5 },
    )?.frequency).toBe(82.5);
  });

  it('smooths and resets frequency estimates', () => {
    const smoother = new FrequencySmoother();
    expect(smoother.add(null)).toBeNull();
    expect(smoother.add(110)).toBe(110);
    expect(smoother.add(112)).toBeGreaterThan(110);
    smoother.reset();
    expect(smoother.add(null)).toBeNull();
  });
});
