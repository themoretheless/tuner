import musicRegistryJson from '../../../registry/music-registry.json';

export interface MusicRegistry {
  schemaVersion: number;
  noteNames: string[];
  instruments: Array<{
    id: string;
    name: string;
    defaultTuningId: string;
  }>;
  tunings: Array<{
    id: string;
    name: string;
    instrument: string;
    strings: Array<[string, number]>;
  }>;
}

export const MUSIC_REGISTRY = validateMusicRegistry(musicRegistryJson);

function validateMusicRegistry(value: unknown): MusicRegistry {
  const registry = value as MusicRegistry;
  if (registry?.schemaVersion !== 1) throw new Error('Unsupported music registry schema');
  if (!Array.isArray(registry.noteNames) || registry.noteNames.length !== 12) {
    throw new Error('Music registry must define 12 note names');
  }
  if (!Array.isArray(registry.instruments) || !Array.isArray(registry.tunings)) {
    throw new Error('Music registry must define instrument and tuning arrays');
  }

  const noteNames = unique(registry.noteNames, 'note');
  const instrumentIds = unique(registry.instruments.map((instrument) => instrument.id), 'instrument');
  const tuningIds = unique(registry.tunings.map((tuning) => tuning.id), 'tuning');

  for (const instrument of registry.instruments) {
    if (instrument.defaultTuningId !== 'chromatic' && !tuningIds.has(instrument.defaultTuningId)) {
      throw new Error(`Instrument ${instrument.id} references missing tuning ${instrument.defaultTuningId}`);
    }
  }

  for (const tuning of registry.tunings) {
    if (!instrumentIds.has(tuning.instrument)) {
      throw new Error(`Tuning ${tuning.id} references missing instrument ${tuning.instrument}`);
    }
    if (!Array.isArray(tuning.strings)) {
      throw new Error(`Tuning ${tuning.id} must define a strings array`);
    }
    for (const [name, octave] of tuning.strings) {
      if (!noteNames.has(name) || !Number.isInteger(octave)) {
        throw new Error(`Tuning ${tuning.id} contains invalid note ${name}${octave}`);
      }
    }
  }

  return registry;
}

function unique(values: string[], kind: string) {
  const result = new Set<string>();
  for (const value of values) {
    if (!value || result.has(value)) throw new Error(`Duplicate or empty ${kind} id ${value}`);
    result.add(value);
  }
  return result;
}
