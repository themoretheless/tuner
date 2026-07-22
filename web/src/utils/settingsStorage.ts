import { Store } from '@tauri-apps/plugin-store';
import type {
  InstrumentId,
  InstrumentPreset,
  NoteName,
  SweeteningProfileId,
  Temperament,
  TemperamentId,
  Tuning,
} from './notes';

export type DisplayMode = 'gauge' | 'needle' | 'strobe';
export type LayoutMode = 'default' | 'stage' | 'compact';
export type ThemeMode = 'dark' | 'light' | 'colorblind';
export type AudioBackend = 'web' | 'native';

export const SETTINGS_SCHEMA_VERSION = 2;

export interface PracticeHistoryEntry {
  at: number;
  correct: boolean;
  note: string;
}

export interface PersistedSettings {
  a4: number;
  activeInstrument: InstrumentId;
  audioBackend: AudioBackend;
  capo: number;
  chromatic: boolean;
  customInstruments: InstrumentPreset[];
  customTemperaments: Temperament[];
  customTunings: Tuning[];
  displayMode: DisplayMode;
  inTuneTolerance: number;
  lastTuningId: string;
  layoutMode: LayoutMode;
  leftHanded: boolean;
  metronomeBeats: number;
  metronomeBpm: number;
  metronomeSubdivision: number;
  practiceHistory: PracticeHistoryEntry[];
  selectedInputDeviceId: string;
  showSpectrogram: boolean;
  showSpectrum: boolean;
  showWaveform: boolean;
  stringOffsets: number[];
  sweeteningProfile: SweeteningProfileId;
  temperament: TemperamentId;
  temperamentRoot: NoteName;
  themeMode: ThemeMode;
  transpose: number;
}

type TauriGlobal = typeof globalThis & {
  __TAURI__?: unknown;
  __TAURI_INTERNALS__?: unknown;
  isTauri?: boolean;
};

export function isTauriRuntime() {
  if (typeof globalThis === 'undefined') return false;
  const runtime = globalThis as TauriGlobal;
  return Boolean(runtime.__TAURI_INTERNALS__ || runtime.__TAURI__ || runtime.isTauri === true);
}

let store: Store | null = null;

async function getStore() {
  if (!isTauriRuntime()) return null;
  if (!store) {
    store = await Store.load('settings.dat');
  }
  return store;
}

function readJson<T>(key: string): T | undefined {
  const raw = readLocal(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function readLocal(key: string): string | undefined {
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeLocal(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private browsing and quota failures should not break live tuning.
  }
}

export async function loadPersistedSettings(): Promise<Partial<PersistedSettings>> {
  if (isTauriRuntime()) {
    const s = await getStore();
    if (!s) return {};
    const schemaVersion = await s.get<number>('schemaVersion') ?? 0;
    return migratePersistedSettings({
      a4: await s.get<number>('a4') ?? undefined,
      activeInstrument: await s.get<InstrumentId>('activeInstrument') ?? undefined,
      audioBackend: await s.get<AudioBackend>('audioBackend') ?? undefined,
      capo: await s.get<number>('capo') ?? undefined,
      chromatic: await s.get<boolean>('chromatic') ?? undefined,
      customInstruments: await s.get<InstrumentPreset[]>('customInstruments') ?? undefined,
      customTemperaments: await s.get<Temperament[]>('customTemperaments') ?? undefined,
      customTunings: await s.get<Tuning[]>('customTunings') ?? undefined,
      displayMode: await s.get<DisplayMode>('displayMode') ?? undefined,
      inTuneTolerance: await s.get<number>('inTuneTolerance') ?? undefined,
      lastTuningId: await s.get<string>('lastTuningId') ?? undefined,
      layoutMode: await s.get<LayoutMode>('layoutMode') ?? undefined,
      leftHanded: await s.get<boolean>('leftHanded') ?? undefined,
      metronomeBeats: await s.get<number>('metronomeBeats') ?? undefined,
      metronomeBpm: await s.get<number>('metronomeBpm') ?? undefined,
      metronomeSubdivision: await s.get<number>('metronomeSubdivision') ?? undefined,
      practiceHistory: await s.get<PracticeHistoryEntry[]>('practiceHistory') ?? undefined,
      selectedInputDeviceId: await s.get<string>('selectedInputDeviceId') ?? undefined,
      showSpectrogram: await s.get<boolean>('showSpectrogram') ?? undefined,
      showSpectrum: await s.get<boolean>('showSpectrum') ?? undefined,
      showWaveform: await s.get<boolean>('showWaveform') ?? undefined,
      stringOffsets: await s.get<number[]>('stringOffsets') ?? undefined,
      sweeteningProfile: await s.get<SweeteningProfileId>('sweeteningProfile') ?? undefined,
      temperament: await s.get<TemperamentId>('temperament') ?? undefined,
      temperamentRoot: await s.get<NoteName>('temperamentRoot') ?? undefined,
      themeMode: await s.get<ThemeMode>('themeMode') ?? undefined,
      transpose: await s.get<number>('transpose') ?? undefined,
    }, schemaVersion);
  }

  const savedA4 = readLocal('a4');
  const savedChromatic = readLocal('chromatic');
  const savedInTuneTolerance = readLocal('inTuneTolerance');
  const savedShowSpectrogram = readLocal('showSpectrogram');
  const savedShowSpectrum = readLocal('showSpectrum');
  const savedShowWaveform = readLocal('showWaveform');

  const schemaVersion = Number(readLocal('schemaVersion')) || 0;
  return migratePersistedSettings({
    a4: savedA4 ? Number(savedA4) : undefined,
    activeInstrument: readLocal('activeInstrument') as InstrumentId | undefined,
    audioBackend: readLocal('audioBackend') as AudioBackend | undefined,
    capo: readLocal('capo') ? Number(readLocal('capo')) : undefined,
    chromatic: savedChromatic != null ? savedChromatic === 'true' : undefined,
    customInstruments: readJson<InstrumentPreset[]>('customInstruments'),
    customTemperaments: readJson<Temperament[]>('customTemperaments'),
    customTunings: readJson<Tuning[]>('customTunings'),
    displayMode: readLocal('displayMode') as DisplayMode | undefined,
    inTuneTolerance: savedInTuneTolerance ? Number(savedInTuneTolerance) : undefined,
    lastTuningId: readLocal('lastTuningId'),
    layoutMode: readLocal('layoutMode') as LayoutMode | undefined,
    leftHanded: readLocal('leftHanded') != null
      ? readLocal('leftHanded') === 'true'
      : undefined,
    metronomeBeats: readLocal('metronomeBeats') ? Number(readLocal('metronomeBeats')) : undefined,
    metronomeBpm: readLocal('metronomeBpm') ? Number(readLocal('metronomeBpm')) : undefined,
    metronomeSubdivision: readLocal('metronomeSubdivision') ? Number(readLocal('metronomeSubdivision')) : undefined,
    practiceHistory: readJson<PracticeHistoryEntry[]>('practiceHistory'),
    selectedInputDeviceId: readLocal('selectedInputDeviceId'),
    showSpectrogram: savedShowSpectrogram != null
      ? savedShowSpectrogram === 'true'
      : undefined,
    showSpectrum: savedShowSpectrum != null
      ? savedShowSpectrum === 'true'
      : undefined,
    showWaveform: savedShowWaveform != null
      ? savedShowWaveform === 'true'
      : undefined,
    stringOffsets: readJson<number[]>('stringOffsets'),
    sweeteningProfile: readLocal('sweeteningProfile') as SweeteningProfileId | undefined,
    temperament: readLocal('temperament') as TemperamentId | undefined,
    temperamentRoot: readLocal('temperamentRoot') as NoteName | undefined,
    themeMode: readLocal('themeMode') as ThemeMode | undefined,
    transpose: readLocal('transpose') ? Number(readLocal('transpose')) : undefined,
  }, schemaVersion);
}

export async function savePersistedSettings(settings: PersistedSettings) {
  if (isTauriRuntime()) {
    const s = await getStore();
    if (!s) return;
    await s.set('a4', settings.a4);
    await s.set('activeInstrument', settings.activeInstrument);
    await s.set('audioBackend', settings.audioBackend);
    await s.set('capo', settings.capo);
    await s.set('chromatic', settings.chromatic);
    await s.set('customInstruments', settings.customInstruments);
    await s.set('customTemperaments', settings.customTemperaments);
    await s.set('customTunings', settings.customTunings);
    await s.set('displayMode', settings.displayMode);
    await s.set('inTuneTolerance', settings.inTuneTolerance);
    await s.set('lastTuningId', settings.lastTuningId);
    await s.set('layoutMode', settings.layoutMode);
    await s.set('leftHanded', settings.leftHanded);
    await s.set('metronomeBeats', settings.metronomeBeats);
    await s.set('metronomeBpm', settings.metronomeBpm);
    await s.set('metronomeSubdivision', settings.metronomeSubdivision);
    await s.set('practiceHistory', settings.practiceHistory);
    await s.set('selectedInputDeviceId', settings.selectedInputDeviceId);
    await s.set('showSpectrogram', settings.showSpectrogram);
    await s.set('showSpectrum', settings.showSpectrum);
    await s.set('showWaveform', settings.showWaveform);
    await s.set('stringOffsets', settings.stringOffsets);
    await s.set('sweeteningProfile', settings.sweeteningProfile);
    await s.set('temperament', settings.temperament);
    await s.set('temperamentRoot', settings.temperamentRoot);
    await s.set('themeMode', settings.themeMode);
    await s.set('transpose', settings.transpose);
    await s.set('schemaVersion', SETTINGS_SCHEMA_VERSION);
    await s.save();
    return;
  }

  writeLocal('a4', settings.a4.toString());
  writeLocal('activeInstrument', settings.activeInstrument);
  writeLocal('audioBackend', settings.audioBackend);
  writeLocal('capo', settings.capo.toString());
  writeLocal('chromatic', settings.chromatic.toString());
  writeLocal('customInstruments', JSON.stringify(settings.customInstruments));
  writeLocal('customTemperaments', JSON.stringify(settings.customTemperaments));
  writeLocal('customTunings', JSON.stringify(settings.customTunings));
  writeLocal('displayMode', settings.displayMode);
  writeLocal('inTuneTolerance', settings.inTuneTolerance.toString());
  writeLocal('lastTuningId', settings.lastTuningId);
  writeLocal('layoutMode', settings.layoutMode);
  writeLocal('leftHanded', settings.leftHanded.toString());
  writeLocal('metronomeBeats', settings.metronomeBeats.toString());
  writeLocal('metronomeBpm', settings.metronomeBpm.toString());
  writeLocal('metronomeSubdivision', settings.metronomeSubdivision.toString());
  writeLocal('practiceHistory', JSON.stringify(settings.practiceHistory));
  writeLocal('selectedInputDeviceId', settings.selectedInputDeviceId);
  writeLocal('showSpectrogram', settings.showSpectrogram.toString());
  writeLocal('showSpectrum', settings.showSpectrum.toString());
  writeLocal('showWaveform', settings.showWaveform.toString());
  writeLocal('stringOffsets', JSON.stringify(settings.stringOffsets));
  writeLocal('sweeteningProfile', settings.sweeteningProfile);
  writeLocal('temperament', settings.temperament);
  writeLocal('temperamentRoot', settings.temperamentRoot);
  writeLocal('themeMode', settings.themeMode);
  writeLocal('transpose', settings.transpose.toString());
  writeLocal('schemaVersion', SETTINGS_SCHEMA_VERSION.toString());
}

const BOOLEAN_SETTING_KEYS = [
  'chromatic',
  'leftHanded',
  'showSpectrogram',
  'showSpectrum',
  'showWaveform',
] as const satisfies readonly (keyof PersistedSettings)[];

/**
 * Keeps old unversioned installs readable while rejecting truthy strings and
 * other malformed values from current stores. Version 1 stored booleans as
 * strings in some desktop builds and used `inputDeviceId` for the selected
 * device key.
 */
export function migratePersistedSettings(
  input: Record<string, unknown>,
  schemaVersion = 0,
): Partial<PersistedSettings> {
  const migrated: Record<string, unknown> = { ...input };

  if (
    schemaVersion < 2 &&
    migrated.selectedInputDeviceId == null &&
    typeof migrated.inputDeviceId === 'string'
  ) {
    migrated.selectedInputDeviceId = migrated.inputDeviceId;
  }

  for (const key of BOOLEAN_SETTING_KEYS) {
    const value = migrated[key];
    if (typeof value === 'boolean') continue;
    if (schemaVersion < 2 && (value === 'true' || value === 'false')) {
      migrated[key] = value === 'true';
    } else {
      delete migrated[key];
    }
  }

  return migrated as Partial<PersistedSettings>;
}
