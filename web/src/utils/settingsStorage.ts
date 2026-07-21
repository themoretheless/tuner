import type { Store } from '@tauri-apps/plugin-store';
import { createUserProfile, decodeUserProfile } from '../settings/profileCodec';
import type { PipelineConfig } from '../domain/pipelineConfig';
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
  pipelineConfig: PipelineConfig;
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

const PROFILE_KEY = 'userProfileV1';

const isTauri = typeof globalThis !== 'undefined' &&
  Boolean((globalThis as typeof globalThis & { isTauri?: boolean }).isTauri);

let store: Store | null = null;

async function getStore() {
  if (!isTauri) return null;
  if (!store) {
    const { Store } = await import('@tauri-apps/plugin-store');
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
  } catch (cause) {
    const detail = cause instanceof Error ? `: ${cause.message}` : '';
    throw new Error(`Could not persist tuner settings${detail}`);
  }
}

export async function loadPersistedSettings(): Promise<Partial<PersistedSettings>> {
  if (isTauri) {
    const s = await getStore();
    if (!s) return {};
    const profile = decodeUserProfile(await s.get<unknown>(PROFILE_KEY));
    if (profile) return profile.settings;
    return {
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
      pipelineConfig: await s.get<PipelineConfig>('pipelineConfig') ?? undefined,
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
    };
  }

  const profile = decodeUserProfile(readJson<unknown>(PROFILE_KEY));
  if (profile) return profile.settings;

  const savedA4 = readLocal('a4');
  const savedChromatic = readLocal('chromatic');
  const savedInTuneTolerance = readLocal('inTuneTolerance');
  const savedShowSpectrogram = readLocal('showSpectrogram');
  const savedShowSpectrum = readLocal('showSpectrum');
  const savedShowWaveform = readLocal('showWaveform');

  return {
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
    pipelineConfig: readJson<PipelineConfig>('pipelineConfig'),
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
  };
}

export async function savePersistedSettings(settings: PersistedSettings) {
  const profile = createUserProfile(settings);
  if (isTauri) {
    const s = await getStore();
    if (!s) throw new Error('Tauri settings store unavailable');
    await s.set(PROFILE_KEY, profile);
    await s.save();
    return;
  }

  writeLocal(PROFILE_KEY, JSON.stringify(profile));
}
