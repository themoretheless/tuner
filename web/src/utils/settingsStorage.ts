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

export interface PracticeHistoryEntry {
  at: number;
  correct: boolean;
  note: string;
}

export interface PersistedSettings {
  a4: number;
  activeInstrument: InstrumentId;
  capo: number;
  chromatic: boolean;
  customInstruments: InstrumentPreset[];
  customTemperaments: Temperament[];
  customTunings: Tuning[];
  displayMode: DisplayMode;
  feedbackFlash: boolean;
  feedbackSound: boolean;
  feedbackVibrate: boolean;
  inTuneTolerance: number;
  lastTuningId: string;
  layoutMode: LayoutMode;
  leftHanded: boolean;
  metronomeBeats: number;
  metronomeBpm: number;
  metronomeSubdivision: number;
  pipelineConfig: PipelineConfig;
  practiceHistory: PracticeHistoryEntry[];
  readoutStability: number;
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
  const profile = decodeUserProfile(readJson<unknown>(PROFILE_KEY));
  if (profile) return profile.settings;

  const savedA4 = readLocal('a4');
  const savedChromatic = readLocal('chromatic');
  const savedFeedbackFlash = readLocal('feedbackFlash');
  const savedFeedbackSound = readLocal('feedbackSound');
  const savedFeedbackVibrate = readLocal('feedbackVibrate');
  const savedInTuneTolerance = readLocal('inTuneTolerance');
  const savedReadoutStability = readLocal('readoutStability');
  const savedShowSpectrogram = readLocal('showSpectrogram');
  const savedShowSpectrum = readLocal('showSpectrum');
  const savedShowWaveform = readLocal('showWaveform');

  return {
    a4: savedA4 ? Number(savedA4) : undefined,
    activeInstrument: readLocal('activeInstrument') as InstrumentId | undefined,
    capo: readLocal('capo') ? Number(readLocal('capo')) : undefined,
    chromatic: savedChromatic != null ? savedChromatic === 'true' : undefined,
    customInstruments: readJson<InstrumentPreset[]>('customInstruments'),
    customTemperaments: readJson<Temperament[]>('customTemperaments'),
    customTunings: readJson<Tuning[]>('customTunings'),
    displayMode: readLocal('displayMode') as DisplayMode | undefined,
    feedbackFlash: savedFeedbackFlash != null ? savedFeedbackFlash === 'true' : undefined,
    feedbackSound: savedFeedbackSound != null ? savedFeedbackSound === 'true' : undefined,
    feedbackVibrate: savedFeedbackVibrate != null ? savedFeedbackVibrate === 'true' : undefined,
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
    readoutStability: savedReadoutStability ? Number(savedReadoutStability) : undefined,
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
  writeLocal(PROFILE_KEY, JSON.stringify(profile));
}
