import { computed, ref, watch, type Ref } from 'vue';
import type { DetectedNote, Note } from '../utils/notes';
import type { PitchDetectionRange } from '../utils/pitch';
import {
  createCustomTemperament,
  createCustomTuning,
  createInstrumentProfile,
  normalizeImportedTunings,
  type CustomTemperamentPayload,
  type CustomTuningPayload,
} from '../domain/customLibrary';
import {
  chromaticPracticeNotes,
  defaultTuningForInstrument,
  detectionRangeForStrings,
  offsetsForProfile,
  tuningsForInstrument,
} from '../domain/tuningCalculations';
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

const IN_TUNE_THRESHOLD = 5;
const OUT_OF_TUNE_THRESHOLD = 7;

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

  const detectedNote = computed<DetectedNote | null>(() => {
    const frequency = detectedFrequency.value;
    if (!frequency) return null;

    const target = isChromaticMode.value
      ? frequencyToNote(frequency, a4.value, temperament.value, temperamentRoot.value, temperamentOptions.value)
      : selectedString.value ?? findClosestString(frequency, strings.value);
    const cents = getCents(frequency, target.frequency);
    const note = frequencyToNote(frequency, a4.value, temperament.value, temperamentRoot.value, temperamentOptions.value);

    return { note, cents, frequency };
  });

  const targetNote = computed<Note>(() => {
    const frequency = detectedFrequency.value;
    if (selectedString.value) return selectedString.value;
    if (frequency) {
      return isChromaticMode.value
        ? frequencyToNote(frequency, a4.value, temperament.value, temperamentRoot.value, temperamentOptions.value)
        : findClosestString(frequency, strings.value);
    }
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
    if (absoluteCents < IN_TUNE_THRESHOLD) inTuneStable = true;
    else if (absoluteCents > OUT_OF_TUNE_THRESHOLD) inTuneStable = false;
    return inTuneStable;
  });

  const currentNoteDisplay = computed(() => {
    const detected = detectedNote.value;
    return detected ? getNoteDisplay(detected.note) : null;
  });

  function resetDetectionState() {
    inTuneStable = false;
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

  function saveCustomTuning(payload: CustomTuningPayload) {
    const tuning = createCustomTuning(payload, activeInstrument.value);
    const nextTunings = settings.customTunings.value.filter((item) => item.id !== tuning.id);
    settings.customTunings.value = [...nextTunings, tuning];
    setTuning(tuning);
  }

  function deleteCustomTuning(id: string) {
    const owningInstrument = settings.customInstruments.value.find((item) => item.defaultTuningId === id);
    if (owningInstrument) {
      deleteInstrumentProfile(owningInstrument.id);
      return;
    }

    settings.customTunings.value = settings.customTunings.value.filter((item) => item.id !== id);
    if (currentTuning.value.id === id) {
      setTuning(resolveDefaultTuning(activeInstrument.value));
    }
  }

  function saveInstrumentProfile(name: string) {
    const profileStrings = strings.value.length ? strings.value : currentTuning.value.strings;
    const created = createInstrumentProfile(name, profileStrings);
    if (!created) return null;
    const { profile, tuning } = created;

    settings.customInstruments.value = [...settings.customInstruments.value, profile];
    settings.customTunings.value = [...settings.customTunings.value, tuning];
    activeInstrument.value = profile.id;
    setTuning(tuning);
    return profile;
  }

  function deleteInstrumentProfile(id: string) {
    settings.customInstruments.value = settings.customInstruments.value.filter((item) => item.id !== id);
    settings.customTunings.value = settings.customTunings.value.filter((item) => item.instrument !== id);
    if (activeInstrument.value === id) {
      activeInstrument.value = 'guitar';
      setTuning(resolveDefaultTuning('guitar'));
    }
  }

  function saveCustomTemperament(payload: CustomTemperamentPayload) {
    const item = createCustomTemperament(payload);
    settings.customTemperaments.value = [
      ...settings.customTemperaments.value.filter((current) => current.id !== item.id),
      item,
    ];
    temperament.value = item.id;
    resetDetectionState();
  }

  function deleteCustomTemperament(id: string) {
    settings.customTemperaments.value = settings.customTemperaments.value.filter((item) => item.id !== id);
    if (temperament.value === id) {
      temperament.value = 'equal';
      resetDetectionState();
    }
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

  function exportCustomTunings() {
    return settings.customTunings.value;
  }

  function importCustomTunings(tunings: Tuning[]) {
    const normalized = normalizeImportedTunings(
      tunings,
      activeInstrument.value,
      Date.now(),
      new Set(instrumentOptions.value.map((instrument) => instrument.id)),
    );

    if (!normalized.length) return 0;

    const importedIds = new Set(normalized.map((tuning) => tuning.id));
    settings.customTunings.value = [
      ...settings.customTunings.value.filter((tuning) => !importedIds.has(tuning.id)),
      ...normalized,
    ];
    return normalized.length;
  }

  function resolveDefaultTuning(instrument: InstrumentId) {
    return defaultTuningForInstrument(
      instrument,
      instrumentOptions.value,
      storedTunings.value,
    );
  }

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
    deleteCustomTemperament,
    deleteCustomTuning,
    deleteInstrumentProfile,
    detectedNote,
    detectionRange,
    exportCustomTunings,
    formatFreq,
    getNoteDisplay,
    getRandomPracticeNote,
    importCustomTunings,
    instrumentOptions,
    isChromaticMode,
    isInTune,
    saveCustomTemperament,
    saveCustomTuning,
    saveInstrumentProfile,
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
  };
}
