import {
  NOTE_NAMES,
  noteWithA4,
  type InstrumentId,
  type Note,
  type Tuning,
} from './notes';

export const TUNING_TRANSFER_VERSION = 1;
const MAX_TUNINGS = 256;
const MAX_STRINGS = 24;
const MAX_TEXT_LENGTH = 80;

export interface TuningTransferDocument {
  version: typeof TUNING_TRANSFER_VERSION;
  exportedAt: string;
  tunings: Tuning[];
}

export interface TuningImportResult {
  rejected: number;
  tunings: Tuning[];
}

export function createTuningTransferDocument(tunings: readonly Tuning[]): TuningTransferDocument {
  return {
    version: TUNING_TRANSFER_VERSION,
    exportedAt: new Date().toISOString(),
    tunings: tunings.map((tuning) => ({
      id: tuning.id,
      name: tuning.name,
      strings: tuning.strings.map((note) => ({ ...note })),
      ...(tuning.instrument ? { instrument: tuning.instrument } : {}),
      kind: 'custom',
    })),
  };
}

export function parseTuningTransfer(
  input: unknown,
  fallbackInstrument: InstrumentId,
  idPrefix = `custom-import-${Date.now().toString(36)}`,
): TuningImportResult {
  const rawTunings = unwrapTunings(input);
  const tunings: Tuning[] = [];
  const ids = new Set<string>();
  let rejected = Math.max(0, rawTunings.length - MAX_TUNINGS);

  for (const [index, value] of rawTunings.slice(0, MAX_TUNINGS).entries()) {
    const tuning = normalizeImportedTuning(value, fallbackInstrument, `${idPrefix}-${index}`);
    if (!tuning) {
      rejected += 1;
      continue;
    }

    let uniqueId = tuning.id;
    let suffix = 2;
    while (ids.has(uniqueId)) {
      uniqueId = `${tuning.id}-${suffix}`;
      suffix += 1;
    }
    ids.add(uniqueId);
    tunings.push({ ...tuning, id: uniqueId });
  }

  return { rejected, tunings };
}

function unwrapTunings(input: unknown): unknown[] {
  if (Array.isArray(input)) return input;
  if (!isRecord(input)) throw new Error('Invalid tuning file');

  const version = input.version;
  if (!Number.isInteger(version) || version !== TUNING_TRANSFER_VERSION) {
    throw new Error(`Unsupported tuning file version: ${String(version)}`);
  }
  if (!Array.isArray(input.tunings)) throw new Error('Invalid tuning list');
  return input.tunings;
}

function normalizeImportedTuning(
  input: unknown,
  fallbackInstrument: InstrumentId,
  fallbackId: string,
): Tuning | null {
  if (!isRecord(input) || typeof input.name !== 'string' || !Array.isArray(input.strings)) {
    return null;
  }
  if (input.strings.length === 0 || input.strings.length > MAX_STRINGS) return null;

  const strings: Note[] = [];
  for (const value of input.strings) {
    const note = normalizeImportedNote(value);
    if (!note) return null;
    strings.push(note);
  }

  const rawName = input.name.trim().slice(0, MAX_TEXT_LENGTH);
  const rawId = typeof input.id === 'string' ? input.id.trim().slice(0, MAX_TEXT_LENGTH) : '';
  const instrument = typeof input.instrument === 'string' && input.instrument.trim()
    ? input.instrument.trim().slice(0, MAX_TEXT_LENGTH)
    : fallbackInstrument;

  return {
    id: sanitizeId(rawId) || sanitizeId(fallbackId) || 'custom-import',
    name: rawName || 'Imported tuning',
    strings,
    instrument,
    kind: 'custom',
  };
}

function normalizeImportedNote(input: unknown): Note | null {
  if (!isRecord(input) || !NOTE_NAMES.includes(input.name as Note['name'])) return null;
  const octave = Number(input.octave);
  if (!Number.isInteger(octave) || octave < 0 || octave > 8) return null;
  return noteWithA4({ name: input.name as Note['name'], octave }, 440);
}

function sanitizeId(value: string) {
  return value
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_TEXT_LENGTH);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
