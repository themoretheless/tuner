export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export type NoteName = typeof NOTE_NAMES[number];
export type InstrumentId = 'chromatic' | 'guitar' | 'bass' | 'ukulele' | 'violin';
export type SweeteningProfileId = 'none' | 'sweet-guitar' | 'sweet-bass' | 'sweet-ukulele' | 'sweet-violin' | 'custom';
export type TemperamentId = 'equal' | 'just' | 'pythagorean';

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
}

export interface Temperament {
  id: TemperamentId;
  name: string;
}

export interface SweeteningProfile {
  id: SweeteningProfileId;
  name: string;
  offsets: number[];
}

export const INSTRUMENTS: InstrumentPreset[] = [
  { id: 'guitar', name: 'Guitar', defaultTuningId: 'standard' },
  { id: 'bass', name: 'Bass', defaultTuningId: 'bass-standard' },
  { id: 'ukulele', name: 'Ukulele', defaultTuningId: 'ukulele-standard' },
  { id: 'violin', name: 'Violin', defaultTuningId: 'violin-standard' },
  { id: 'chromatic', name: 'Chromatic', defaultTuningId: 'chromatic' },
];

export const TEMPERAMENTS: Temperament[] = [
  { id: 'equal', name: 'Equal' },
  { id: 'just', name: 'Just A' },
  { id: 'pythagorean', name: 'Pythagorean A' },
];

export const SWEETENING_PROFILES: SweeteningProfile[] = [
  { id: 'none', name: 'None', offsets: [] },
  { id: 'sweet-guitar', name: 'Sweet Guitar', offsets: [-2, -1, 0, 0, -1, -2] },
  { id: 'sweet-bass', name: 'Sweet Bass', offsets: [-3, -2, -1, 0, 0, 0] },
  { id: 'sweet-ukulele', name: 'Sweet Ukulele', offsets: [-1, 0, 0, -1] },
  { id: 'sweet-violin', name: 'Sweet Violin', offsets: [0, 2, 0, 1] },
  { id: 'custom', name: 'Custom', offsets: [] },
];

const TEMPERAMENT_OFFSETS: Record<TemperamentId, Record<NoteName, number>> = {
  equal: {
    C: 0, 'C#': 0, D: 0, 'D#': 0, E: 0, F: 0,
    'F#': 0, G: 0, 'G#': 0, A: 0, 'A#': 0, B: 0,
  },
  just: {
    C: 16, 'C#': -14, D: -2, 'D#': 10, E: 2, F: 14,
    'F#': -16, G: 18, 'G#': -12, A: 0, 'A#': 12, B: 4,
  },
  pythagorean: {
    C: -6, 'C#': 8, D: -4, 'D#': 10, E: -2, F: -8,
    'F#': 6, G: -6, 'G#': 8, A: 0, 'A#': 14, B: 2,
  },
};

export const GUITAR_STRINGS_STANDARD: Note[] = [
  { name: 'E', octave: 2, frequency: 82.4069 },
  { name: 'A', octave: 2, frequency: 110.0000 },
  { name: 'D', octave: 3, frequency: 146.8324 },
  { name: 'G', octave: 3, frequency: 195.9977 },
  { name: 'B', octave: 3, frequency: 246.9417 },
  { name: 'E', octave: 4, frequency: 329.6276 },
];

export const CHROMATIC_TUNING: Tuning = {
  id: 'chromatic',
  name: 'Chromatic',
  strings: [],
  instrument: 'chromatic',
  kind: 'chromatic',
};

export const BUILT_IN_TUNINGS: Tuning[] = [
  {
    id: 'standard',
    name: 'Standard (EADGBE)',
    strings: [...GUITAR_STRINGS_STANDARD],
    instrument: 'guitar',
    kind: 'built-in',
  },
  {
    id: 'drop-d',
    name: 'Drop D (DADGBE)',
    strings: [
      { name: 'D', octave: 2, frequency: 73.4162 },
      { name: 'A', octave: 2, frequency: 110.0000 },
      { name: 'D', octave: 3, frequency: 146.8324 },
      { name: 'G', octave: 3, frequency: 195.9977 },
      { name: 'B', octave: 3, frequency: 246.9417 },
      { name: 'E', octave: 4, frequency: 329.6276 },
    ],
    instrument: 'guitar',
    kind: 'built-in',
  },
  {
    id: 'dadgad',
    name: 'DADGAD',
    strings: [
      { name: 'D', octave: 2, frequency: 73.4162 },
      { name: 'A', octave: 2, frequency: 110.0000 },
      { name: 'D', octave: 3, frequency: 146.8324 },
      { name: 'G', octave: 3, frequency: 195.9977 },
      { name: 'A', octave: 3, frequency: 220.0000 },
      { name: 'D', octave: 4, frequency: 293.6648 },
    ],
    instrument: 'guitar',
    kind: 'built-in',
  },
  {
    id: 'open-g',
    name: 'Open G (DGDGBD)',
    strings: [
      { name: 'D', octave: 2, frequency: 73.4162 },
      { name: 'G', octave: 2, frequency: 97.9989 },
      { name: 'D', octave: 3, frequency: 146.8324 },
      { name: 'G', octave: 3, frequency: 195.9977 },
      { name: 'B', octave: 3, frequency: 246.9417 },
      { name: 'D', octave: 4, frequency: 293.6648 },
    ],
    instrument: 'guitar',
    kind: 'built-in',
  },
  {
    id: 'open-d',
    name: 'Open D (DADF#AD)',
    strings: [
      { name: 'D', octave: 2, frequency: 73.4162 },
      { name: 'A', octave: 2, frequency: 110.0000 },
      { name: 'D', octave: 3, frequency: 146.8324 },
      { name: 'F#', octave: 3, frequency: 184.9972 },
      { name: 'A', octave: 3, frequency: 220.0000 },
      { name: 'D', octave: 4, frequency: 293.6648 },
    ],
    instrument: 'guitar',
    kind: 'built-in',
  },
  {
    id: 'drop-c',
    name: 'Drop C (CGCFAD)',
    strings: [
      { name: 'C', octave: 2, frequency: 65.4064 },
      { name: 'G', octave: 2, frequency: 97.9989 },
      { name: 'C', octave: 3, frequency: 130.8128 },
      { name: 'F', octave: 3, frequency: 174.6141 },
      { name: 'A', octave: 3, frequency: 220.0000 },
      { name: 'D', octave: 4, frequency: 293.6648 },
    ],
    instrument: 'guitar',
    kind: 'built-in',
  },
  {
    id: 'half-step-down',
    name: 'Half Step Down (D# G# C# F# A# D#)',
    strings: [
      { name: 'D#', octave: 2, frequency: 77.7817 },
      { name: 'G#', octave: 2, frequency: 103.8262 },
      { name: 'C#', octave: 3, frequency: 138.5913 },
      { name: 'F#', octave: 3, frequency: 185.0 },
      { name: 'A#', octave: 3, frequency: 233.0819 },
      { name: 'D#', octave: 4, frequency: 311.12698 },
    ],
    instrument: 'guitar',
    kind: 'built-in',
  },
  {
    id: 'open-e',
    name: 'Open E (EBEG#BE)',
    strings: [
      { name: 'E', octave: 2, frequency: 82.4069 },
      { name: 'B', octave: 2, frequency: 123.4708 },
      { name: 'E', octave: 3, frequency: 164.8138 },
      { name: 'G#', octave: 3, frequency: 207.6523 },
      { name: 'B', octave: 3, frequency: 246.9417 },
      { name: 'E', octave: 4, frequency: 329.6276 },
    ],
    instrument: 'guitar',
    kind: 'built-in',
  },
  {
    id: 'bass-standard',
    name: 'Bass Standard (EADG)',
    strings: [
      { name: 'E', octave: 1, frequency: 41.2034 },
      { name: 'A', octave: 1, frequency: 55.0000 },
      { name: 'D', octave: 2, frequency: 73.4162 },
      { name: 'G', octave: 2, frequency: 97.9989 },
    ],
    instrument: 'bass',
    kind: 'built-in',
  },
  {
    id: 'bass-5-string',
    name: 'Bass 5-string (BEADG)',
    strings: [
      { name: 'B', octave: 0, frequency: 30.8677 },
      { name: 'E', octave: 1, frequency: 41.2034 },
      { name: 'A', octave: 1, frequency: 55.0000 },
      { name: 'D', octave: 2, frequency: 73.4162 },
      { name: 'G', octave: 2, frequency: 97.9989 },
    ],
    instrument: 'bass',
    kind: 'built-in',
  },
  {
    id: 'ukulele-standard',
    name: 'Ukulele Standard (GCEA)',
    strings: [
      { name: 'G', octave: 4, frequency: 391.9954 },
      { name: 'C', octave: 4, frequency: 261.6256 },
      { name: 'E', octave: 4, frequency: 329.6276 },
      { name: 'A', octave: 4, frequency: 440.0000 },
    ],
    instrument: 'ukulele',
    kind: 'built-in',
  },
  {
    id: 'ukulele-low-g',
    name: 'Ukulele Low G (GCEA)',
    strings: [
      { name: 'G', octave: 3, frequency: 195.9977 },
      { name: 'C', octave: 4, frequency: 261.6256 },
      { name: 'E', octave: 4, frequency: 329.6276 },
      { name: 'A', octave: 4, frequency: 440.0000 },
    ],
    instrument: 'ukulele',
    kind: 'built-in',
  },
  {
    id: 'violin-standard',
    name: 'Violin Standard (GDAE)',
    strings: [
      { name: 'G', octave: 3, frequency: 195.9977 },
      { name: 'D', octave: 4, frequency: 293.6648 },
      { name: 'A', octave: 4, frequency: 440.0000 },
      { name: 'E', octave: 5, frequency: 659.2551 },
    ],
    instrument: 'violin',
    kind: 'built-in',
  },
];

export const TUNINGS: Tuning[] = [CHROMATIC_TUNING, ...BUILT_IN_TUNINGS];

function noteNameFromMidi(midi: number): NoteName {
  return NOTE_NAMES[((midi % 12) + 12) % 12];
}

function temperamentOffset(name: NoteName, temperament: TemperamentId) {
  return TEMPERAMENT_OFFSETS[temperament]?.[name] ?? 0;
}

export function midiToFrequency(midi: number, a4 = 440, temperament: TemperamentId = 'equal'): number {
  const equalFrequency = a4 * Math.pow(2, (midi - 69) / 12);
  return equalFrequency * Math.pow(2, temperamentOffset(noteNameFromMidi(midi), temperament) / 1200);
}

export function frequencyToMidi(freq: number, a4 = 440): number {
  return Math.round(69 + 12 * Math.log2(freq / a4));
}

export function noteToMidi(note: Pick<Note, 'name' | 'octave'>): number {
  const index = NOTE_NAMES.indexOf(note.name);
  return (note.octave + 1) * 12 + index;
}

export function noteFromMidi(midi: number, a4 = 440, temperament: TemperamentId = 'equal'): Note {
  return {
    name: noteNameFromMidi(midi),
    octave: Math.floor(midi / 12) - 1,
    frequency: midiToFrequency(midi, a4, temperament),
  };
}

export function noteWithA4(
  note: Pick<Note, 'name' | 'octave'>,
  a4 = 440,
  temperament: TemperamentId = 'equal',
  semitoneOffset = 0,
): Note {
  return noteFromMidi(noteToMidi(note) + semitoneOffset, a4, temperament);
}

export function applyCentsOffset(note: Note, cents: number): Note {
  return {
    ...note,
    frequency: note.frequency * Math.pow(2, cents / 1200),
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
): Tuning {
  return {
    ...tuning,
    strings: tuning.strings.map((string) => noteWithA4(string, a4, temperament, semitoneOffset)),
  };
}

export function frequencyToNote(freq: number, a4 = 440, temperament: TemperamentId = 'equal'): Note {
  const midi = frequencyToMidi(freq, a4);
  let closest = noteFromMidi(midi, a4, temperament);
  let minDiff = Math.abs(Math.log2(freq / closest.frequency));

  for (let candidate = midi - 2; candidate <= midi + 2; candidate++) {
    const note = noteFromMidi(candidate, a4, temperament);
    const diff = Math.abs(Math.log2(freq / note.frequency));
    if (diff < minDiff) {
      minDiff = diff;
      closest = note;
    }
  }

  return closest;
}

export function getCents(frequency: number, targetFrequency: number): number {
  if (!frequency || !targetFrequency) return 0;
  return 1200 * Math.log2(frequency / targetFrequency);
}

export function findClosestString(frequency: number, strings: Note[] = GUITAR_STRINGS_STANDARD): Note {
  if (!frequency) return strings[0];
  let closest = strings[0];
  let minDiff = Infinity;
  for (const s of strings) {
    const diff = Math.abs(Math.log2(frequency / s.frequency));
    if (diff < minDiff) {
      minDiff = diff;
      closest = s;
    }
  }
  return closest;
}

export function getNoteDisplay(note: Note): string {
  return `${note.name}${note.octave}`;
}

export function formatFreq(f: number): string {
  return f.toFixed(1);
}
