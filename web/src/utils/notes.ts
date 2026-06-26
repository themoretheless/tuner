export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

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

export const INSTRUMENTS: InstrumentPreset[] = [
  { id: 'guitar', name: 'Guitar', defaultTuningId: 'standard' },
  { id: 'guitar-7', name: 'Guitar 7-string', defaultTuningId: 'guitar-7-standard' },
  { id: 'baritone-guitar', name: 'Baritone Guitar', defaultTuningId: 'baritone-standard' },
  { id: 'guitar-12', name: 'Guitar 12-string', defaultTuningId: 'twelve-string-standard' },
  { id: 'bass', name: 'Bass', defaultTuningId: 'bass-standard' },
  { id: 'ukulele', name: 'Ukulele', defaultTuningId: 'ukulele-standard' },
  { id: 'baritone-ukulele', name: 'Baritone Ukulele', defaultTuningId: 'baritone-ukulele-standard' },
  { id: 'mandolin', name: 'Mandolin', defaultTuningId: 'mandolin-standard' },
  { id: 'banjo', name: 'Banjo', defaultTuningId: 'banjo-open-g' },
  { id: 'violin', name: 'Violin', defaultTuningId: 'violin-standard' },
  { id: 'viola', name: 'Viola', defaultTuningId: 'viola-standard' },
  { id: 'cello', name: 'Cello', defaultTuningId: 'cello-standard' },
  { id: 'vocal', name: 'Vocal Pitch', defaultTuningId: 'vocal-pitch' },
  { id: 'chromatic', name: 'Chromatic', defaultTuningId: 'chromatic' },
];

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

export const GUITAR_STRINGS_STANDARD: Note[] = [
  note('E', 2),
  note('A', 2),
  note('D', 3),
  note('G', 3),
  note('B', 3),
  note('E', 4),
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
    strings: [note('D', 2), note('A', 2), note('D', 3), note('G', 3), note('B', 3), note('E', 4)],
    instrument: 'guitar',
    kind: 'built-in',
  },
  {
    id: 'dadgad',
    name: 'DADGAD',
    strings: [note('D', 2), note('A', 2), note('D', 3), note('G', 3), note('A', 3), note('D', 4)],
    instrument: 'guitar',
    kind: 'built-in',
  },
  {
    id: 'open-g',
    name: 'Open G (DGDGBD)',
    strings: [note('D', 2), note('G', 2), note('D', 3), note('G', 3), note('B', 3), note('D', 4)],
    instrument: 'guitar',
    kind: 'built-in',
  },
  {
    id: 'open-d',
    name: 'Open D (DADF#AD)',
    strings: [note('D', 2), note('A', 2), note('D', 3), note('F#', 3), note('A', 3), note('D', 4)],
    instrument: 'guitar',
    kind: 'built-in',
  },
  {
    id: 'drop-c',
    name: 'Drop C (CGCFAD)',
    strings: [note('C', 2), note('G', 2), note('C', 3), note('F', 3), note('A', 3), note('D', 4)],
    instrument: 'guitar',
    kind: 'built-in',
  },
  {
    id: 'half-step-down',
    name: 'Half Step Down (D# G# C# F# A# D#)',
    strings: [note('D#', 2), note('G#', 2), note('C#', 3), note('F#', 3), note('A#', 3), note('D#', 4)],
    instrument: 'guitar',
    kind: 'built-in',
  },
  {
    id: 'open-e',
    name: 'Open E (EBEG#BE)',
    strings: [note('E', 2), note('B', 2), note('E', 3), note('G#', 3), note('B', 3), note('E', 4)],
    instrument: 'guitar',
    kind: 'built-in',
  },
  {
    id: 'nashville',
    name: 'Nashville High Strung (EADGBE)',
    strings: [note('E', 3), note('A', 3), note('D', 4), note('G', 4), note('B', 3), note('E', 4)],
    instrument: 'guitar',
    kind: 'built-in',
  },
  {
    id: 'guitar-7-standard',
    name: '7-string Standard (BEADGBE)',
    strings: [note('B', 1), note('E', 2), note('A', 2), note('D', 3), note('G', 3), note('B', 3), note('E', 4)],
    instrument: 'guitar-7',
    kind: 'built-in',
  },
  {
    id: 'guitar-7-drop-a',
    name: '7-string Drop A (AEADGBE)',
    strings: [note('A', 1), note('E', 2), note('A', 2), note('D', 3), note('G', 3), note('B', 3), note('E', 4)],
    instrument: 'guitar-7',
    kind: 'built-in',
  },
  {
    id: 'baritone-standard',
    name: 'Baritone Standard (BEADF#B)',
    strings: [note('B', 1), note('E', 2), note('A', 2), note('D', 3), note('F#', 3), note('B', 3)],
    instrument: 'baritone-guitar',
    kind: 'built-in',
  },
  {
    id: 'baritone-drop-a',
    name: 'Baritone Drop A (AEADF#B)',
    strings: [note('A', 1), note('E', 2), note('A', 2), note('D', 3), note('F#', 3), note('B', 3)],
    instrument: 'baritone-guitar',
    kind: 'built-in',
  },
  {
    id: 'twelve-string-standard',
    name: '12-string Standard (E/e A/a D/d G/g B/B E/E)',
    strings: [
      note('E', 2), note('E', 3),
      note('A', 2), note('A', 3),
      note('D', 3), note('D', 4),
      note('G', 3), note('G', 4),
      note('B', 3), note('B', 3),
      note('E', 4), note('E', 4),
    ],
    instrument: 'guitar-12',
    kind: 'built-in',
  },
  {
    id: 'bass-standard',
    name: 'Bass Standard (EADG)',
    strings: [note('E', 1), note('A', 1), note('D', 2), note('G', 2)],
    instrument: 'bass',
    kind: 'built-in',
  },
  {
    id: 'bass-drop-d',
    name: 'Bass Drop D (DADG)',
    strings: [note('D', 1), note('A', 1), note('D', 2), note('G', 2)],
    instrument: 'bass',
    kind: 'built-in',
  },
  {
    id: 'bass-half-step',
    name: 'Bass Half Step Down (D#G#C#F#)',
    strings: [note('D#', 1), note('G#', 1), note('C#', 2), note('F#', 2)],
    instrument: 'bass',
    kind: 'built-in',
  },
  {
    id: 'bass-5-string',
    name: 'Bass 5-string (BEADG)',
    strings: [note('B', 0), note('E', 1), note('A', 1), note('D', 2), note('G', 2)],
    instrument: 'bass',
    kind: 'built-in',
  },
  {
    id: 'bass-6-string',
    name: 'Bass 6-string (BEADGC)',
    strings: [note('B', 0), note('E', 1), note('A', 1), note('D', 2), note('G', 2), note('C', 3)],
    instrument: 'bass',
    kind: 'built-in',
  },
  {
    id: 'ukulele-standard',
    name: 'Ukulele Standard (GCEA)',
    strings: [note('G', 4), note('C', 4), note('E', 4), note('A', 4)],
    instrument: 'ukulele',
    kind: 'built-in',
  },
  {
    id: 'ukulele-low-g',
    name: 'Ukulele Low G (GCEA)',
    strings: [note('G', 3), note('C', 4), note('E', 4), note('A', 4)],
    instrument: 'ukulele',
    kind: 'built-in',
  },
  {
    id: 'baritone-ukulele-standard',
    name: 'Baritone Ukulele (DGBE)',
    strings: [note('D', 3), note('G', 3), note('B', 3), note('E', 4)],
    instrument: 'baritone-ukulele',
    kind: 'built-in',
  },
  {
    id: 'mandolin-standard',
    name: 'Mandolin Standard (GDAE)',
    strings: [note('G', 3), note('D', 4), note('A', 4), note('E', 5)],
    instrument: 'mandolin',
    kind: 'built-in',
  },
  {
    id: 'banjo-open-g',
    name: 'Banjo Open G (gDGBD)',
    strings: [note('G', 4), note('D', 3), note('G', 3), note('B', 3), note('D', 4)],
    instrument: 'banjo',
    kind: 'built-in',
  },
  {
    id: 'violin-standard',
    name: 'Violin Standard (GDAE)',
    strings: [note('G', 3), note('D', 4), note('A', 4), note('E', 5)],
    instrument: 'violin',
    kind: 'built-in',
  },
  {
    id: 'viola-standard',
    name: 'Viola Standard (CGDA)',
    strings: [note('C', 3), note('G', 3), note('D', 4), note('A', 4)],
    instrument: 'viola',
    kind: 'built-in',
  },
  {
    id: 'cello-standard',
    name: 'Cello Standard (CGDA)',
    strings: [note('C', 2), note('G', 2), note('D', 3), note('A', 3)],
    instrument: 'cello',
    kind: 'built-in',
  },
  {
    id: 'vocal-pitch',
    name: 'Vocal Pitch (chromatic)',
    strings: [],
    instrument: 'vocal',
    kind: 'built-in',
  },
];

export const TUNINGS: Tuning[] = [CHROMATIC_TUNING, ...BUILT_IN_TUNINGS];

function noteNameFromMidi(midi: number): NoteName {
  return NOTE_NAMES[((midi % 12) + 12) % 12];
}

function noteNameIndex(name: NoteName): number {
  return NOTE_NAMES.indexOf(name);
}

function equalFrequency(name: NoteName, octave: number, a4 = 440): number {
  const midi = (octave + 1) * 12 + noteNameIndex(name);
  return a4 * Math.pow(2, (midi - 69) / 12);
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
  const equalFrequencyForMidi = a4 * Math.pow(2, (midi - 69) / 12);
  return equalFrequencyForMidi * Math.pow(2, temperamentOffset(noteNameFromMidi(midi), temperament, root, temperaments) / 1200);
}

export function frequencyToMidi(freq: number, a4 = 440): number {
  return Math.round(69 + 12 * Math.log2(freq / a4));
}

export function noteToMidi(note: Pick<Note, 'name' | 'octave'>): number {
  const index = NOTE_NAMES.indexOf(note.name);
  return (note.octave + 1) * 12 + index;
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
    octave: Math.floor(midi / 12) - 1,
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
  let closest = noteFromMidi(midi, a4, temperament, root, temperaments);
  let minDiff = Math.abs(Math.log2(freq / closest.frequency));

  for (let candidate = midi - 2; candidate <= midi + 2; candidate++) {
    const note = noteFromMidi(candidate, a4, temperament, root, temperaments);
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
