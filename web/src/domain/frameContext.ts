import type { FrameContext } from '../types/frames';
import {
  TEMPERAMENTS,
  noteFromMidi,
  noteWithA4,
  type Note,
  type NoteName,
  type Temperament,
  type TemperamentId,
} from '../utils/notes';

export const IN_TUNE_ENTER_CENTS = 5;
export const IN_TUNE_EXIT_CENTS = 7;

const MIDI_NOTE_COUNT = 128;
const MIN_CONTEXT_FREQUENCY = 10;
const MAX_CONTEXT_FREQUENCY = 20_000;

export interface FrameContextOptions {
  a4: number;
  isChromaticMode: boolean;
  selectedString: Note | null;
  strings: Note[];
  temperament: TemperamentId;
  temperamentOptions: Temperament[];
  temperamentRoot: NoteName;
  transpose: number;
}

export function createFrameContext(options: FrameContextOptions): FrameContext {
  const displayTargets = Array.from({ length: MIDI_NOTE_COUNT }, (_, midi) => (
    noteFromMidi(
      midi,
      options.a4,
      options.temperament,
      options.temperamentRoot,
      options.temperamentOptions,
    )
  )).filter((note) => (
    note.frequency >= MIN_CONTEXT_FREQUENCY && note.frequency <= MAX_CONTEXT_FREQUENCY
  ));
  const selectedTarget = copyNote(options.selectedString);
  const tuningTargets = options.isChromaticMode ? [] : options.strings.map(copyRequiredNote);
  const idleTarget = selectedTarget
    ?? copyNote(tuningTargets[0])
    ?? noteWithA4(
      { name: options.temperamentRoot, octave: 4 },
      options.a4,
      options.temperament,
      options.transpose,
      options.temperamentRoot,
      options.temperamentOptions,
    );

  return {
    a4: options.a4,
    displayTargets: displayTargets.map(copyRequiredNote),
    idleTarget: copyNote(idleTarget),
    inTuneEnterCents: IN_TUNE_ENTER_CENTS,
    inTuneExitCents: IN_TUNE_EXIT_CENTS,
    selectedTarget,
    tuningTargets,
  };
}

export function createDefaultFrameContext() {
  return createFrameContext({
    a4: 440,
    isChromaticMode: true,
    selectedString: null,
    strings: [],
    temperament: 'equal',
    temperamentOptions: TEMPERAMENTS,
    temperamentRoot: 'A',
    transpose: 0,
  });
}

function copyNote(note: Note | null | undefined): Note | null {
  return note ? copyRequiredNote(note) : null;
}

function copyRequiredNote(note: Note): Note {
  return {
    frequency: note.frequency,
    name: note.name,
    octave: note.octave,
  };
}
