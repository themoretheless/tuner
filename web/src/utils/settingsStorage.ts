import { Store } from '@tauri-apps/plugin-store';
import type { InstrumentId, SweeteningProfileId, TemperamentId, Tuning } from './notes';

export type DisplayMode = 'gauge' | 'needle' | 'strobe';

export interface PersistedSettings {
  a4: number;
  activeInstrument: InstrumentId;
  capo: number;
  customTunings: Tuning[];
  displayMode: DisplayMode;
  lastTuningId: string;
  metronomeBeats: number;
  metronomeBpm: number;
  metronomeSubdivision: number;
  selectedInputDeviceId: string;
  showSpectrum: boolean;
  showWaveform: boolean;
  stringOffsets: number[];
  sweeteningProfile: SweeteningProfileId;
  temperament: TemperamentId;
  transpose: number;
}

const isTauri = typeof globalThis !== 'undefined' &&
  Boolean((globalThis as typeof globalThis & { isTauri?: boolean }).isTauri);

let store: Store | null = null;

async function getStore() {
  if (!isTauri) return null;
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
  if (isTauri) {
    const s = await getStore();
    if (!s) return {};
    return {
      a4: await s.get<number>('a4') ?? undefined,
      activeInstrument: await s.get<InstrumentId>('activeInstrument') ?? undefined,
      capo: await s.get<number>('capo') ?? undefined,
      customTunings: await s.get<Tuning[]>('customTunings') ?? undefined,
      displayMode: await s.get<DisplayMode>('displayMode') ?? undefined,
      lastTuningId: await s.get<string>('lastTuningId') ?? undefined,
      metronomeBeats: await s.get<number>('metronomeBeats') ?? undefined,
      metronomeBpm: await s.get<number>('metronomeBpm') ?? undefined,
      metronomeSubdivision: await s.get<number>('metronomeSubdivision') ?? undefined,
      selectedInputDeviceId: await s.get<string>('selectedInputDeviceId') ?? undefined,
      showSpectrum: await s.get<boolean>('showSpectrum') ?? undefined,
      showWaveform: await s.get<boolean>('showWaveform') ?? undefined,
      stringOffsets: await s.get<number[]>('stringOffsets') ?? undefined,
      sweeteningProfile: await s.get<SweeteningProfileId>('sweeteningProfile') ?? undefined,
      temperament: await s.get<TemperamentId>('temperament') ?? undefined,
      transpose: await s.get<number>('transpose') ?? undefined,
    };
  }

  const savedA4 = readLocal('a4');
  const savedShowSpectrum = readLocal('showSpectrum');
  const savedShowWaveform = readLocal('showWaveform');

  return {
    a4: savedA4 ? Number(savedA4) : undefined,
    activeInstrument: readLocal('activeInstrument') as InstrumentId | undefined,
    capo: readLocal('capo') ? Number(readLocal('capo')) : undefined,
    customTunings: readJson<Tuning[]>('customTunings'),
    displayMode: readLocal('displayMode') as DisplayMode | undefined,
    lastTuningId: readLocal('lastTuningId'),
    metronomeBeats: readLocal('metronomeBeats') ? Number(readLocal('metronomeBeats')) : undefined,
    metronomeBpm: readLocal('metronomeBpm') ? Number(readLocal('metronomeBpm')) : undefined,
    metronomeSubdivision: readLocal('metronomeSubdivision') ? Number(readLocal('metronomeSubdivision')) : undefined,
    selectedInputDeviceId: readLocal('selectedInputDeviceId'),
    showSpectrum: savedShowSpectrum != null
      ? savedShowSpectrum === 'true'
      : undefined,
    showWaveform: savedShowWaveform != null
      ? savedShowWaveform === 'true'
      : undefined,
    stringOffsets: readJson<number[]>('stringOffsets'),
    sweeteningProfile: readLocal('sweeteningProfile') as SweeteningProfileId | undefined,
    temperament: readLocal('temperament') as TemperamentId | undefined,
    transpose: readLocal('transpose') ? Number(readLocal('transpose')) : undefined,
  };
}

export async function savePersistedSettings(settings: PersistedSettings) {
  if (isTauri) {
    const s = await getStore();
    if (!s) return;
    await s.set('a4', settings.a4);
    await s.set('activeInstrument', settings.activeInstrument);
    await s.set('capo', settings.capo);
    await s.set('customTunings', settings.customTunings);
    await s.set('displayMode', settings.displayMode);
    await s.set('lastTuningId', settings.lastTuningId);
    await s.set('metronomeBeats', settings.metronomeBeats);
    await s.set('metronomeBpm', settings.metronomeBpm);
    await s.set('metronomeSubdivision', settings.metronomeSubdivision);
    await s.set('selectedInputDeviceId', settings.selectedInputDeviceId);
    await s.set('showSpectrum', settings.showSpectrum);
    await s.set('showWaveform', settings.showWaveform);
    await s.set('stringOffsets', settings.stringOffsets);
    await s.set('sweeteningProfile', settings.sweeteningProfile);
    await s.set('temperament', settings.temperament);
    await s.set('transpose', settings.transpose);
    await s.save();
    return;
  }

  writeLocal('a4', settings.a4.toString());
  writeLocal('activeInstrument', settings.activeInstrument);
  writeLocal('capo', settings.capo.toString());
  writeLocal('customTunings', JSON.stringify(settings.customTunings));
  writeLocal('displayMode', settings.displayMode);
  writeLocal('lastTuningId', settings.lastTuningId);
  writeLocal('metronomeBeats', settings.metronomeBeats.toString());
  writeLocal('metronomeBpm', settings.metronomeBpm.toString());
  writeLocal('metronomeSubdivision', settings.metronomeSubdivision.toString());
  writeLocal('selectedInputDeviceId', settings.selectedInputDeviceId);
  writeLocal('showSpectrum', settings.showSpectrum.toString());
  writeLocal('showWaveform', settings.showWaveform.toString());
  writeLocal('stringOffsets', JSON.stringify(settings.stringOffsets));
  writeLocal('sweeteningProfile', settings.sweeteningProfile);
  writeLocal('temperament', settings.temperament);
  writeLocal('transpose', settings.transpose.toString());
}
