import { MUSIC_REGISTRY } from '../domain/musicRegistry';
import {
  NOTE_NAMES,
  applyCentsOffsetFrequency,
  closestNoteIndex,
  formatFreq,
  frequencyToNearestMidi,
  getCents,
  getNoteDisplay,
  midiToFrequency as equalTemperedMidiToFrequency,
  noteNameFromMidi,
  noteNameIndex,
  noteToMidi as generatedNoteToMidi,
  octaveFromMidi,
} from '../generated/noteMath';

export { NOTE_NAMES, formatFreq, getCents, getNoteDisplay };

export type NoteName = typeof NOTE_NAMES[number];
export type InstrumentId = string;
export type SweeteningProfileId = string;
export type TemperamentId = string;

export interface Note {
  name: NoteName;
  octave: number;
  frequency: number;
}

export interface DetectedNote {
  note: Note;
  cents: number;
  frequency: number;
}

export interface Tuning {
  id: string;
  name: string;
  strings: Note[];
  instrument?: InstrumentId;
  kind?: 'chromatic' | 'built-in' | 'custom';
}

export interface InstrumentPreset {
  id: InstrumentId;
  name: string;
  defaultTuningId: string;
  custom?: boolean;
}

export interface Temperament {
  id: TemperamentId;
  name: string;
  offsets: number[];
  description?: string;
  custom?: boolean;
}

export interface SweeteningProfile {
  id: SweeteningProfileId;
  name: string;
  offsets: number[];
}

const ZERO_OFFSETS = Array.from({ length: 12 }, () => 0);

export const INSTRUMENTS: InstrumentPreset[] = MUSIC_REGISTRY.instruments.map((instrument) => ({
  ...instrument,
}));

export const TEMPERAMENTS: Temperament[] = [
  {
    id: 'equal',
    name: 'Equal',
    offsets: ZERO_OFFSETS,
    description: '12 equal semitones.',
  },
  {
    id: 'just',
    name: 'Just',
    offsets: [0, 12, 4, 16, -14, -2, 10, 2, 14, -16, 18, -12],
    description: 'Simple-ratio color around the selected root.',
  },
  {
    id: 'pythagorean',
    name: 'Pythagorean',
    offsets: [0, 14, 2, -6, 8, -4, 10, -2, -8, 6, -6, 8],
    description: 'Fifth-stacked tuning around the selected root.',
  },
  {
    id: 'meantone',
    name: '1/4-comma Meantone',
    offsets: [0, -24, -7, 10, -14, 3, -20, -3, -27, -10, 7, -17],
    description: 'Historically sweet thirds with sharper wolf regions.',
  },
  {
    id: 'werckmeister',
    name: 'Werckmeister III',
    offsets: [0, -10, -4, -6, -8, 2, -12, -2, -8, -6, -4, -10],
    description: 'Well temperament with usable remote keys.',
  },
  {
    id: 'kirnberger',
    name: 'Kirnberger III',
    offsets: [0, -8, -4, 6, -10, 2, -6, -2, 4, -6, 8, -8],
    description: 'Well temperament with clear key color.',
  },
  {
    id: 'vallotti',
    name: 'Vallotti',
    offsets: [0, -6, -4, -2, -8, 2, -8, 0, -4, -6, 0, -10],
    description: 'Balanced 18th-century well temperament.',
  },
];

export const SWEETENING_PROFILES: SweeteningProfile[] = [
  { id: 'none', name: 'None', offsets: [] },
  { id: 'sweet-guitar', name: 'Sweet Guitar', offsets: [-2, -1, 0, 0, -1, -2] },
  { id: 'sweet-guitar-7', name: 'Sweet Guitar 7-string', offsets: [-3, -2, -1, 0, 0, -1, -2] },
  { id: 'sweet-baritone-guitar', name: 'Sweet Baritone Guitar', offsets: [-3, -2, -1, 0, -1, -2] },
  { id: 'sweet-guitar-12', name: 'Sweet 12-string', offsets: [-2, -2, -1, -1, 0, 0, 0, 0, -1, -1, -2, -2] },
  { id: 'sweet-bass', name: 'Sweet Bass', offsets: [-3, -2, -1, 0, 0, 0] },
  { id: 'sweet-ukulele', name: 'Sweet Ukulele', offsets: [-1, 0, 0, -1] },
  { id: 'sweet-baritone-ukulele', name: 'Sweet Baritone Ukulele', offsets: [-1, 0, 0, -1] },
  { id: 'sweet-mandolin', name: 'Sweet Mandolin', offsets: [0, 1, 0, 1] },
  { id: 'sweet-banjo', name: 'Sweet Banjo', offsets: [0, -1, 0, 0, -1] },
  { id: 'sweet-violin', name: 'Sweet Violin', offsets: [0, 2, 0, 1] },
  { id: 'sweet-viola', name: 'Sweet Viola', offsets: [0, 1, 0, 1] },
  { id: 'sweet-cello', name: 'Sweet Cello', offsets: [0, 1, 0, 1] },
  { id: 'custom', name: 'Custom', offsets: [] },
];

function note(name: NoteName, octave: number): Note {
  return {
    name,
    octave,
    frequency: equalFrequency(name, octave),
  };
}

export const CHROMATIC_TUNING: Tuning = {
  id: 'chromatic',
  name: 'Chromatic',
  strings: [],
  instrument: 'chromatic',
  kind: 'chromatic',
};

export const BUILT_IN_TUNINGS: Tuning[] = MUSIC_REGISTRY.tunings.map((tuning) => ({
  id: tuning.id,
  name: tuning.name,
  strings: tuning.strings.map(([name, octave]) => note(name as NoteName, octave)),
  instrument: tuning.instrument,
  kind: 'built-in',
}));

export const GUITAR_STRINGS_STANDARD: Note[] = [
  ...(BUILT_IN_TUNINGS.find((tuning) => tuning.id === 'standard')?.strings ?? []),
];

export const TUNINGS: Tuning[] = [CHROMATIC_TUNING, ...BUILT_IN_TUNINGS];

function equalFrequency(name: NoteName, octave: number, a4 = 440): number {
  return equalTemperedMidiToFrequency(generatedNoteToMidi(name, octave), a4);
}

export function normalizeTemperamentOffsets(offsets: unknown): number[] {
  if (!Array.isArray(offsets)) return [...ZERO_OFFSETS];
  return Array.from({ length: 12 }, (_, index) => {
    const value = Number(offsets[index]);
    if (!Number.isFinite(value)) return 0;
    return Math.max(-50, Math.min(50, Math.round(value)));
  });
}

function resolveTemperament(
  temperament: TemperamentId,
  temperaments: Temperament[] = TEMPERAMENTS,
): Temperament {
  return temperaments.find((item) => item.id === temperament) || TEMPERAMENTS[0];
}

export function temperamentOffset(
  name: NoteName,
  temperament: TemperamentId = 'equal',
  root: NoteName = 'A',
  temperaments: Temperament[] = TEMPERAMENTS,
) {
  const offsets = normalizeTemperamentOffsets(resolveTemperament(temperament, temperaments).offsets);
  const interval = (noteNameIndex(name) - noteNameIndex(root) + 12) % 12;
  return offsets[interval] ?? 0;
}

export function temperamentOffsetsByNote(
  temperament: TemperamentId = 'equal',
  root: NoteName = 'A',
  temperaments: Temperament[] = TEMPERAMENTS,
): Record<NoteName, number> {
  return NOTE_NAMES.reduce((acc, name) => ({
    ...acc,
    [name]: temperamentOffset(name, temperament, root, temperaments),
  }), {} as Record<NoteName, number>);
}

export function midiToFrequency(
  midi: number,
  a4 = 440,
  temperament: TemperamentId = 'equal',
  root: NoteName = 'A',
  temperaments: Temperament[] = TEMPERAMENTS,
): number {
  const equalFrequencyForMidi = equalTemperedMidiToFrequency(midi, a4);
  return applyCentsOffsetFrequency(
    equalFrequencyForMidi,
    temperamentOffset(noteNameFromMidi(midi), temperament, root, temperaments),
  );
}

export function frequencyToMidi(freq: number, a4 = 440): number {
  return frequencyToNearestMidi(freq, a4);
}

export function noteToMidi(note: Pick<Note, 'name' | 'octave'>): number {
  return generatedNoteToMidi(note.name, note.octave);
}

export function noteFromMidi(
  midi: number,
  a4 = 440,
  temperament: TemperamentId = 'equal',
  root: NoteName = 'A',
  temperaments: Temperament[] = TEMPERAMENTS,
): Note {
  return {
    name: noteNameFromMidi(midi),
    octave: octaveFromMidi(midi),
    frequency: midiToFrequency(midi, a4, temperament, root, temperaments),
  };
}

export function noteWithA4(
  note: Pick<Note, 'name' | 'octave'>,
  a4 = 440,
  temperament: TemperamentId = 'equal',
  semitoneOffset = 0,
  root: NoteName = 'A',
  temperaments: Temperament[] = TEMPERAMENTS,
): Note {
  return noteFromMidi(noteToMidi(note) + semitoneOffset, a4, temperament, root, temperaments);
}

export function applyCentsOffset(note: Note, cents: number): Note {
  return {
    ...note,
    frequency: applyCentsOffsetFrequency(note.frequency, cents),
  };
}

export function noteId(note: Pick<Note, 'name' | 'octave'>): string {
  return `${note.name}${note.octave}`;
}

export function scaleTuning(
  tuning: Tuning,
  a4 = 440,
  temperament: TemperamentId = 'equal',
  semitoneOffset = 0,
  root: NoteName = 'A',
  temperaments: Temperament[] = TEMPERAMENTS,
): Tuning {
  return {
    ...tuning,
    strings: tuning.strings.map((string) => noteWithA4(string, a4, temperament, semitoneOffset, root, temperaments)),
  };
}

export function frequencyToNote(
  freq: number,
  a4 = 440,
  temperament: TemperamentId = 'equal',
  root: NoteName = 'A',
  temperaments: Temperament[] = TEMPERAMENTS,
): Note {
  const midi = frequencyToMidi(freq, a4);
  const candidates = Array.from({ length: 5 }, (_, index) => (
    noteFromMidi(midi + index - 2, a4, temperament, root, temperaments)
  ));
  return candidates[closestNoteIndex(freq, candidates) ?? 2];
}

export function findClosestString(frequency: number, strings: Note[] = GUITAR_STRINGS_STANDARD): Note {
  return strings[closestNoteIndex(frequency, strings) ?? 0];
}
