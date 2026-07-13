import { describe, expect, it } from 'vitest';

import {
  createCustomTemperament,
  createCustomTuning,
  createInstrumentProfile,
  normalizeImportedTunings,
} from '../src/domain/customLibrary';
import {
  detectionRangeForStrings,
  offsetsForProfile,
} from '../src/domain/tuningCalculations';
import { noteWithA4, type Tuning } from '../src/utils/notes';

describe('custom tuning domain', () => {
  const e2 = noteWithA4({ name: 'E', octave: 2 }, 440);

  it('creates deterministic custom entities without mutating input', () => {
    const tuning = createCustomTuning({ name: '  Test  ', strings: [e2] }, 'guitar', 42);
    expect(tuning.id).toBe('custom-16');
    expect(tuning.name).toBe('Test');

    const instrument = createInstrumentProfile('Travel', [e2], 42);
    expect(instrument?.profile.defaultTuningId).toBe('instrument-16-default');
    expect(instrument?.tuning.instrument).toBe('instrument-16');

    const temperament = createCustomTemperament({ name: '', offsets: [100, -100] }, 42);
    expect(temperament.name).toBe('Custom temperament');
    expect(temperament.offsets).toHaveLength(12);
  });

  it('filters malformed imported tunings and assigns stable ids', () => {
    const source = [
      { id: '', name: 'Imported', strings: [e2] },
      { id: 'empty', name: 'Empty', strings: [] },
    ] as Tuning[];
    const imported = normalizeImportedTunings(source, 'bass', 42);

    expect(imported).toHaveLength(1);
    expect(imported[0].id).toBe('custom-import-16-0');
    expect(imported[0].instrument).toBe('bass');
  });

  it('does not let imported tunings shadow built-ins or target unknown instruments', () => {
    const imported = normalizeImportedTunings([
      {
        id: 'standard',
        name: 'Collision',
        strings: [e2],
        instrument: 'missing',
      },
    ], 'bass', 42, new Set(['bass']));

    expect(imported[0].id).toBe('custom-import-16-0');
    expect(imported[0].instrument).toBe('bass');
  });
});

describe('tuning calculations', () => {
  it('derives instrument-aware detection ranges', () => {
    expect(detectionRangeForStrings([], 'vocal')).toEqual({
      minFrequency: 65,
      maxFrequency: 1_100,
    });
    const range = detectionRangeForStrings([
      noteWithA4({ name: 'E', octave: 2 }, 440),
      noteWithA4({ name: 'E', octave: 4 }, 440),
    ], 'guitar');
    expect(range.minFrequency).toBeLessThan(82.5);
    expect(range.maxFrequency).toBeGreaterThan(329);

    const selected = noteWithA4({ name: 'E', octave: 2 }, 440);
    expect(detectionRangeForStrings([], 'guitar', selected)).toEqual({
      minFrequency: 53,
      maxFrequency: 120,
    });
  });

  it('pads custom sweetening offsets to the string count', () => {
    expect(offsetsForProfile('custom', 'guitar', 4, [1, -2])).toEqual([1, -2, 0, 0]);
    expect(offsetsForProfile('none', 'guitar', 3, [9])).toEqual([0, 0, 0]);
  });
});
