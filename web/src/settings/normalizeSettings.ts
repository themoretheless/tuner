import {
  INSTRUMENTS,
  NOTE_NAMES,
  SWEETENING_PROFILES,
  TEMPERAMENTS,
  TUNINGS,
  normalizeTemperamentOffsets,
  type InstrumentId,
  type InstrumentPreset,
  type Note,
  type NoteName,
  type SweeteningProfileId,
  type Temperament,
  type TemperamentId,
  type Tuning,
} from '../utils/notes';
import type {
  AudioBackend,
  DisplayMode,
  LayoutMode,
  PersistedSettings,
  PracticeHistoryEntry,
  ThemeMode,
} from '../utils/settingsStorage';

const MAX_CUSTOM_ITEMS = 200;
const MAX_DEVICE_ID_LENGTH = 512;
const MAX_ID_LENGTH = 120;
const MAX_NAME_LENGTH = 120;
const MAX_STRINGS = 128;

export function createDefaultSettings(): PersistedSettings {
  return {
    a4: 440,
    activeInstrument: 'guitar',
    audioBackend: 'web',
    capo: 0,
    chromatic: false,
    customInstruments: [],
    customTemperaments: [],
    customTunings: [],
    displayMode: 'gauge',
    inTuneTolerance: 5,
    lastTuningId: 'standard',
    layoutMode: 'default',
    leftHanded: false,
    metronomeBeats: 4,
    metronomeBpm: 96,
    metronomeSubdivision: 1,
    practiceHistory: [],
    selectedInputDeviceId: '',
    showSpectrogram: false,
    showSpectrum: true,
    showWaveform: true,
    stringOffsets: [],
    sweeteningProfile: 'none',
    temperament: 'equal',
    temperamentRoot: 'A',
    themeMode: 'dark',
    transpose: 0,
  };
}

export function normalizePersistedSettings(
  value: Partial<PersistedSettings>,
): PersistedSettings {
  const defaults = createDefaultSettings();
  const normalizedTunings = normalizeTunings(value.customTunings);
  const customTuningById = new Map(normalizedTunings.map((tuning) => [tuning.id, tuning]));
  const customInstruments = normalizeInstruments(value.customInstruments)
    .filter((instrument) => {
      const defaultTuning = customTuningById.get(instrument.defaultTuningId);
      return Boolean(
        defaultTuning
        && (!defaultTuning.instrument || defaultTuning.instrument === instrument.id),
      );
    });
  const customTemperaments = normalizeTemperaments(value.customTemperaments);
  const availableInstrumentIds = new Set([
    ...INSTRUMENTS.map((instrument) => instrument.id),
    ...customInstruments.map((instrument) => instrument.id),
  ]);
  const customTunings = normalizedTunings.filter((tuning) => (
    !tuning.instrument || availableInstrumentIds.has(tuning.instrument)
  ));
  const instrumentOptions = [...INSTRUMENTS, ...customInstruments];
  const temperamentOptions = [...TEMPERAMENTS, ...customTemperaments];
  const activeInstrument = normalizeInstrument(value.activeInstrument, instrumentOptions);
  const availableTunings = [...TUNINGS, ...customTunings];
  const activeTuningIds = new Set(availableTunings
    .filter((tuning) => (
      tuning.kind === 'chromatic'
      || tuning.instrument === activeInstrument
      || (!tuning.instrument && activeInstrument === 'guitar')
    ))
    .map((tuning) => tuning.id));
  const defaultTuningId = instrumentOptions
    .find((instrument) => instrument.id === activeInstrument)?.defaultTuningId;
  const requestedTuningId = nonEmptyString(value.lastTuningId, '');
  const lastTuningId = activeTuningIds.has(requestedTuningId)
    ? requestedTuningId
    : defaultTuningId && activeTuningIds.has(defaultTuningId)
      ? defaultTuningId
      : activeTuningIds.values().next().value ?? defaults.lastTuningId;

  return {
    a4: normalizeInteger(value.a4, 420, 460, defaults.a4),
    activeInstrument,
    audioBackend: normalizeAudioBackend(value.audioBackend),
    capo: normalizeInteger(value.capo, 0, 12, defaults.capo),
    chromatic: normalizeBoolean(value.chromatic, defaults.chromatic),
    customInstruments,
    customTemperaments,
    customTunings,
    displayMode: normalizeDisplayMode(value.displayMode),
    inTuneTolerance: normalizeInteger(value.inTuneTolerance, 1, 25, defaults.inTuneTolerance),
    lastTuningId,
    layoutMode: normalizeLayoutMode(value.layoutMode),
    leftHanded: normalizeBoolean(value.leftHanded, defaults.leftHanded),
    metronomeBeats: normalizeInteger(value.metronomeBeats, 1, 12, defaults.metronomeBeats),
    metronomeBpm: normalizeInteger(value.metronomeBpm, 30, 240, defaults.metronomeBpm),
    metronomeSubdivision: normalizeInteger(
      value.metronomeSubdivision,
      1,
      8,
      defaults.metronomeSubdivision,
    ),
    practiceHistory: normalizePracticeHistory(value.practiceHistory),
    selectedInputDeviceId: boundedString(
      value.selectedInputDeviceId,
      defaults.selectedInputDeviceId,
      MAX_DEVICE_ID_LENGTH,
    ),
    showSpectrogram: normalizeBoolean(value.showSpectrogram, defaults.showSpectrogram),
    showSpectrum: normalizeBoolean(value.showSpectrum, defaults.showSpectrum),
    showWaveform: normalizeBoolean(value.showWaveform, defaults.showWaveform),
    stringOffsets: normalizeOffsets(value.stringOffsets),
    sweeteningProfile: normalizeSweeteningProfile(value.sweeteningProfile),
    temperament: normalizeTemperament(value.temperament, temperamentOptions),
    temperamentRoot: normalizeNoteName(value.temperamentRoot),
    themeMode: normalizeThemeMode(value.themeMode),
    transpose: normalizeInteger(value.transpose, -12, 12, defaults.transpose),
  };
}

function normalizeInstrument(value: unknown, instruments: InstrumentPreset[]): InstrumentId {
  return instruments.some((instrument) => instrument.id === value) ? value as InstrumentId : 'guitar';
}

function normalizeTemperament(value: unknown, temperaments: Temperament[]): TemperamentId {
  return temperaments.some((item) => item.id === value) ? value as TemperamentId : 'equal';
}

function normalizeSweeteningProfile(value: unknown): SweeteningProfileId {
  return SWEETENING_PROFILES.some((item) => item.id === value) ? value as SweeteningProfileId : 'none';
}

function normalizeInteger(value: unknown, min: number, max: number, fallback: number) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.max(min, Math.min(max, Math.round(next)));
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeOffsets(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, MAX_STRINGS)
    .map((offset) => normalizeInteger(offset, -25, 25, 0));
}

function normalizeDisplayMode(value: unknown): DisplayMode {
  return value === 'needle' || value === 'strobe' ? value : 'gauge';
}

function normalizeAudioBackend(value: unknown): AudioBackend {
  return value === 'native' ? 'native' : 'web';
}

function normalizeThemeMode(value: unknown): ThemeMode {
  return value === 'light' || value === 'colorblind' ? value : 'dark';
}

function normalizeLayoutMode(value: unknown): LayoutMode {
  return value === 'stage' || value === 'compact' ? value : 'default';
}

function normalizeNoteName(value: unknown, fallback: NoteName = 'A'): NoteName {
  return NOTE_NAMES.includes(value as NoteName) ? value as NoteName : fallback;
}

function normalizeNote(value: unknown): Note | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<Note>;
  if (!NOTE_NAMES.includes(item.name as NoteName)) return null;
  const frequency = Number(item.frequency);
  if (!Number.isFinite(frequency) || frequency < 10 || frequency > 20_000) return null;
  return {
    name: item.name as NoteName,
    octave: normalizeInteger(item.octave, 0, 8, 4),
    frequency,
  };
}

function normalizeTunings(value: unknown): Tuning[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((tuning): tuning is Tuning => (
      tuning
      && typeof tuning.id === 'string'
      && typeof tuning.name === 'string'
      && Array.isArray(tuning.strings)
    ))
    .map((tuning) => ({
      ...tuning,
      id: boundedString(tuning.id, '', MAX_ID_LENGTH).trim(),
      name: nonEmptyString(tuning.name, 'Custom tuning'),
      strings: tuning.strings
        .map(normalizeNote)
        .filter((note): note is Note => !!note)
        .slice(0, MAX_STRINGS),
      instrument: typeof tuning.instrument === 'string'
        ? boundedString(tuning.instrument, '', MAX_ID_LENGTH).trim() || undefined
        : undefined,
      kind: 'custom' as const,
    }))
    .filter((tuning) => tuning.strings.length || tuning.instrument === 'vocal')
    .filter(uniqueCustomId(new Set(TUNINGS.map((tuning) => tuning.id))))
    .slice(0, MAX_CUSTOM_ITEMS);
}

function normalizeInstruments(value: unknown): InstrumentPreset[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((instrument): instrument is InstrumentPreset => (
      instrument
      && typeof instrument.id === 'string'
      && typeof instrument.name === 'string'
      && typeof instrument.defaultTuningId === 'string'
    ))
    .map((instrument) => ({
      id: boundedString(instrument.id, '', MAX_ID_LENGTH).trim(),
      name: nonEmptyString(instrument.name, 'Custom instrument'),
      defaultTuningId: boundedString(instrument.defaultTuningId, '', MAX_ID_LENGTH).trim(),
      custom: true,
    }))
    .filter((instrument) => instrument.defaultTuningId)
    .filter(uniqueCustomId(new Set(INSTRUMENTS.map((instrument) => instrument.id))))
    .slice(0, MAX_CUSTOM_ITEMS);
}

function normalizeTemperaments(value: unknown): Temperament[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Temperament => (
      item
      && typeof item.id === 'string'
      && typeof item.name === 'string'
      && Array.isArray(item.offsets)
    ))
    .map((item) => ({
      id: boundedString(item.id, '', MAX_ID_LENGTH).trim(),
      name: nonEmptyString(item.name, 'Custom temperament'),
      offsets: normalizeTemperamentOffsets(item.offsets),
      custom: true,
    }))
    .filter(uniqueCustomId(new Set(TEMPERAMENTS.map((item) => item.id))))
    .slice(0, MAX_CUSTOM_ITEMS);
}

function normalizePracticeHistory(value: unknown): PracticeHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is PracticeHistoryEntry => (
      entry
      && typeof entry.at === 'number'
      && Number.isFinite(entry.at)
      && typeof entry.correct === 'boolean'
      && typeof entry.note === 'string'
    ))
    .map((entry) => ({
      at: Number(entry.at),
      correct: entry.correct,
      note: boundedString(entry.note, '', MAX_NAME_LENGTH),
    }))
    .slice(-500);
}

function nonEmptyString(value: unknown, fallback: string) {
  const normalized = boundedString(value, '', MAX_NAME_LENGTH).trim();
  return normalized || fallback;
}

function boundedString(value: unknown, fallback: string, maxLength: number) {
  return typeof value === 'string' ? value.slice(0, maxLength) : fallback;
}

function uniqueCustomId<T extends { id: string }>(reserved: Set<string>) {
  return (item: T) => {
    if (!item.id || reserved.has(item.id)) return false;
    reserved.add(item.id);
    return true;
  };
}
