import { effectScope, ref, watch } from 'vue';
import { createDefaultSettings, normalizePersistedSettings } from '../settings/normalizeSettings';
import { decodeUserProfile, encodeUserProfile } from '../settings/profileCodec';
import type { InstrumentId, InstrumentPreset, NoteName, SweeteningProfileId, Temperament, TemperamentId, Tuning } from '../utils/notes';
import {
  loadPersistedSettings,
  savePersistedSettings,
  type AudioBackend,
  type DisplayMode,
  type LayoutMode,
  type PersistedSettings,
  type PracticeHistoryEntry,
  type ThemeMode,
} from '../utils/settingsStorage';

const defaults = createDefaultSettings();
const a4 = ref(defaults.a4);
const activeInstrument = ref<InstrumentId>(defaults.activeInstrument);
const audioBackend = ref<AudioBackend>(defaults.audioBackend);
const capo = ref(defaults.capo);
const chromatic = ref(defaults.chromatic);
const customInstruments = ref<InstrumentPreset[]>([]);
const customTemperaments = ref<Temperament[]>([]);
const customTunings = ref<Tuning[]>([]);
const displayMode = ref<DisplayMode>(defaults.displayMode);
const inTuneTolerance = ref(defaults.inTuneTolerance);
const lastTuningId = ref(defaults.lastTuningId);
const layoutMode = ref<LayoutMode>(defaults.layoutMode);
const leftHanded = ref(defaults.leftHanded);
const metronomeBeats = ref(defaults.metronomeBeats);
const metronomeBpm = ref(defaults.metronomeBpm);
const metronomeSubdivision = ref(defaults.metronomeSubdivision);
const pipelineConfig = ref(defaults.pipelineConfig);
const practiceHistory = ref<PracticeHistoryEntry[]>([]);
const selectedInputDeviceId = ref(defaults.selectedInputDeviceId);
const showSpectrogram = ref(defaults.showSpectrogram);
const showSpectrum = ref(defaults.showSpectrum);
const showWaveform = ref(defaults.showWaveform);
const stringOffsets = ref<number[]>([]);
const sweeteningProfile = ref<SweeteningProfileId>(defaults.sweeteningProfile);
const temperament = ref<TemperamentId>(defaults.temperament);
const temperamentRoot = ref<NoteName>(defaults.temperamentRoot);
const themeMode = ref<ThemeMode>(defaults.themeMode);
const transpose = ref(defaults.transpose);
const loaded = ref(false);

let loadPromise: Promise<void> | null = null;
let watchStarted = false;
let isLoading = false;
let saveTimer: number | null = null;
let saveTail: Promise<void> = Promise.resolve();
const settingsScope = effectScope(true);

async function load() {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    isLoading = true;
    try {
      applySettings(await loadPersistedSettings());
    } catch {
      applySettings(defaults);
    } finally {
      isLoading = false;
      loaded.value = true;
    }
  })();
  return loadPromise;
}

function save() {
  if (!loaded.value || isLoading) return Promise.resolve();
  const settings = snapshotSettings();
  const operation = saveTail
    .catch(() => {})
    .then(() => savePersistedSettings(settings));
  saveTail = operation;
  return operation;
}

function exportUserProfile() {
  return encodeUserProfile(snapshotSettings());
}

async function importUserProfile(payload: string) {
  await load();
  const profile = decodeUserProfile(payload);
  if (!profile) return false;

  isLoading = true;
  try {
    applySettings(profile.settings);
  } finally {
    isLoading = false;
  }
  await save();
  return true;
}

function applySettings(value: Partial<PersistedSettings>) {
  const settings = normalizePersistedSettings(value);
  a4.value = settings.a4;
  activeInstrument.value = settings.activeInstrument;
  audioBackend.value = settings.audioBackend;
  capo.value = settings.capo;
  chromatic.value = settings.chromatic;
  customInstruments.value = settings.customInstruments;
  customTemperaments.value = settings.customTemperaments;
  customTunings.value = settings.customTunings;
  displayMode.value = settings.displayMode;
  inTuneTolerance.value = settings.inTuneTolerance;
  lastTuningId.value = settings.lastTuningId;
  layoutMode.value = settings.layoutMode;
  leftHanded.value = settings.leftHanded;
  metronomeBeats.value = settings.metronomeBeats;
  metronomeBpm.value = settings.metronomeBpm;
  metronomeSubdivision.value = settings.metronomeSubdivision;
  pipelineConfig.value = settings.pipelineConfig;
  practiceHistory.value = settings.practiceHistory;
  selectedInputDeviceId.value = settings.selectedInputDeviceId;
  showSpectrogram.value = settings.showSpectrogram;
  showSpectrum.value = settings.showSpectrum;
  showWaveform.value = settings.showWaveform;
  stringOffsets.value = settings.stringOffsets;
  sweeteningProfile.value = settings.sweeteningProfile;
  temperament.value = settings.temperament;
  temperamentRoot.value = settings.temperamentRoot;
  themeMode.value = settings.themeMode;
  transpose.value = settings.transpose;
}

function snapshotSettings(): PersistedSettings {
  return {
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
    pipelineConfig: pipelineConfig.value,
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
  };
}

function scheduleSave() {
  if (!loaded.value || isLoading) return;
  if (saveTimer != null) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    void save().catch(() => {});
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
      pipelineConfig,
      practiceHistory,
      selectedInputDeviceId,
      showSpectrogram,
      showSpectrum,
      showWaveform,
      stringOffsets,
      sweeteningProfile,
      temperament,
      temperamentRoot,
      themeMode,
      transpose,
    ], scheduleSave, { deep: true });
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
    exportUserProfile,
    importUserProfile,
    inTuneTolerance,
    lastTuningId,
    layoutMode,
    leftHanded,
    loaded,
    load,
    metronomeBeats,
    metronomeBpm,
    metronomeSubdivision,
    pipelineConfig,
    practiceHistory,
    save,
    selectedInputDeviceId,
    showSpectrogram,
    showSpectrum,
    showWaveform,
    stringOffsets,
    sweeteningProfile,
    temperament,
    temperamentRoot,
    themeMode,
    transpose,
  };
}
