import { describe, expect, it } from 'vitest';

import {
  applyCentsOffsetFrequency,
  closestNoteIndex,
  frequencyToNearestMidi,
  getCents,
  midiToFrequency as generatedMidiToFrequency,
} from '../src/generated/noteMath';
import {
  TEMPERAMENTS,
  frequencyToMidi,
  frequencyToNote,
  getNoteDisplay,
  midiToFrequency,
  noteFromMidi,
  noteToMidi,
  noteWithA4,
} from '../src/utils/notes';

describe('generated note math', () => {
  it('round-trips the supported musical range across reference pitches', () => {
    for (let a4 = 415; a4 <= 465; a4 += 5) {
      for (let midi = 21; midi <= 120; midi += 1) {
        const frequency = generatedMidiToFrequency(midi, a4);
        expect(frequencyToNearestMidi(frequency, a4)).toBe(midi);
        expect(frequencyToMidi(frequency, a4)).toBe(midi);

        const note = noteFromMidi(midi, a4);
        expect(noteToMidi(note)).toBe(midi);
        expect(getNoteDisplay(frequencyToNote(frequency, a4))).toBe(getNoteDisplay(note));
        expect(Math.abs(getCents(frequency, note.frequency))).toBeLessThan(1e-8);
      }
    }
  });

  it('round-trips cents offsets over low, middle, and high frequencies', () => {
    for (const frequency of [27.5, 82.4069, 440, 4186.009]) {
      for (const cents of [-50, -25, -1, 0, 1, 25, 50]) {
        const shifted = applyCentsOffsetFrequency(frequency, cents);
        expect(getCents(shifted, frequency)).toBeCloseTo(cents, 10);
      }
    }
  });

  it('keeps temperament composition on top of generated equal-temperament math', () => {
    for (const temperament of TEMPERAMENTS) {
      for (const midi of [40, 57, 69, 76, 88]) {
        const frequency = midiToFrequency(midi, 442, temperament.id, 'C');
        const note = frequencyToNote(frequency, 442, temperament.id, 'C');
        expect(noteToMidi(note)).toBe(midi);
      }
    }
  });

  it('preserves MIDI distance through transpose and capo offsets', () => {
    for (const baseMidi of [28, 40, 52, 64, 76, 88]) {
      const base = noteFromMidi(baseMidi);
      for (let semitoneOffset = -12; semitoneOffset <= 12; semitoneOffset += 1) {
        const shifted = noteWithA4(base, 440, 'equal', semitoneOffset);
        expect(noteToMidi(shifted)).toBe(baseMidi + semitoneOffset);
      }
    }
  });

  it('returns explicit sentinels for invalid primitive inputs', () => {
    const targets = [{ frequency: 110 }, { frequency: 220 }];
    expect(closestNoteIndex(112, targets)).toBe(0);
    expect(closestNoteIndex(218, targets)).toBe(1);
    expect(closestNoteIndex(Number.NaN, targets)).toBeNull();
    expect(closestNoteIndex(110, targets, 0)).toBeNull();
    expect(generatedMidiToFrequency(69, Number.NaN)).toBe(0);
    expect(getCents(0, 440)).toBe(0);
  });
});
