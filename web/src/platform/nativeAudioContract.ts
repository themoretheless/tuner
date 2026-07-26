import {
  isDiagnosticCode,
  type DiagnosticCode,
} from '../domain/diagnostics';
import { createDefaultFrameContext } from '../domain/frameContext';
import {
  createDefaultPipelineConfig,
  normalizePipelineConfig,
  type PipelineConfig,
} from '../domain/pipelineConfig';
import type { DetectionFrame, FrameContext } from '../types/frames';
import { normalizePipelineTelemetry } from '../domain/pipelineTelemetry';
import { NOTE_NAMES, type Note, type NoteName } from '../utils/notes';
import {
  DEFAULT_PITCH_DETECTION_RANGE,
  type PitchDetectionRange,
} from '../utils/pitch';

export const NATIVE_AUDIO_FRAME_EVENT = 'native-audio-frame';
export const NATIVE_AUDIO_ERROR_EVENT = 'native-audio-error';
export const NATIVE_AUDIO_RECOVERY_EVENT = 'native-audio-recovery';

export interface NativeAudioErrorPayload {
  message?: unknown;
  /** Optional stable diagnostic code for typed failures. */
  code?: unknown;
}

export interface NativeAudioRecoveryPayload {
  code?: unknown;
  reason?: unknown;
  attempt?: unknown;
  maxAttempts?: unknown;
}

export interface NativeAudioRecovery {
  code: DiagnosticCode;
  reason: string | null;
  attempt: number | null;
  maxAttempts: number | null;
}

export interface NativeAudioFramePayload {
  cents?: unknown;
  confidence?: unknown;
  freq?: unknown;
  inTune?: unknown;
  isPower?: unknown;
  level?: unknown;
  note?: unknown;
  pipeline?: unknown;
  rawFreq?: unknown;
  rms?: unknown;
  /** Stable signal-quality diagnostic codes computed natively
   * (desktop/src-tauri/src/native_audio/signal_health.rs). */
  signal?: unknown;
  target?: unknown;
}

export interface NativeAudioConfiguration {
  context: FrameContext;
  pipeline: PipelineConfig;
  range: PitchDetectionRange;
}

export interface NativeAudioError {
  message: string;
  code: DiagnosticCode | null;
}

export function normalizeNativeAudioError(payload: NativeAudioErrorPayload = {}): NativeAudioError {
  return {
    message: typeof payload.message === 'string' && payload.message.trim()
      ? payload.message
      : 'Native audio stream failed',
    code: isDiagnosticCode(payload.code) ? payload.code : null,
  };
}

export function normalizeNativeAudioRecovery(
  payload: NativeAudioRecoveryPayload = {},
): NativeAudioRecovery | null {
  if (!isDiagnosticCode(payload.code)) return null;
  return {
    code: payload.code,
    reason: typeof payload.reason === 'string' && payload.reason.trim()
      ? payload.reason
      : null,
    attempt: positiveInteger(payload.attempt),
    maxAttempts: positiveInteger(payload.maxAttempts),
  };
}

function positiveInteger(value: unknown): number | null {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export function createNativeAudioConfiguration(): NativeAudioConfiguration {
  return {
    context: createDefaultFrameContext(),
    pipeline: createDefaultPipelineConfig(),
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

export function withNativePipelineConfig(
  configuration: NativeAudioConfiguration,
  pipeline: PipelineConfig,
): NativeAudioConfiguration {
  return { ...configuration, pipeline: normalizePipelineConfig(pipeline) };
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
    pipeline: { ...configuration.pipeline },
    range: { ...configuration.range },
  };
}

export function normalizeNativeFrame(payload: NativeAudioFramePayload = {}): DetectionFrame {
  const rawFrequency = Number(payload.freq);
  const freq = Number.isFinite(rawFrequency) && rawFrequency > 0 ? rawFrequency : null;
  return {
    freq,
    rawFreq: positiveFrequency(payload.rawFreq),
    confidence: clamp01(finiteNumber(payload.confidence)),
    rms: Math.max(0, finiteNumber(payload.rms)),
    level: clamp01(finiteNumber(payload.level)),
    cents: finiteNumber(payload.cents),
    note: typeof payload.note === 'string' ? payload.note : '—',
    target: normalizeNote(payload.target),
    inTune: Boolean(payload.inTune),
    isPower: Boolean(payload.isPower),
    pipeline: normalizePipelineTelemetry(payload.pipeline),
  };
}

function positiveFrequency(value: unknown) {
  const frequency = Number(value);
  return Number.isFinite(frequency) && frequency > 0 ? frequency : null;
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
