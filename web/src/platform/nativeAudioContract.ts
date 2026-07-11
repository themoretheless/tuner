import { createDefaultFrameContext } from '../domain/frameContext';
import type { DetectionFrame, FrameContext } from '../types/frames';
import { NOTE_NAMES, type Note, type NoteName } from '../utils/notes';
import {
  DEFAULT_PITCH_DETECTION_RANGE,
  type PitchDetectionRange,
} from '../utils/pitch';

export interface NativeAudioFramePayload {
  cents?: unknown;
  confidence?: unknown;
  freq?: unknown;
  inTune?: unknown;
  isPower?: unknown;
  level?: unknown;
  note?: unknown;
  rms?: unknown;
  target?: unknown;
}

export interface NativeAudioConfiguration {
  context: FrameContext;
  range: PitchDetectionRange;
}

export function createNativeAudioConfiguration(): NativeAudioConfiguration {
  return {
    context: createDefaultFrameContext(),
    range: { ...DEFAULT_PITCH_DETECTION_RANGE },
  };
}

export function withNativeAudioRange(
  configuration: NativeAudioConfiguration,
  range: PitchDetectionRange,
): NativeAudioConfiguration {
  return {
    ...configuration,
    range: { ...range },
  };
}

export function withNativeFrameContext(
  configuration: NativeAudioConfiguration,
  context: FrameContext,
): NativeAudioConfiguration {
  return { ...configuration, context };
}

export function cloneNativeAudioConfiguration(
  configuration: NativeAudioConfiguration,
): NativeAudioConfiguration {
  return {
    context: {
      ...configuration.context,
      displayTargets: configuration.context.displayTargets.map(copyNote),
      idleTarget: configuration.context.idleTarget && copyNote(configuration.context.idleTarget),
      selectedTarget: configuration.context.selectedTarget && copyNote(configuration.context.selectedTarget),
      tuningTargets: configuration.context.tuningTargets.map(copyNote),
    },
    range: { ...configuration.range },
  };
}

export function normalizeNativeFrame(payload: NativeAudioFramePayload = {}): DetectionFrame {
  const rawFrequency = Number(payload.freq);
  const freq = Number.isFinite(rawFrequency) && rawFrequency > 0 ? rawFrequency : null;
  return {
    freq,
    confidence: clamp01(finiteNumber(payload.confidence)),
    rms: Math.max(0, finiteNumber(payload.rms)),
    level: clamp01(finiteNumber(payload.level)),
    cents: finiteNumber(payload.cents),
    note: typeof payload.note === 'string' ? payload.note : '—',
    target: normalizeNote(payload.target),
    inTune: Boolean(payload.inTune),
    isPower: Boolean(payload.isPower),
  };
}

function normalizeNote(value: unknown): Note | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<Record<keyof Note, unknown>>;
  const frequency = Number(candidate.frequency);
  const octave = Number(candidate.octave);
  const name = candidate.name;
  if (
    typeof name !== 'string'
    || !NOTE_NAMES.includes(name as NoteName)
    || !Number.isInteger(octave)
    || octave < -1
    || octave > 10
    || !Number.isFinite(frequency)
    || frequency <= 0
  ) return null;
  return { frequency, name: name as NoteName, octave };
}

function copyNote(note: Note): Note {
  return { ...note };
}

function finiteNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}
