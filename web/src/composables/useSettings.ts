import { effectScope, ref, watch } from 'vue';
import {
  INSTRUMENTS,
  NOTE_NAMES,
  SWEETENING_PROFILES,
  TEMPERAMENTS,
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
  DisplayMode,
  LayoutMode,
  PracticeHistoryEntry,
  ThemeMode,
} from '../utils/settingsStorage';
import { loadPersistedSettings, savePersistedSettings } from '../utils/settingsStorage';

const a4 = ref(440);
const activeInstrument = ref<InstrumentId>('guitar');
const capo = ref(0);
const customInstruments = ref<InstrumentPreset[]>([]);
const customTemperaments = ref<Temperament[]>([]);
const customTunings = ref<Tuning[]>([]);
const displayMode = ref<DisplayMode>('gauge');
const lastTuningId = ref('standard');
const layoutMode = ref<LayoutMode>('default');
const leftHanded = ref(false);
const metronomeBeats = ref(4);
const metronomeBpm = ref(96);
const metronomeSubdivision = ref(1);
const practiceHistory = ref<PracticeHistoryEntry[]>([]);
const selectedInputDeviceId = ref('');
const showWaveform = ref(true);
const showSpectrum = ref(true);
const stringOffsets = ref<number[]>([]);
const sweeteningProfile = ref<SweeteningProfileId>('none');
const temperament = ref<TemperamentId>('equal');
const temperamentRoot = ref<NoteName>('A');
const themeMode = ref<ThemeMode>('dark');
const transpose = ref(0);
const loaded = ref(false);

let loadPromise: Promise<void> | null = null;
let watchStarted = false;
let isLoading = false;
let saveTimer: number | null = null;
const settingsScope = effectScope(true);

function normalizeA4(value: unknown) {
  const next = Number(value);
  if (!Number.isFinite(next)) return 440;
  return Math.max(420, Math.min(460, Math.round(next)));
}

function normalizeInstrument(value: unknown, instruments: InstrumentPreset[] = INSTRUMENTS): InstrumentId {
  return instruments.some((instrument) => instrument.id === value) ? value as InstrumentId : 'guitar';
}

function normalizeTemperament(value: unknown, temperaments: Temperament[] = TEMPERAMENTS): TemperamentId {
  return temperaments.some((item) => item.id === value) ? value as TemperamentId : 'equal';
}

function normalizeSweeteningProfile(value: unknown): SweeteningProfileId {
  return SWEETENING_PROFILES.some((item) => item.id === value) ? value as SweeteningProfileId : 'none';
}

function normalizeInteger(value: unknown, min: number, max: number, fallback = min) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.max(min, Math.min(max, Math.round(next)));
}

function normalizeOffsets(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((offset) => normalizeInteger(offset, -25, 25, 0));
}

function normalizeDisplayMode(value: unknown): DisplayMode {
  return value === 'needle' || value === 'strobe' ? value : 'gauge';
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
  const octave = normalizeInteger(item.octave, 0, 8, 4);
  const frequency = Number(item.frequency);
  return {
    name: item.name as NoteName,
    octave,
    frequency: Number.isFinite(frequency) && frequency > 0 ? frequency : 0,
  };
}

function normalizeTunings(value: unknown): Tuning[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((tuning): tuning is Tuning => (
      tuning &&
      typeof tuning.id === 'string' &&
      typeof tuning.name === 'string' &&
      Array.isArray(tuning.strings)
    ))
    .map((tuning) => ({
      ...tuning,
      id: tuning.id.trim(),
      name: tuning.name.trim() || 'Custom tuning',
      strings: tuning.strings.map(normalizeNote).filter((note): note is Note => !!note),
      instrument: typeof tuning.instrument === 'string' ? tuning.instrument : undefined,
      kind: 'custom' as const,
    }))
    .filter((tuning) => tuning.id && (tuning.strings.length || tuning.instrument === 'vocal'));
}

function normalizeInstruments(value: unknown): InstrumentPreset[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((instrument): instrument is InstrumentPreset => (
      instrument &&
      typeof instrument.id === 'string' &&
      typeof instrument.name === 'string' &&
      typeof instrument.defaultTuningId === 'string'
    ))
    .map((instrument) => ({
      id: instrument.id.trim(),
      name: instrument.name.trim() || 'Custom instrument',
      defaultTuningId: instrument.defaultTuningId.trim(),
      custom: true,
    }))
    .filter((instrument) => instrument.id && instrument.defaultTuningId);
}

function normalizeTemperaments(value: unknown): Temperament[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Temperament => (
      item &&
      typeof item.id === 'string' &&
      typeof item.name === 'string' &&
      Array.isArray(item.offsets)
    ))
    .map((item) => ({
      id: item.id.trim(),
      name: item.name.trim() || 'Custom temperament',
      offsets: normalizeTemperamentOffsets(item.offsets),
      custom: true,
    }))
    .filter((item) => item.id);
}

function normalizePracticeHistory(value: unknown): PracticeHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is PracticeHistoryEntry => (
      entry &&
      Number.isFinite(Number(entry.at)) &&
      typeof entry.correct === 'boolean' &&
      typeof entry.note === 'string'
    ))
    .map((entry) => ({
      at: Number(entry.at),
      correct: entry.correct,
      note: entry.note,
    }))
    .slice(-500);
}

async function load() {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    isLoading = true;
    try {
      const saved = await loadPersistedSettings();
      customInstruments.value = normalizeInstruments(saved.customInstruments);
      customTemperaments.value = normalizeTemperaments(saved.customTemperaments);
      customTunings.value = normalizeTunings(saved.customTunings);

      const instrumentOptions = [...INSTRUMENTS, ...customInstruments.value];
      const temperamentOptions = [...TEMPERAMENTS, ...customTemperaments.value];

      if (saved.a4 != null) a4.value = normalizeA4(saved.a4);
      if (saved.activeInstrument) activeInstrument.value = normalizeInstrument(saved.activeInstrument, instrumentOptions);
      if (saved.capo != null) capo.value = normalizeInteger(saved.capo, 0, 12, 0);
      if (saved.displayMode) displayMode.value = normalizeDisplayMode(saved.displayMode);
      if (saved.lastTuningId) lastTuningId.value = saved.lastTuningId;
      if (saved.layoutMode) layoutMode.value = normalizeLayoutMode(saved.layoutMode);
      if (saved.leftHanded != null) leftHanded.value = Boolean(saved.leftHanded);
      if (saved.metronomeBeats != null) metronomeBeats.value = normalizeInteger(saved.metronomeBeats, 1, 12, 4);
      if (saved.metronomeBpm != null) metronomeBpm.value = normalizeInteger(saved.metronomeBpm, 30, 240, 96);
      if (saved.metronomeSubdivision != null) metronomeSubdivision.value = normalizeInteger(saved.metronomeSubdivision, 1, 8, 1);
      practiceHistory.value = normalizePracticeHistory(saved.practiceHistory);
      if (saved.selectedInputDeviceId != null) selectedInputDeviceId.value = String(saved.selectedInputDeviceId);
      if (saved.showWaveform != null) showWaveform.value = saved.showWaveform;
      if (saved.showSpectrum != null) showSpectrum.value = saved.showSpectrum;
      stringOffsets.value = normalizeOffsets(saved.stringOffsets);
      if (saved.sweeteningProfile) sweeteningProfile.value = normalizeSweeteningProfile(saved.sweeteningProfile);
      if (saved.temperament) temperament.value = normalizeTemperament(saved.temperament, temperamentOptions);
      if (saved.temperamentRoot) temperamentRoot.value = normalizeNoteName(saved.temperamentRoot);
      if (saved.themeMode) themeMode.value = normalizeThemeMode(saved.themeMode);
      if (saved.transpose != null) transpose.value = normalizeInteger(saved.transpose, -12, 12, 0);
    } finally {
      isLoading = false;
      loaded.value = true;
    }
  })();

  return loadPromise;
}

async function save() {
  if (!loaded.value || isLoading) return;

  await savePersistedSettings({
    a4: a4.value,
    activeInstrument: activeInstrument.value,
    capo: capo.value,
    customInstruments: customInstruments.value,
    customTemperaments: customTemperaments.value,
    customTunings: customTunings.value,
    displayMode: displayMode.value,
    lastTuningId: lastTuningId.value,
    layoutMode: layoutMode.value,
    leftHanded: leftHanded.value,
    metronomeBeats: metronomeBeats.value,
    metronomeBpm: metronomeBpm.value,
    metronomeSubdivision: metronomeSubdivision.value,
    practiceHistory: practiceHistory.value,
    selectedInputDeviceId: selectedInputDeviceId.value,
    showSpectrum: showSpectrum.value,
    showWaveform: showWaveform.value,
    stringOffsets: stringOffsets.value,
    sweeteningProfile: sweeteningProfile.value,
    temperament: temperament.value,
    temperamentRoot: temperamentRoot.value,
    themeMode: themeMode.value,
    transpose: transpose.value,
  });
}

function scheduleSave() {
  if (!loaded.value || isLoading) return;
  if (saveTimer != null) {
    window.clearTimeout(saveTimer);
  }
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    void save();
  }, 150);
}

function ensureWatcher() {
  if (watchStarted) return;
  watchStarted = true;
  settingsScope.run(() => {
    watch([
      a4,
      activeInstrument,
      capo,
      customInstruments,
      customTemperaments,
      customTunings,
      displayMode,
      lastTuningId,
      layoutMode,
      leftHanded,
      metronomeBeats,
      metronomeBpm,
      metronomeSubdivision,
      practiceHistory,
      selectedInputDeviceId,
      showWaveform,
      showSpectrum,
      stringOffsets,
      sweeteningProfile,
      temperament,
      temperamentRoot,
      themeMode,
      transpose,
    ], () => {
      scheduleSave();
    }, { deep: true });
  });
}

export function useSettings() {
  ensureWatcher();
  void load();

  return {
    a4,
    activeInstrument,
    capo,
    customInstruments,
    customTemperaments,
    customTunings,
    displayMode,
    lastTuningId,
    layoutMode,
    leftHanded,
    metronomeBeats,
    metronomeBpm,
    metronomeSubdivision,
    practiceHistory,
    selectedInputDeviceId,
    showWaveform,
    showSpectrum,
    stringOffsets,
    sweeteningProfile,
    temperament,
    temperamentRoot,
    themeMode,
    transpose,
    loaded,
    load,
    save,
  };
}
