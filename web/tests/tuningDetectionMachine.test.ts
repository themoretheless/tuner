import { describe, expect, it } from 'vitest';
import { createTuningDetectionMachine } from '../src/domain/tuningDetectionMachine';
import { TEMPERAMENTS, TUNINGS, type Note } from '../src/utils/notes';

const strings = TUNINGS.find((tuning) => tuning.id === 'standard')!.strings;

describe('tuning detection machine', () => {
  it('turns sequential frequencies into explicit sticky-target snapshots', () => {
    const machine = createTuningDetectionMachine();

    expect(machine.process(input(95)).targetNote.name).toBe('E');
    expect(machine.process(input(95.5)).targetNote.name).toBe('E');
    expect(machine.process(input(104)).targetNote.name).toBe('A');

    expect(machine.process(input(null)).detectedNote).toBeNull();
    expect(machine.process(input(95)).targetNote.name).toBe('E');
  });

  it('keeps hysteresis inside process instead of mutating a computed getter', () => {
    const machine = createTuningDetectionMachine(5, 7);

    expect(machine.process(input(strings[0].frequency * 2 ** (4 / 1200))).isInTune).toBe(true);
    expect(machine.process(input(strings[0].frequency * 2 ** (6 / 1200))).isInTune).toBe(true);
    expect(machine.process(input(strings[0].frequency * 2 ** (8 / 1200))).isInTune).toBe(false);
  });

  it('always provides a valid idle target for an empty non-chromatic tuning', () => {
    const machine = createTuningDetectionMachine();
    const snapshot = machine.process(input(null, []));

    expect(snapshot.targetNote.frequency).toBeGreaterThan(0);
    expect(snapshot.currentNoteDisplay).toBeNull();
  });
});

function input(frequency: number | null, activeStrings: Note[] = strings) {
  return {
    a4: 440,
    frequency,
    isChromaticMode: false,
    selectedString: null,
    strings: activeStrings,
    temperament: 'equal',
    temperamentOptions: TEMPERAMENTS,
    temperamentRoot: 'A' as const,
    transpose: 0,
  };
}
