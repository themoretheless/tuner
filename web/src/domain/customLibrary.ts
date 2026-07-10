import {
  NOTE_NAMES,
  TUNINGS,
  normalizeTemperamentOffsets,
  noteWithA4,
  type InstrumentId,
  type InstrumentPreset,
  type Note,
  type Temperament,
  type Tuning,
} from '../utils/notes';

export interface CustomTuningPayload {
  id?: string | null;
  name: string;
  strings: Note[];
}

export interface CustomTemperamentPayload {
  id?: string | null;
  name: string;
  offsets: number[];
}

export function createCustomTuning(
  payload: CustomTuningPayload,
  instrument: InstrumentId,
  now = Date.now(),
): Tuning {
  return {
    id: payload.id || `custom-${now.toString(36)}`,
    name: payload.name.trim() || 'Custom tuning',
    strings: payload.strings.map((string) => noteWithA4(string, 440)),
    instrument,
    kind: 'custom',
  };
}

export function createInstrumentProfile(
  name: string,
  strings: Note[],
  now = Date.now(),
): { profile: InstrumentPreset; tuning: Tuning } | null {
  if (!strings.length) return null;
  const profileName = name.trim() || 'Custom instrument';
  const id = `instrument-${now.toString(36)}`;
  const tuningId = `${id}-default`;
  return {
    profile: {
      id,
      name: profileName,
      defaultTuningId: tuningId,
      custom: true,
    },
    tuning: {
      id: tuningId,
      name: `${profileName} Default`,
      strings: strings.map((string) => noteWithA4(string, 440)),
      instrument: id,
      kind: 'custom',
    },
  };
}

export function createCustomTemperament(
  payload: CustomTemperamentPayload,
  now = Date.now(),
): Temperament {
  return {
    id: payload.id || `temperament-${now.toString(36)}`,
    name: payload.name.trim() || 'Custom temperament',
    offsets: normalizeTemperamentOffsets(payload.offsets),
    custom: true,
  };
}

export function normalizeImportedTunings(
  tunings: Tuning[],
  instrument: InstrumentId,
  now = Date.now(),
  validInstrumentIds: ReadonlySet<InstrumentId> = new Set([instrument]),
) {
  const usedIds = new Set(TUNINGS.map((tuning) => tuning.id));
  return tunings
    .filter((tuning) => tuning && typeof tuning.name === 'string' && Array.isArray(tuning.strings))
    .map((tuning, index) => {
      const strings = tuning.strings
        .filter((string) => NOTE_NAMES.includes(string.name) && Number.isFinite(Number(string.octave)))
        .map((string) => noteWithA4(string, 440))
        .slice(0, 128);
      const requestedId = typeof tuning.id === 'string' ? tuning.id.trim().slice(0, 120) : '';
      let id = requestedId && !usedIds.has(requestedId)
        ? requestedId
        : `custom-import-${now.toString(36)}-${index}`;
      while (usedIds.has(id)) id = `${id}-copy`;
      usedIds.add(id);
      const requestedInstrument = typeof tuning.instrument === 'string'
        ? tuning.instrument.trim().slice(0, 120)
        : '';
      return {
        id,
        name: tuning.name.trim().slice(0, 120) || `Imported ${index + 1}`,
        strings,
        instrument: validInstrumentIds.has(requestedInstrument) ? requestedInstrument : instrument,
        kind: 'custom' as const,
      };
    })
    .filter((tuning) => tuning.strings.length > 0)
    .slice(0, 200);
}
