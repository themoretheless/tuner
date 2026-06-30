import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  BUILT_IN_TUNINGS,
  findClosestString,
  frequencyToNote,
  getCents,
  getNoteDisplay,
} from '../src/utils/notes';

interface RustNote {
  name: string;
  octave: number;
  frequency: number;
}

interface RustTuning {
  name: string;
  strings: RustNote[];
}

interface RustFrequencySample {
  frequency: number;
  a4: number;
  note: string;
  cents: number;
}

interface RustClosestStringSample {
  frequency: number;
  a4: number;
  tuning: string;
  note: RustNote;
  cents: number;
}

interface RustDomainSnapshot {
  tunings: RustTuning[];
  frequencyToNote: RustFrequencySample[];
  closestString: RustClosestStringSample[];
}

let rustSnapshot: RustDomainSnapshot | null = null;

function repoRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

function loadRustSnapshot() {
  if (!rustSnapshot) {
    const output = execFileSync('cargo', [
      'run',
      '--quiet',
      '-p',
      'pitch-core',
      '--example',
      'domain_snapshot',
    ], {
      cwd: repoRoot(),
      encoding: 'utf8',
    });
    rustSnapshot = JSON.parse(output) as RustDomainSnapshot;
  }
  return rustSnapshot;
}

function expectClose(actual: number, expected: number, tolerance: number, label: string) {
  expect(Math.abs(actual - expected), label).toBeLessThanOrEqual(tolerance);
}

describe('Rust/Web music-domain parity', () => {
  it('keeps built-in tuning registries in lockstep', () => {
    const snapshot = loadRustSnapshot();
    const rustNames = snapshot.tunings.map((tuning) => tuning.name);
    const webNames = BUILT_IN_TUNINGS.map((tuning) => tuning.name);

    expect(rustNames).toEqual(webNames);

    for (const rustTuning of snapshot.tunings) {
      const webTuning = BUILT_IN_TUNINGS.find((tuning) => tuning.name === rustTuning.name);
      expect(webTuning, `missing web tuning ${rustTuning.name}`).toBeDefined();
      expect(rustTuning.strings).toHaveLength(webTuning!.strings.length);

      rustTuning.strings.forEach((rustString, index) => {
        const webString = webTuning!.strings[index];
        expect(rustString.name, `${rustTuning.name} string ${index} name`).toBe(webString.name);
        expect(rustString.octave, `${rustTuning.name} string ${index} octave`).toBe(webString.octave);
        expectClose(
          webString.frequency,
          rustString.frequency,
          0.02,
          `${rustTuning.name} string ${index} frequency`,
        );
      });
    }
  });

  it('keeps frequency-to-note and cents math aligned', () => {
    const snapshot = loadRustSnapshot();

    for (const sample of snapshot.frequencyToNote) {
      const webNote = frequencyToNote(sample.frequency, sample.a4);
      expect(getNoteDisplay(webNote), `${sample.frequency}Hz @ A4=${sample.a4}`).toBe(sample.note);
      expectClose(
        getCents(sample.frequency, webNote.frequency),
        sample.cents,
        0.05,
        `${sample.frequency}Hz cents @ A4=${sample.a4}`,
      );
    }
  });

  it('keeps closest-string resolution aligned', () => {
    const snapshot = loadRustSnapshot();

    for (const sample of snapshot.closestString) {
      const tuning = BUILT_IN_TUNINGS.find((candidate) => candidate.name === sample.tuning);
      expect(tuning, `missing web tuning ${sample.tuning}`).toBeDefined();

      const webString = findClosestString(sample.frequency, tuning!.strings);
      expect(webString.name, `${sample.frequency}Hz closest string`).toBe(sample.note.name);
      expect(webString.octave, `${sample.frequency}Hz closest octave`).toBe(sample.note.octave);
      expectClose(webString.frequency, sample.note.frequency, 0.02, `${sample.frequency}Hz closest frequency`);
      expectClose(getCents(sample.frequency, webString.frequency), sample.cents, 0.05, `${sample.frequency}Hz cents`);
    }
  });
});
