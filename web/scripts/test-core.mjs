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
  const buffer = new Float32Array(2048);
  for (let i = 0; i < buffer.length; i += 1) {
    buffer[i] = Math.sin((2 * Math.PI * 110 * i) / sampleRate) * 0.4;
  }
  const stats = pitch.computeSignalStats(buffer);
  const detected = pitch.detectPitch(buffer, sampleRate, stats);
  assert.ok(detected != null, 'pitch should be detected');
  assert.ok(Math.abs(detected - 110) < 1.5, `expected ~110Hz, got ${detected}`);

  process.stdout.write('core tests passed\n');
} finally {
  await rm(tempDir, { force: true, recursive: true });
}
