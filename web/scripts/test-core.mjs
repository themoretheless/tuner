import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';

const root = path.resolve(import.meta.dirname, '..');
const tempDir = await mkdtemp(path.join(tmpdir(), 'tuner-core-'));

async function bundleModule(source, outfile) {
  const output = path.join(tempDir, outfile);
  await esbuild.build({
    bundle: true,
    entryPoints: [path.join(root, source)],
    format: 'esm',
    outfile: output,
    platform: 'node',
  });
  return import(pathToFileURL(output).href);
}

function sineBuffer(frequency, sampleRate = 44100, size = 4096, gain = 0.4) {
  const buffer = new Float32Array(size);
  for (let i = 0; i < buffer.length; i += 1) {
    buffer[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * gain;
  }
  return buffer;
}

function noisySineBuffer(frequency, sampleRate = 44100, size = 4096) {
  const buffer = sineBuffer(frequency, sampleRate, size, 0.35);
  let seed = 0x12345678;
  for (let i = 0; i < buffer.length; i += 1) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    const noise = (seed / 0xffffffff - 0.5) * 0.04;
    buffer[i] += noise;
  }
  return buffer;
}

function assertDetectedPitch(pitch, buffer, sampleRate, expected, tolerance, range, label) {
  const detected = pitch.detectPitch(buffer, sampleRate, pitch.computeSignalStats(buffer), range);
  assert.ok(detected != null, `${label} should be detected`);
  assert.ok(
    Math.abs(detected - expected) < tolerance,
    `${label}: expected ~${expected}Hz, got ${detected}`,
  );
  return detected;
}

try {
  const notes = await bundleModule('src/utils/notes.ts', 'notes.mjs');
  const pitch = await bundleModule('src/utils/pitch.ts', 'pitch.mjs');

  assert.equal(notes.getNoteDisplay(notes.noteWithA4({ name: 'A', octave: 4 })), 'A4');
  assert.ok(Math.abs(notes.noteWithA4({ name: 'A', octave: 4 }).frequency - 440) < 0.001);

  const f2 = notes.noteWithA4({ name: 'E', octave: 2 }, 440, 'equal', 1);
  assert.equal(notes.getNoteDisplay(f2), 'F2');

  const standardWithCapo = notes.scaleTuning(
    notes.BUILT_IN_TUNINGS.find((tuning) => tuning.id === 'standard'),
    440,
    'equal',
    1,
  );
  assert.equal(notes.getNoteDisplay(standardWithCapo.strings[0]), 'F2');

  const sweetened = notes.applyCentsOffset(notes.noteWithA4({ name: 'A', octave: 4 }), 12);
  assert.ok(sweetened.frequency > 440);

  const closest = notes.findClosestString(111, standardWithCapo.strings);
  assert.equal(notes.getNoteDisplay(closest), 'A#2');

  assert.ok(notes.INSTRUMENTS.some((instrument) => instrument.id === 'guitar-7'));
  assert.ok(notes.INSTRUMENTS.some((instrument) => instrument.id === 'mandolin'));
  assert.ok(notes.TEMPERAMENTS.some((temperament) => temperament.id === 'vallotti'));
  assert.equal(notes.BUILT_IN_TUNINGS.find((tuning) => tuning.id === 'guitar-7-standard').strings.length, 7);
  assert.equal(notes.BUILT_IN_TUNINGS.find((tuning) => tuning.id === 'twelve-string-standard').strings.length, 12);
  assert.equal(notes.getNoteDisplay(notes.BUILT_IN_TUNINGS.find((tuning) => tuning.id === 'cello-standard').strings[0]), 'C2');

  assert.equal(notes.temperamentOffset('C', 'just', 'C'), 0);
  assert.notEqual(notes.temperamentOffset('C', 'just', 'A'), 0);
  const customTemperaments = [
    ...notes.TEMPERAMENTS,
    { id: 'custom-test', name: 'Custom Test', offsets: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  ];
  assert.equal(notes.temperamentOffset('D', 'custom-test', 'C', customTemperaments), 2);

  const sampleRate = 44100;
  const buffer = sineBuffer(110, sampleRate, 4096);
  assertDetectedPitch(pitch, buffer, sampleRate, 110, 1.5, undefined, 'A2 sine');

  const silence = new Float32Array(4096);
  const silenceStats = pitch.computeSignalStats(silence);
  assert.equal(silenceStats.rms, 0);
  assert.equal(silenceStats.maxAbs, 0);
  assert.equal(pitch.detectPitch(silence, sampleRate, silenceStats), null);

  const noisyBuffer = noisySineBuffer(110, sampleRate, 4096);
  assertDetectedPitch(pitch, noisyBuffer, sampleRate, 110, 2.0, undefined, 'noisy A2 sine');

  assert.deepEqual(
    pitch.normalizePitchDetectionRange({ minFrequency: 100, maxFrequency: 110 }),
    pitch.DEFAULT_PITCH_DETECTION_RANGE,
  );

  const b0Frequency = notes.noteWithA4({ name: 'B', octave: 0 }).frequency;
  const b0Buffer = sineBuffer(b0Frequency, sampleRate, 4096);
  assertDetectedPitch(
    pitch,
    b0Buffer,
    sampleRate,
    b0Frequency,
    0.8,
    { minFrequency: 20, maxFrequency: 80 },
    'low bass B0',
  );

  const e5Frequency = notes.noteWithA4({ name: 'E', octave: 5 }).frequency;
  const e5Buffer = sineBuffer(e5Frequency, sampleRate, 4096);
  assertDetectedPitch(
    pitch,
    e5Buffer,
    sampleRate,
    e5Frequency,
    2.5,
    { minFrequency: 180, maxFrequency: 1000 },
    'high mandolin/violin E5',
  );

  const smoother = new pitch.FrequencySmoother();
  assert.equal(smoother.add(null), null);
  assert.equal(smoother.add(110), 110);
  assert.ok(smoother.add(112) > 110);
  smoother.reset();
  assert.equal(smoother.add(null), null);

  process.stdout.write('core tests passed\n');
} finally {
  await rm(tempDir, { force: true, recursive: true });
}
