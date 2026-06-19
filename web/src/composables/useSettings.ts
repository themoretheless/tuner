import { effectScope, ref, watch } from 'vue';
import {
  INSTRUMENTS,
  SWEETENING_PROFILES,
  TEMPERAMENTS,
  type InstrumentId,
  type SweeteningProfileId,
  type TemperamentId,
  type Tuning,
} from '../utils/notes';
import type { DisplayMode } from '../utils/settingsStorage';
import { loadPersistedSettings, savePersistedSettings } from '../utils/settingsStorage';

const a4 = ref(440);
const activeInstrument = ref<InstrumentId>('guitar');
const capo = ref(0);
const lastTuningId = ref('standard');
const selectedInputDeviceId = ref('');
const showWaveform = ref(true);
const showSpectrum = ref(true);
const customTunings = ref<Tuning[]>([]);
const displayMode = ref<DisplayMode>('gauge');
const metronomeBeats = ref(4);
const metronomeBpm = ref(96);
const metronomeSubdivision = ref(1);
const stringOffsets = ref<number[]>([]);
const sweeteningProfile = ref<SweeteningProfileId>('none');
const temperament = ref<TemperamentId>('equal');
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

function normalizeInstrument(value: unknown): InstrumentId {
  return INSTRUMENTS.some((instrument) => instrument.id === value) ? value as InstrumentId : 'guitar';
}

function normalizeTemperament(value: unknown): TemperamentId {
  return TEMPERAMENTS.some((item) => item.id === value) ? value as TemperamentId : 'equal';
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

function normalizeTunings(value: unknown): Tuning[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((tuning): tuning is Tuning => (
      tuning &&
      typeof tuning.id === 'string' &&
      typeof tuning.name === 'string' &&
      Array.isArray(tuning.strings)
    ))
    .map((tuning) => ({ ...tuning, kind: 'custom' }));
}

async function load() {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    isLoading = true;
    try {
      const saved = await loadPersistedSettings();
      if (saved.a4 != null) a4.value = normalizeA4(saved.a4);
      if (saved.activeInstrument) activeInstrument.value = normalizeInstrument(saved.activeInstrument);
      if (saved.capo != null) capo.value = normalizeInteger(saved.capo, 0, 12, 0);
      if (saved.lastTuningId) lastTuningId.value = saved.lastTuningId;
      if (saved.selectedInputDeviceId != null) selectedInputDeviceId.value = String(saved.selectedInputDeviceId);
      if (saved.showWaveform != null) showWaveform.value = saved.showWaveform;
      if (saved.showSpectrum != null) showSpectrum.value = saved.showSpectrum;
      customTunings.value = normalizeTunings(saved.customTunings);
      if (saved.displayMode) displayMode.value = normalizeDisplayMode(saved.displayMode);
      if (saved.metronomeBeats != null) metronomeBeats.value = normalizeInteger(saved.metronomeBeats, 1, 12, 4);
      if (saved.metronomeBpm != null) metronomeBpm.value = normalizeInteger(saved.metronomeBpm, 30, 240, 96);
      if (saved.metronomeSubdivision != null) metronomeSubdivision.value = normalizeInteger(saved.metronomeSubdivision, 1, 8, 1);
      stringOffsets.value = normalizeOffsets(saved.stringOffsets);
      if (saved.sweeteningProfile) sweeteningProfile.value = normalizeSweeteningProfile(saved.sweeteningProfile);
      if (saved.temperament) temperament.value = normalizeTemperament(saved.temperament);
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
    customTunings: customTunings.value,
    displayMode: displayMode.value,
    lastTuningId: lastTuningId.value,
    metronomeBeats: metronomeBeats.value,
    metronomeBpm: metronomeBpm.value,
    metronomeSubdivision: metronomeSubdivision.value,
    selectedInputDeviceId: selectedInputDeviceId.value,
    showSpectrum: showSpectrum.value,
    showWaveform: showWaveform.value,
    stringOffsets: stringOffsets.value,
    sweeteningProfile: sweeteningProfile.value,
    temperament: temperament.value,
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
    watch([a4, activeInstrument, capo, lastTuningId, metronomeBeats, metronomeBpm, metronomeSubdivision, selectedInputDeviceId, showWaveform, showSpectrum, customTunings, displayMode, stringOffsets, sweeteningProfile, temperament, transpose], () => {
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
    lastTuningId,
    selectedInputDeviceId,
    showWaveform,
    showSpectrum,
    customTunings,
    displayMode,
    metronomeBeats,
    metronomeBpm,
    metronomeSubdivision,
    stringOffsets,
    sweeteningProfile,
    temperament,
    transpose,
    loaded,
    load,
    save,
  };
}
