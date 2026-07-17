import type { DetectionFrame } from '../types/frames';
import {
  createPipelineTelemetry,
  type PipelineTelemetry,
} from './pipelineTelemetry';

interface UnresolvedDetectionInput {
  confidence?: number;
  freq?: number | null;
  rawFreq?: number | null;
  level?: number;
  rms?: number;
  pipeline?: Partial<PipelineTelemetry>;
}

export function createUnresolvedDetectionFrame(
  input: UnresolvedDetectionInput = {},
): DetectionFrame {
  const freq = positiveFiniteOrNull(input.freq);
  return {
    freq,
    rawFreq: positiveFiniteOrNull(input.rawFreq),
    confidence: freq == null ? 0 : clampConfidence(input.confidence ?? 0),
    rms: nonNegativeFinite(input.rms),
    level: clamp01(input.level),
    cents: 0,
    note: '\u2014',
    target: null,
    inTune: false,
    isPower: false,
    pipeline: createPipelineTelemetry(input.pipeline),
  };
}

export function clampConfidence(value: unknown): number {
  return clamp01(value);
}

export function finiteOr(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function positiveFiniteOrNull(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function nonNegativeFinite(value: unknown): number {
  return Math.max(0, finiteOr(value));
}

function clamp01(value: unknown): number {
  return Math.max(0, Math.min(1, finiteOr(value)));
}
