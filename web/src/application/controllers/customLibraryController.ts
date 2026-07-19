import {
  createCustomTemperament,
  createCustomTuning,
  createInstrumentProfile,
  normalizeImportedTunings,
  type CustomTemperamentPayload,
  type CustomTuningPayload,
} from '../../domain/customLibrary';
import type {
  InstrumentId,
  InstrumentPreset,
  Note,
  Temperament,
  TemperamentId,
  Tuning,
} from '../../utils/notes';
import type { ReadableValue, WritableValue } from '../ports/value';

interface CustomLibraryControllerOptions {
  activeInstrument: WritableValue<InstrumentId>;
  currentTuning: ReadableValue<Tuning>;
  customInstruments: WritableValue<InstrumentPreset[]>;
  customTemperaments: WritableValue<Temperament[]>;
  customTunings: WritableValue<Tuning[]>;
  instrumentOptions: ReadableValue<InstrumentPreset[]>;
  now?: () => number;
  resetDetection(): void;
  resolveDefaultTuning(instrument: InstrumentId): Tuning;
  setTuning(tuning: Tuning): void;
  strings: ReadableValue<Note[]>;
  temperament: WritableValue<TemperamentId>;
}

export function createCustomLibraryController(options: CustomLibraryControllerOptions) {
  const now = options.now ?? Date.now;

  function saveCustomTuning(payload: CustomTuningPayload) {
    const tuning = createCustomTuning(payload, options.activeInstrument.value, now());
    options.customTunings.value = [
      ...options.customTunings.value.filter((item) => item.id !== tuning.id),
      tuning,
    ];
    options.setTuning(tuning);
  }

  function deleteCustomTuning(id: string) {
    const owningInstrument = options.customInstruments.value.find(
      (item) => item.defaultTuningId === id,
    );
    if (owningInstrument) {
      deleteInstrumentProfile(owningInstrument.id);
      return;
    }

    options.customTunings.value = options.customTunings.value.filter((item) => item.id !== id);
    if (options.currentTuning.value.id === id) {
      options.setTuning(options.resolveDefaultTuning(options.activeInstrument.value));
    }
  }

  function saveInstrumentProfile(name: string) {
    const profileStrings = options.strings.value.length
      ? options.strings.value
      : options.currentTuning.value.strings;
    const created = createInstrumentProfile(name, profileStrings, now());
    if (!created) return null;
    const { profile, tuning } = created;

    options.customInstruments.value = [...options.customInstruments.value, profile];
    options.customTunings.value = [...options.customTunings.value, tuning];
    options.activeInstrument.value = profile.id;
    options.setTuning(tuning);
    return profile;
  }

  function deleteInstrumentProfile(id: string) {
    options.customInstruments.value = options.customInstruments.value.filter((item) => item.id !== id);
    options.customTunings.value = options.customTunings.value.filter((item) => item.instrument !== id);
    if (options.activeInstrument.value === id) {
      options.activeInstrument.value = 'guitar';
      options.setTuning(options.resolveDefaultTuning('guitar'));
    }
  }

  function saveCustomTemperament(payload: CustomTemperamentPayload) {
    const item = createCustomTemperament(payload, now());
    options.customTemperaments.value = [
      ...options.customTemperaments.value.filter((current) => current.id !== item.id),
      item,
    ];
    options.temperament.value = item.id;
    options.resetDetection();
  }

  function deleteCustomTemperament(id: string) {
    options.customTemperaments.value = options.customTemperaments.value.filter((item) => item.id !== id);
    if (options.temperament.value === id) {
      options.temperament.value = 'equal';
      options.resetDetection();
    }
  }

  function exportCustomTunings() {
    return options.customTunings.value;
  }

  function importCustomTunings(tunings: Tuning[]) {
    const normalized = normalizeImportedTunings(
      tunings,
      options.activeInstrument.value,
      now(),
      new Set(options.instrumentOptions.value.map((instrument) => instrument.id)),
    );
    if (!normalized.length) return 0;

    const importedIds = new Set(normalized.map((tuning) => tuning.id));
    options.customTunings.value = [
      ...options.customTunings.value.filter((tuning) => !importedIds.has(tuning.id)),
      ...normalized,
    ];
    return normalized.length;
  }

  return {
    deleteCustomTemperament,
    deleteCustomTuning,
    deleteInstrumentProfile,
    exportCustomTunings,
    importCustomTunings,
    saveCustomTemperament,
    saveCustomTuning,
    saveInstrumentProfile,
  };
}
