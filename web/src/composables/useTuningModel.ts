import { computed, ref } from 'vue';
import type { SettingsStore } from './useSettings';
import {
  defaultTuningForInstrument,
  offsetsForProfile,
  tuningsForInstrument,
} from '../domain/tuningCalculations';
import {
  INSTRUMENTS,
  TEMPERAMENTS,
  TUNINGS,
  applyCentsOffset,
  scaleTuning,
  temperamentOffsetsByNote,
  type InstrumentId,
  type InstrumentPreset,
  type Note,
  type Temperament,
  type Tuning,
} from '../utils/notes';

export function useTuningModel(settings: SettingsStore) {
  const selectedStringIndex = ref<number | null>(null);
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
    settings.activeInstrument.value,
    settings.customTunings.value,
  ));
  const currentTuning = ref<Tuning>(
    allTunings.value.find((tuning) => tuning.id === settings.lastTuningId.value)
    || resolveDefaultTuning(settings.activeInstrument.value),
  );
  const isChromaticMode = computed(() => (
    currentTuning.value.kind === 'chromatic' || currentTuning.value.strings.length === 0
  ));
  const semitoneOffset = computed(() => (
    settings.transpose.value + (isChromaticMode.value ? 0 : settings.capo.value)
  ));
  const baseStrings = computed(() => scaleTuning(
    currentTuning.value,
    settings.a4.value,
    settings.temperament.value,
    semitoneOffset.value,
    settings.temperamentRoot.value,
    temperamentOptions.value,
  ).strings);
  const activeStringOffsets = computed(() => offsetsForProfile(
    settings.sweeteningProfile.value,
    currentTuning.value.instrument || settings.activeInstrument.value,
    baseStrings.value.length,
    settings.stringOffsets.value,
  ));
  const strings = computed(() => baseStrings.value.map((string, index) => (
    applyCentsOffset(string, activeStringOffsets.value[index] ?? 0)
  )));
  const selectedString = computed<Note | null>(() => {
    if (selectedStringIndex.value == null) return null;
    return strings.value[selectedStringIndex.value] ?? null;
  });
  const temperamentOffsets = computed(() => temperamentOffsetsByNote(
    settings.temperament.value,
    settings.temperamentRoot.value,
    temperamentOptions.value,
  ));

  function resolveDefaultTuning(instrument: InstrumentId) {
    return defaultTuningForInstrument(
      instrument,
      instrumentOptions.value,
      storedTunings.value,
    );
  }

  return {
    activeStringOffsets,
    allTunings,
    currentTuning,
    instrumentOptions,
    isChromaticMode,
    resolveDefaultTuning,
    selectedString,
    selectedStringIndex,
    strings,
    temperamentOffsets,
    temperamentOptions,
  };
}
