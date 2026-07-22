import { effectScope, ref, watch } from 'vue';
import {
  INSTRUMENTS,
  NOTE_NAMES,
  SWEETENING_PROFILES,
  TEMPERAMENTS,
  normalizeTemperamentOffsets,
  noteWithA4,
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
  PracticeHistoryEntry,
  ThemeMode,
} from '../utils/settingsStorage';
import { loadPersistedSettings, savePersistedSettings } from '../utils/settingsStorage';

const a4 = ref(440);
const activeInstrument = ref<InstrumentId>('guitar');
const audioBackend = ref<AudioBackend>('web');
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
const chromatic = ref(false);
const inTuneTolerance = ref(5);
const showSpectrogram = ref(false);
const showWaveform = ref(false);
const showSpectrum = ref(false);
const stringOffsets = ref<number[]>([]);
const sweeteningProfile = ref<SweeteningProfileId>('none');
const temperament = ref<TemperamentId>('equal');
const temperamentRoot = ref<NoteName>('A');
const themeMode = ref<ThemeMode>('dark');
const transpose = ref(0);
const loaded = ref(false);
const isLoading = ref(false);
const loadError = ref<string | null>(null);
const saveError = ref<string | null>(null);

let loadPromise: Promise<void> | null = null;
let watchStarted = false;
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

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

export function normalizePersistedNote(value: unknown): Note | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<Note>;
  if (!NOTE_NAMES.includes(item.name as NoteName)) return null;
  const octave = normalizeInteger(item.octave, 0, 8, 4);
  return noteWithA4({ name: item.name as NoteName, octave }, 440);
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
      strings: tuning.strings.map(normalizePersistedNote).filter((note): note is Note => !!note),
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

  const attempt = (async () => {
    isLoading.value = true;
    loadError.value = null;
    try {
      const saved = await loadPersistedSettings();
      customInstruments.value = normalizeInstruments(saved.customInstruments);
      customTemperaments.value = normalizeTemperaments(saved.customTemperaments);
      customTunings.value = normalizeTunings(saved.customTunings);

      const instrumentOptions = [...INSTRUMENTS, ...customInstruments.value];
      const temperamentOptions = [...TEMPERAMENTS, ...customTemperaments.value];

      if (saved.a4 != null) a4.value = normalizeA4(saved.a4);
      if (saved.activeInstrument) activeInstrument.value = normalizeInstrument(saved.activeInstrument, instrumentOptions);
      if (saved.audioBackend) audioBackend.value = normalizeAudioBackend(saved.audioBackend);
      if (saved.capo != null) capo.value = normalizeInteger(saved.capo, 0, 12, 0);
      if (saved.chromatic != null) chromatic.value = normalizeBoolean(saved.chromatic, false);
      if (saved.displayMode) displayMode.value = normalizeDisplayMode(saved.displayMode);
      if (saved.inTuneTolerance != null) inTuneTolerance.value = normalizeInteger(saved.inTuneTolerance, 1, 25, 5);
      if (saved.lastTuningId) lastTuningId.value = saved.lastTuningId;
      if (saved.layoutMode) layoutMode.value = normalizeLayoutMode(saved.layoutMode);
      if (saved.leftHanded != null) leftHanded.value = normalizeBoolean(saved.leftHanded, false);
      if (saved.metronomeBeats != null) metronomeBeats.value = normalizeInteger(saved.metronomeBeats, 1, 12, 4);
      if (saved.metronomeBpm != null) metronomeBpm.value = normalizeInteger(saved.metronomeBpm, 30, 240, 96);
      if (saved.metronomeSubdivision != null) metronomeSubdivision.value = normalizeInteger(saved.metronomeSubdivision, 1, 8, 1);
      practiceHistory.value = normalizePracticeHistory(saved.practiceHistory);
      if (saved.selectedInputDeviceId != null) selectedInputDeviceId.value = String(saved.selectedInputDeviceId);
      if (saved.showSpectrogram != null) showSpectrogram.value = normalizeBoolean(saved.showSpectrogram, false);
      if (saved.showWaveform != null) showWaveform.value = normalizeBoolean(saved.showWaveform, false);
      if (saved.showSpectrum != null) showSpectrum.value = normalizeBoolean(saved.showSpectrum, false);
      stringOffsets.value = normalizeOffsets(saved.stringOffsets);
      if (saved.sweeteningProfile) sweeteningProfile.value = normalizeSweeteningProfile(saved.sweeteningProfile);
      if (saved.temperament) temperament.value = normalizeTemperament(saved.temperament, temperamentOptions);
      if (saved.temperamentRoot) temperamentRoot.value = normalizeNoteName(saved.temperamentRoot);
      if (saved.themeMode) themeMode.value = normalizeThemeMode(saved.themeMode);
      if (saved.transpose != null) transpose.value = normalizeInteger(saved.transpose, -12, 12, 0);
      loaded.value = true;
    } catch (settingsError: unknown) {
      // Keep safe defaults usable, but do not overwrite the unread store until
      // the user/application retries successfully.
      loadError.value = settingsError instanceof Error
        ? settingsError.message
        : 'Unable to load settings';
      loaded.value = true;
    } finally {
      isLoading.value = false;
    }
  })();

  loadPromise = attempt;
  await attempt;
  if (loadPromise === attempt && loadError.value) {
    loadPromise = null;
  }
}

function retryLoad() {
  if (isLoading.value && loadPromise) return loadPromise;
  loadPromise = null;
  return load();
}

async function save() {
  if (!loaded.value || isLoading.value || loadError.value) return;

  saveError.value = null;
  try {
    await savePersistedSettings({
      a4: a4.value,
      activeInstrument: activeInstrument.value,
      audioBackend: audioBackend.value,
      capo: capo.value,
      chromatic: chromatic.value,
      customInstruments: customInstruments.value,
      customTemperaments: customTemperaments.value,
      customTunings: customTunings.value,
      displayMode: displayMode.value,
      inTuneTolerance: inTuneTolerance.value,
      lastTuningId: lastTuningId.value,
      layoutMode: layoutMode.value,
      leftHanded: leftHanded.value,
      metronomeBeats: metronomeBeats.value,
      metronomeBpm: metronomeBpm.value,
      metronomeSubdivision: metronomeSubdivision.value,
      practiceHistory: practiceHistory.value,
      selectedInputDeviceId: selectedInputDeviceId.value,
      showSpectrogram: showSpectrogram.value,
      showSpectrum: showSpectrum.value,
      showWaveform: showWaveform.value,
      stringOffsets: stringOffsets.value,
      sweeteningProfile: sweeteningProfile.value,
      temperament: temperament.value,
      temperamentRoot: temperamentRoot.value,
      themeMode: themeMode.value,
      transpose: transpose.value,
    });
  } catch (settingsError: unknown) {
    saveError.value = settingsError instanceof Error
      ? settingsError.message
      : 'Unable to save settings';
  }
}

function scheduleSave() {
  if (!loaded.value || isLoading.value || loadError.value) return;
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
      audioBackend,
      capo,
      chromatic,
      customInstruments,
      customTemperaments,
      customTunings,
      displayMode,
      inTuneTolerance,
      lastTuningId,
      layoutMode,
      leftHanded,
      metronomeBeats,
      metronomeBpm,
      metronomeSubdivision,
      practiceHistory,
      selectedInputDeviceId,
      showSpectrogram,
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
    audioBackend,
    capo,
    chromatic,
    customInstruments,
    customTemperaments,
    customTunings,
    displayMode,
    inTuneTolerance,
    lastTuningId,
    layoutMode,
    leftHanded,
    metronomeBeats,
    metronomeBpm,
    metronomeSubdivision,
    practiceHistory,
    selectedInputDeviceId,
    showSpectrogram,
    showWaveform,
    showSpectrum,
    stringOffsets,
    sweeteningProfile,
    temperament,
    temperamentRoot,
    themeMode,
    transpose,
    loaded,
    isLoading,
    loadError,
    saveError,
    load,
    retryLoad,
    save,
  };
}
