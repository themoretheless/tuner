const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export type NoteName = typeof NOTE_NAMES[number];

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

export const GUITAR_STRINGS_STANDARD: Note[] = [
  { name: 'E', octave: 2, frequency: 82.4069 },
  { name: 'A', octave: 2, frequency: 110.0000 },
  { name: 'D', octave: 3, frequency: 146.8324 },
  { name: 'G', octave: 3, frequency: 195.9977 },
  { name: 'B', octave: 3, frequency: 246.9417 },
  { name: 'E', octave: 4, frequency: 329.6276 },
];

export interface Tuning {
  id: string;
  name: string;
  strings: Note[];
}

export const TUNINGS: Tuning[] = [
  {
    id: 'standard',
    name: 'Standard (EADGBE)',
    strings: [...GUITAR_STRINGS_STANDARD],
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
  },
];

export function midiToFrequency(midi: number, a4 = 440): number {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

export function frequencyToMidi(freq: number, a4 = 440): number {
  return Math.round(69 + 12 * Math.log2(freq / a4));
}

export function frequencyToNote(freq: number, a4 = 440): Note {
  const midi = frequencyToMidi(freq, a4);
  // Guard against negative MIDI (sub-audible / garbage input): JS % keeps the
  // sign, so midi % 12 could be negative and index NOTE_NAMES out of bounds.
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  const targetFreq = midiToFrequency(midi, a4);
  return { name, octave, frequency: targetFreq };
}

export function getCents(frequency: number, targetFrequency: number): number {
  if (!frequency || !targetFrequency) return 0;
  return 1200 * Math.log2(frequency / targetFrequency);
}

export function findClosestString(frequency: number, strings: Note[] = GUITAR_STRINGS_STANDARD, a4 = 440): Note {
  if (!frequency) return strings[0];
  // Scale strings if A4 changed (simple proportional)
  const ratio = a4 / 440;
  let closest = strings[0];
  let minDiff = Infinity;
  for (const s of strings) {
    const scaled = s.frequency * ratio;
    const diff = Math.abs(Math.log2(frequency / scaled));
    if (diff < minDiff) {
      minDiff = diff;
      closest = { ...s, frequency: scaled };
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