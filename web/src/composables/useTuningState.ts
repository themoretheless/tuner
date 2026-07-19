import { watch, type Ref } from 'vue';
import { createCustomLibraryController } from '../application/controllers/customLibraryController';
import { createTuningCommands } from '../application/controllers/tuningCommands';
import { formatFreq, getNoteDisplay } from '../utils/notes';
import { useTuningDetection } from './useTuningDetection';
import { useTuningModel } from './useTuningModel';
import type { SettingsStore } from './useSettings';

export type { CustomTemperamentPayload, CustomTuningPayload } from '../domain/customLibrary';

export interface TuningStateOptions {
  settings: SettingsStore;
  onResetDetection?: () => void;
}

export function useTuningState(
  detectedFrequency: Ref<number | null>,
  options: TuningStateOptions,
) {
  const { settings } = options;
  const model = useTuningModel(settings);
  const detection = useTuningDetection({
    a4: settings.a4,
    activeInstrument: settings.activeInstrument,
    detectedFrequency,
    isChromaticMode: model.isChromaticMode,
    selectedString: model.selectedString,
    strings: model.strings,
    temperament: settings.temperament,
    temperamentOptions: model.temperamentOptions,
    temperamentRoot: settings.temperamentRoot,
    transpose: settings.transpose,
  });
  const resetDetection = () => {
    detection.resetTracking();
    options.onResetDetection?.();
  };
  const commands = createTuningCommands({
    model,
    resetDetection,
    resetInTune: detection.resetInTune,
    settings,
  });
  const customLibrary = createCustomLibraryController({
    activeInstrument: settings.activeInstrument,
    currentTuning: model.currentTuning,
    customInstruments: settings.customInstruments,
    customTemperaments: settings.customTemperaments,
    customTunings: settings.customTunings,
    instrumentOptions: model.instrumentOptions,
    resetDetection,
    resolveDefaultTuning: model.resolveDefaultTuning,
    setTuning: commands.setTuning,
    strings: model.strings,
    temperament: settings.temperament,
  });

  watch([
    settings.loaded,
    settings.lastTuningId,
    settings.customTunings,
    settings.customInstruments,
    settings.customTemperaments,
    settings.activeInstrument,
  ], synchronizeStoredSelection, { immediate: true });

  function synchronizeStoredSelection() {
    if (!model.instrumentOptions.value.some((item) => item.id === settings.activeInstrument.value)) {
      settings.activeInstrument.value = 'guitar';
    }
    if (!model.temperamentOptions.value.some((item) => item.id === settings.temperament.value)) {
      settings.temperament.value = 'equal';
    }
    const saved = model.allTunings.value.find((tuning) => (
      tuning.id === settings.lastTuningId.value
    )) || model.resolveDefaultTuning(settings.activeInstrument.value);
    if (saved.id !== model.currentTuning.value.id) commands.setTuning(saved);
  }

  return {
    a4: settings.a4,
    activeInstrument: settings.activeInstrument,
    activeStringOffsets: model.activeStringOffsets,
    allTunings: model.allTunings,
    capo: settings.capo,
    cents: detection.cents,
    currentNoteDisplay: detection.currentNoteDisplay,
    currentTuning: model.currentTuning,
    customInstruments: settings.customInstruments,
    customTemperaments: settings.customTemperaments,
    customTunings: settings.customTunings,
    detectedNote: detection.detectedNote,
    detectionRange: detection.detectionRange,
    formatFreq,
    getNoteDisplay,
    instrumentOptions: model.instrumentOptions,
    isChromaticMode: model.isChromaticMode,
    isInTune: detection.isInTune,
    selectedString: model.selectedString,
    selectedStringIndex: model.selectedStringIndex,
    strings: model.strings,
    sweeteningProfile: settings.sweeteningProfile,
    targetNote: detection.targetNote,
    temperament: settings.temperament,
    temperamentOffsets: model.temperamentOffsets,
    temperamentOptions: model.temperamentOptions,
    temperamentRoot: settings.temperamentRoot,
    transpose: settings.transpose,
    ...commands,
    ...customLibrary,
  };
}
