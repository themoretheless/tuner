import { computed, ref, watch, type Ref } from 'vue';
import { createCustomLibraryController } from '../application/customLibraryController';
import type { DetectedNote, Note } from '../utils/notes';
import type { PitchDetectionRange } from '../utils/pitch';
import {
  chromaticPracticeNotes,
  defaultTuningForInstrument,
  detectionRangeForStrings,
  offsetsForProfile,
  tuningsForInstrument,
} from '../domain/tuningCalculations';
import { IN_TUNE_ENTER_CENTS, IN_TUNE_EXIT_CENTS } from '../domain/frameContext';
import {
  INSTRUMENTS,
  NOTE_NAMES,
  SWEETENING_PROFILES,
  TEMPERAMENTS,
  TUNINGS,
  applyCentsOffset,
  findClosestString,
  formatFreq,
  frequencyToNote,
  getCents,
  getNoteDisplay,
  noteId,
  noteWithA4,
  scaleTuning,
  temperamentOffsetsByNote,
  type InstrumentId,
  type InstrumentPreset,
  type NoteName,
  type SweeteningProfileId,
  type Temperament,
  type TemperamentId,
  type Tuning,
} from '../utils/notes';
import { useSettings } from './useSettings';

export type { CustomTemperamentPayload, CustomTuningPayload } from '../domain/customLibrary';

export interface TuningStateOptions {
  onResetDetection?: () => void;
}

export function useTuningState(
  detectedFrequency: Ref<number | null>,
  options: TuningStateOptions = {},
) {
  const selectedStringIndex = ref<number | null>(null);
  const settings = useSettings();
  const a4 = settings.a4;
  const activeInstrument = settings.activeInstrument;
  const capo = settings.capo;
  const stringOffsets = settings.stringOffsets;
  const sweeteningProfile = settings.sweeteningProfile;
  const temperament = settings.temperament;
  const temperamentRoot = settings.temperamentRoot;
  const transpose = settings.transpose;

  const instrumentOptions = computed<InstrumentPreset[]>(() => [
    ...INSTRUMENTS,
    ...settings.customInstruments.value,
  ]);
  const temperamentOptions = computed<Temperament[]>(() => [
    ...TEMPERAMENTS,
    ...settings.customTemperaments.value,
  ]);
  const storedTunings = computed<Tuning[]>(() => [
    ...TUNINGS,
    ...settings.customTunings.value,
  ]);
  const allTunings = computed<Tuning[]>(() => tuningsForInstrument(
    activeInstrument.value,
    settings.customTunings.value,
  ));
  const currentTuning = ref<Tuning>(
    allTunings.value.find((tuning) => tuning.id === settings.lastTuningId.value) ||
    resolveDefaultTuning(activeInstrument.value),
  );

  let inTuneStable = false;

  // Keep the current auto-detected target/note until the pitch is decisively
  // closer to another one. Without this, a string sitting near the midpoint
  // between two targets flips the pick on every few-cent wobble and the
  // needle slams across the whole scale (+45 -> -45 and back).
  const TARGET_SWITCH_MARGIN_CENTS = 15;
  let stickyAutoTarget: Note | null = null;
  let stickyDisplayNote: Note | null = null;

  function stickyPick(frequency: number, candidate: Note, previous: Note | null): Note {
    if (!previous || !Number.isFinite(previous.frequency) || previous.frequency <= 0) {
      return candidate;
    }
    const toPrevious = Math.abs(getCents(frequency, previous.frequency));
    const toCandidate = Math.abs(getCents(frequency, candidate.frequency));
    return toPrevious - toCandidate <= TARGET_SWITCH_MARGIN_CENTS ? previous : candidate;
  }

  function resolveAutoTarget(frequency: number): Note {
    const candidate = isChromaticMode.value
      ? frequencyToNote(frequency, a4.value, temperament.value, temperamentRoot.value, temperamentOptions.value)
      : findClosestString(frequency, strings.value);
    // A sticky pick is only reusable while it is still a valid target for
    // the current mode: in string mode it must still be one of the strings.
    const previous = isChromaticMode.value
      ? stickyAutoTarget
      : stickyAutoTarget && strings.value.some((string) => (
        noteId(string) === noteId(stickyAutoTarget!) &&
        Math.abs(string.frequency - stickyAutoTarget!.frequency) < 0.01
      ))
        ? stickyAutoTarget
        : null;
    const chosen = stickyPick(frequency, candidate, previous);
    stickyAutoTarget = chosen;
    return chosen;
  }

  const isChromaticMode = computed(() => (
    currentTuning.value.kind === 'chromatic' || currentTuning.value.strings.length === 0
  ));
  const semitoneOffset = computed(() => transpose.value + (isChromaticMode.value ? 0 : capo.value));
  const baseStrings = computed(() => scaleTuning(
    currentTuning.value,
    a4.value,
    temperament.value,
    semitoneOffset.value,
    temperamentRoot.value,
    temperamentOptions.value,
  ).strings);
  const activeStringOffsets = computed(() => offsetsForProfile(
    sweeteningProfile.value,
    currentTuning.value.instrument || activeInstrument.value,
    baseStrings.value.length,
    stringOffsets.value,
  ));
  const strings = computed(() => baseStrings.value.map((string, index) => (
    applyCentsOffset(string, activeStringOffsets.value[index] ?? 0)
  )));
  const detectionRange = computed<PitchDetectionRange>(() => detectionRangeForStrings(
    strings.value,
    activeInstrument.value,
  ));
  const temperamentOffsets = computed(() => temperamentOffsetsByNote(
    temperament.value,
    temperamentRoot.value,
    temperamentOptions.value,
  ));

  const selectedString = computed<Note | null>(() => {
    if (selectedStringIndex.value == null) return null;
    return strings.value[selectedStringIndex.value] ?? null;
  });

  // Detection dropping out clears the stickiness so the next note picks its
  // target fresh. Sync flush: the clear must not be skipped when a null is
  // immediately followed by a new reading in the same tick.
  watch(detectedFrequency, (value) => {
    if (!value) {
      stickyAutoTarget = null;
      stickyDisplayNote = null;
    }
  }, { flush: 'sync' });

  const detectedNote = computed<DetectedNote | null>(() => {
    const frequency = detectedFrequency.value;
    if (!frequency) return null;

    const target = !isChromaticMode.value && selectedString.value
      ? selectedString.value
      : resolveAutoTarget(frequency);
    const cents = getCents(frequency, target.frequency);
    const rawNote = frequencyToNote(frequency, a4.value, temperament.value, temperamentRoot.value, temperamentOptions.value);
    const note = stickyPick(frequency, rawNote, stickyDisplayNote);
    stickyDisplayNote = note;

    return { note, cents, frequency };
  });

  const targetNote = computed<Note>(() => {
    const frequency = detectedFrequency.value;
    if (selectedString.value) return selectedString.value;
    if (frequency) return resolveAutoTarget(frequency);
    return isChromaticMode.value
      ? noteWithA4({ name: temperamentRoot.value, octave: 4 }, a4.value, temperament.value, transpose.value, temperamentRoot.value, temperamentOptions.value)
      : strings.value[0];
  });

  const cents = computed(() => detectedNote.value?.cents ?? 0);

  const isInTune = computed(() => {
    if (!detectedNote.value) {
      inTuneStable = false;
      return false;
    }

    const absoluteCents = Math.abs(cents.value);
    if (absoluteCents < IN_TUNE_ENTER_CENTS) inTuneStable = true;
    else if (absoluteCents > IN_TUNE_EXIT_CENTS) inTuneStable = false;
    return inTuneStable;
  });

  const currentNoteDisplay = computed(() => {
    const detected = detectedNote.value;
    return detected ? getNoteDisplay(detected.note) : null;
  });

  function resetDetectionState() {
    inTuneStable = false;
    stickyAutoTarget = null;
    stickyDisplayNote = null;
    options.onResetDetection?.();
  }

  function setA4(newA4: number) {
    if (!Number.isFinite(newA4)) return;
    a4.value = Math.max(420, Math.min(460, Math.round(newA4)));
    resetDetectionState();
  }

  function setCapo(nextCapo: number) {
    if (!Number.isFinite(nextCapo)) return;
    capo.value = Math.max(0, Math.min(12, Math.round(nextCapo)));
    resetDetectionState();
  }

  function setInstrument(instrument: InstrumentId) {
    if (!instrumentOptions.value.some((item) => item.id === instrument)) return;
    activeInstrument.value = instrument;
    setTuning(resolveDefaultTuning(instrument));
  }

  function setTemperament(nextTemperament: TemperamentId) {
    if (!temperamentOptions.value.some((item) => item.id === nextTemperament)) return;
    temperament.value = nextTemperament;
    resetDetectionState();
  }

  function setTemperamentRoot(nextRoot: NoteName) {
    if (!NOTE_NAMES.includes(nextRoot)) return;
    temperamentRoot.value = nextRoot;
    resetDetectionState();
  }

  function setTranspose(nextTranspose: number) {
    if (!Number.isFinite(nextTranspose)) return;
    transpose.value = Math.max(-12, Math.min(12, Math.round(nextTranspose)));
    resetDetectionState();
  }

  function setStringOffset(index: number, cents: number) {
    if (!Number.isInteger(index) || index < 0) return;
    const nextOffsets = [...stringOffsets.value];
    nextOffsets[index] = Math.max(-25, Math.min(25, Math.round(Number(cents) || 0)));
    stringOffsets.value = nextOffsets;
    sweeteningProfile.value = 'custom';
    resetDetectionState();
  }

  function setSweeteningProfile(profile: SweeteningProfileId) {
    if (!SWEETENING_PROFILES.some((item) => item.id === profile)) return;
    sweeteningProfile.value = profile;
    resetDetectionState();
  }

  function setTuning(tuning: Tuning) {
    currentTuning.value = tuning;
    settings.lastTuningId.value = tuning.id;
    selectedStringIndex.value = null;
    resetDetectionState();
  }

  function toggleString(note: Note, index?: number) {
    const nextIndex = Number.isInteger(index)
      ? index as number
      : strings.value.findIndex((string) => noteId(string) === noteId(note));
    if (nextIndex < 0) return;
    selectedStringIndex.value = selectedStringIndex.value === nextIndex ? null : nextIndex;
    inTuneStable = false;
  }

  function getRandomPracticeNote() {
    const availableStrings = strings.value.length ? strings.value : chromaticPracticeNotes(
      activeInstrument.value,
      a4.value,
      temperament.value,
      transpose.value,
      temperamentRoot.value,
      temperamentOptions.value,
    );
    return availableStrings[Math.floor(Math.random() * availableStrings.length)];
  }

  function resolveDefaultTuning(instrument: InstrumentId) {
    return defaultTuningForInstrument(
      instrument,
      instrumentOptions.value,
      storedTunings.value,
    );
  }

  const customLibrary = createCustomLibraryController({
    activeInstrument,
    currentTuning,
    customInstruments: settings.customInstruments,
    customTemperaments: settings.customTemperaments,
    customTunings: settings.customTunings,
    instrumentOptions,
    resetDetection: resetDetectionState,
    resolveDefaultTuning,
    setTuning,
    strings,
    temperament,
  });

  watch([
    () => settings.loaded.value,
    () => settings.lastTuningId.value,
    () => settings.customTunings.value,
    () => settings.customInstruments.value,
    () => settings.customTemperaments.value,
    () => settings.activeInstrument.value,
  ], () => {
    if (!instrumentOptions.value.some((item) => item.id === activeInstrument.value)) {
      activeInstrument.value = 'guitar';
    }
    if (!temperamentOptions.value.some((item) => item.id === temperament.value)) {
      temperament.value = 'equal';
    }

    const saved = allTunings.value.find((tuning) => tuning.id === settings.lastTuningId.value) ||
      resolveDefaultTuning(activeInstrument.value);
    if (saved.id !== currentTuning.value.id) {
      currentTuning.value = saved;
      selectedStringIndex.value = null;
      resetDetectionState();
    }
  }, { deep: true, immediate: true });

  return {
    a4,
    activeInstrument,
    activeStringOffsets,
    allTunings,
    capo,
    cents,
    currentNoteDisplay,
    currentTuning,
    customInstruments: settings.customInstruments,
    customTemperaments: settings.customTemperaments,
    customTunings: settings.customTunings,
    detectedNote,
    detectionRange,
    formatFreq,
    getNoteDisplay,
    getRandomPracticeNote,
    instrumentOptions,
    isChromaticMode,
    isInTune,
    selectedString,
    selectedStringIndex,
    setA4,
    setCapo,
    setInstrument,
    setStringOffset,
    setSweeteningProfile,
    setTemperament,
    setTemperamentRoot,
    setTranspose,
    setTuning,
    strings,
    sweeteningProfile,
    targetNote,
    temperament,
    temperamentOffsets,
    temperamentOptions,
    temperamentRoot,
    toggleString,
    transpose,
    ...customLibrary,
  };
}
