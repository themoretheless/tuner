import { IN_TUNE_ENTER_CENTS, IN_TUNE_EXIT_CENTS } from './frameContext';
import { createInTuneLatch, createStickyTargetSelector } from './tuningTracking';
import {
  findClosestString,
  frequencyToNote,
  getCents,
  getNoteDisplay,
  noteId,
  noteWithA4,
  type DetectedNote,
  type Note,
  type NoteName,
  type Temperament,
  type TemperamentId,
} from '../utils/notes';

export interface TuningDetectionInput {
  a4: number;
  frequency: number | null;
  isChromaticMode: boolean;
  selectedString: Note | null;
  strings: Note[];
  temperament: TemperamentId;
  temperamentOptions: Temperament[];
  temperamentRoot: NoteName;
  transpose: number;
}

export interface TuningDetectionSnapshot {
  cents: number;
  currentNoteDisplay: string | null;
  detectedNote: DetectedNote | null;
  isInTune: boolean;
  targetNote: Note;
}

export interface TuningDetectionMachine {
  process(input: TuningDetectionInput): TuningDetectionSnapshot;
  reset(): void;
  resetInTune(): void;
}

export function createTuningDetectionMachine(
  enterCents = IN_TUNE_ENTER_CENTS,
  exitCents = IN_TUNE_EXIT_CENTS,
): TuningDetectionMachine {
  const targetSelector = createStickyTargetSelector<Note>();
  const displaySelector = createStickyTargetSelector<Note>();
  const inTuneLatch = createInTuneLatch(enterCents, exitCents);

  function process(input: TuningDetectionInput): TuningDetectionSnapshot {
    const idleTarget = resolveIdleTarget(input);
    if (!isValidFrequency(input.frequency)) {
      reset();
      return emptySnapshot(idleTarget);
    }

    const frequency = input.frequency;
    const target = input.selectedString ?? resolveAutoTarget(frequency, input, idleTarget);
    const rawNote = frequencyToNote(
      frequency,
      input.a4,
      input.temperament,
      input.temperamentRoot,
      input.temperamentOptions,
    );
    const note = displaySelector.select(frequency, rawNote);
    const cents = getCents(frequency, target.frequency);
    const detectedNote: DetectedNote = { cents, frequency, note };

    return {
      cents,
      currentNoteDisplay: getNoteDisplay(note),
      detectedNote,
      isInTune: inTuneLatch.update(true, cents),
      targetNote: target,
    };
  }

  function resolveAutoTarget(
    frequency: number,
    input: TuningDetectionInput,
    idleTarget: Note,
  ) {
    const candidate = input.isChromaticMode
      ? frequencyToNote(
        frequency,
        input.a4,
        input.temperament,
        input.temperamentRoot,
        input.temperamentOptions,
      )
      : findClosestString(frequency, input.strings) ?? idleTarget;
    return targetSelector.select(frequency, candidate, (previous) => (
      input.isChromaticMode || input.strings.some((string) => (
        noteId(string) === noteId(previous)
        && Math.abs(string.frequency - previous.frequency) < 0.01
      ))
    ));
  }

  function reset() {
    targetSelector.reset();
    displaySelector.reset();
    inTuneLatch.reset();
  }

  return { process, reset, resetInTune: inTuneLatch.reset };
}

function resolveIdleTarget(input: TuningDetectionInput) {
  return input.selectedString
    ?? input.strings[0]
    ?? noteWithA4(
      { name: input.temperamentRoot, octave: 4 },
      input.a4,
      input.temperament,
      input.transpose,
      input.temperamentRoot,
      input.temperamentOptions,
    );
}

function emptySnapshot(targetNote: Note): TuningDetectionSnapshot {
  return {
    cents: 0,
    currentNoteDisplay: null,
    detectedNote: null,
    isInTune: false,
    targetNote,
  };
}

function isValidFrequency(value: number | null): value is number {
  return value != null && Number.isFinite(value) && value > 0;
}
