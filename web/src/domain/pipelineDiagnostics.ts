import {
  createPipelineTelemetry,
  type PipelineDecision,
  type PipelineTelemetry,
} from './pipelineTelemetry';
import {
  normalizePipelineConfig,
  type PipelineBlockId,
  type PipelineConfig,
  type ResolvedPipelinePresetId,
} from './pipelineConfig';
import type { DetectionFrame } from '../types/frames';

export type PipelineRuntimeBackend = 'typescript' | 'wasm';
export type DiagnosticBypass =
  | 'adaptiveGateEnabled'
  | 'fixedGateEnabled'
  | 'harmonicEnabled'
  | 'holdEnabled'
  | 'octaveEnabled'
  | 'secondaryDetectorEnabled'
  | 'trackingEnabled';

export interface PipelineDiagnosticSample {
  at: number;
  backend: PipelineRuntimeBackend;
  cadenceMs: number;
  config: PipelineConfig;
  frame: DetectionFrame;
  id: number;
  preset: ResolvedPipelinePresetId;
  rawCents: number | null;
  stableCents: number | null;
  targetFrequency: number;
  uncertaintyCents: number;
}

export interface PipelineDiagnosticContext {
  backend: PipelineRuntimeBackend;
  config: PipelineConfig;
  frame: DetectionFrame;
  id: number;
  now: number;
  preset: ResolvedPipelinePresetId;
  previousAt?: number;
  targetFrequency: number;
}

export interface OctaveHypothesis {
  frequency: number;
  score: number;
  shift: -1 | 0 | 1;
  state: 'active' | 'candidate' | 'pending';
}

export interface PipelineComparison {
  confidenceDelta: number;
  configChanges: PipelineBlockId[];
  decisionChanged: boolean;
  frequencyDelta: number | null;
  stableCentsDelta: number | null;
}

export interface WhatIfResult {
  decision: PipelineDecision | null;
  frequency: number | null;
  kind: 'changed' | 'same' | 'unavailable';
  reason: string;
}

export const DIAGNOSTIC_BYPASSES: readonly DiagnosticBypass[] = [
  'fixedGateEnabled',
  'adaptiveGateEnabled',
  'secondaryDetectorEnabled',
  'harmonicEnabled',
  'octaveEnabled',
  'trackingEnabled',
  'holdEnabled',
];

export function createPipelineDiagnosticSample(
  context: PipelineDiagnosticContext,
): PipelineDiagnosticSample {
  const targetFrequency = validFrequency(context.frame.target?.frequency)
    ? context.frame.target!.frequency
    : context.targetFrequency;
  const frame = cloneDetectionFrame(context.frame);
  return {
    at: context.now,
    backend: context.backend,
    cadenceMs: context.previousAt == null ? 0 : Math.max(0, context.now - context.previousAt),
    config: normalizePipelineConfig(context.config),
    frame,
    id: context.id,
    preset: context.preset,
    rawCents: centsFromFrequency(frame.rawFreq, targetFrequency),
    stableCents: centsFromFrequency(frame.freq, targetFrequency),
    targetFrequency,
    uncertaintyCents: estimateUncertainty(frame.pipeline),
  };
}

export function cloneDiagnosticSample(sample: PipelineDiagnosticSample) {
  return createPipelineDiagnosticSample({
    backend: sample.backend,
    config: sample.config,
    frame: sample.frame,
    id: sample.id,
    now: sample.at,
    preset: sample.preset,
    previousAt: sample.at - sample.cadenceMs,
    targetFrequency: sample.targetFrequency,
  });
}

export function octaveHypotheses(sample: PipelineDiagnosticSample | null): OctaveHypothesis[] {
  const evidence = sample?.frame.pipeline.spectral;
  if (!evidence) return [];
  return ([-1, 0, 1] as const).map((shift, index) => ({
    frequency: evidence.baseFrequency * 2 ** shift,
    score: evidence.octaveScores[index],
    shift,
    state: evidence.pendingOctave === shift && shift !== 0
      ? 'pending'
      : evidence.activeOctave === shift
        ? 'active'
        : 'candidate',
  }));
}

export function compareDiagnosticSamples(
  current: PipelineDiagnosticSample | null,
  baseline: PipelineDiagnosticSample | null,
): PipelineComparison | null {
  if (!current || !baseline) return null;
  return {
    confidenceDelta: current.frame.confidence - baseline.frame.confidence,
    configChanges: (Object.keys(current.config) as PipelineBlockId[])
      .filter((key) => current.config[key] !== baseline.config[key]),
    decisionChanged: current.frame.pipeline.decision !== baseline.frame.pipeline.decision,
    frequencyDelta: nullableDelta(current.frame.freq, baseline.frame.freq),
    stableCentsDelta: nullableDelta(current.stableCents, baseline.stableCents),
  };
}

export function simulatePipelineBypass(
  sample: PipelineDiagnosticSample | null,
  bypass: DiagnosticBypass,
): WhatIfResult {
  if (!sample) return unavailable('no-frame');
  const { frame } = sample;
  const telemetry = frame.pipeline;
  if (!sample.config[bypass]) {
    return same(frame, 'already-disabled');
  }

  switch (bypass) {
    case 'fixedGateEnabled':
      return telemetry.decision === 'fixed-gate-rejected'
        ? unavailable('detectors-skipped')
        : same(frame, 'gate-passed');
    case 'adaptiveGateEnabled':
      if (telemetry.adaptiveGateOpen) return same(frame, 'gate-passed');
      return telemetry.selected
        ? unavailable('downstream-replay-required')
        : unavailable('no-candidate');
    case 'secondaryDetectorEnabled':
      if (!telemetry.secondary) return same(frame, 'secondary-unused');
      if (!telemetry.yin) return unavailable('yin-missing');
      return unavailable('downstream-replay-required');
    case 'harmonicEnabled':
      return telemetry.arbitration === 'harmonic-rescue'
        ? unavailable('pre-rescue-not-captured')
        : same(frame, 'harmonic-unused');
    case 'octaveEnabled': {
      const evidence = telemetry.spectral;
      if (!evidence) return unavailable('spectral-missing');
      if (evidence.activeOctave === 0 && evidence.pendingOctave === 0) {
        return same(frame, 'octave-unchanged');
      }
      return unavailable('downstream-replay-required');
    }
    case 'trackingEnabled': {
      if (sample.config.adaptiveGateEnabled && !telemetry.adaptiveGateOpen) {
        return same(frame, 'blocked-by-adaptive-gate');
      }
      return telemetry.selected
        ? changed(telemetry.selected.frequency, 'published', 'candidate-published-directly')
        : unavailable('no-candidate');
    }
    case 'holdEnabled':
      return telemetry.held
        ? changed(null, 'no-candidate', 'held-reading-cleared')
        : same(frame, 'hold-unused');
  }
}

export function analysisWindowMs(telemetry: PipelineTelemetry) {
  return telemetry.sampleRate > 0 && telemetry.windowSamples > 0
    ? (telemetry.windowSamples / telemetry.sampleRate) * 1_000
    : 0;
}

export function estimateUncertainty(telemetry: PipelineTelemetry) {
  if (telemetry.confidence.calibrated > 0 || telemetry.confidence.periodicity > 0) {
    return telemetry.confidence.uncertaintyCents;
  }
  const candidates = [telemetry.yin, telemetry.secondary]
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate != null);
  const spread = candidates.length === 2
    ? Math.abs(1_200 * Math.log2(candidates[0].frequency / candidates[1].frequency)) * 0.5
    : 0;
  const confidence = telemetry.selected?.confidence
    ?? Math.max(0, ...candidates.map((candidate) => candidate.confidence));
  const confidencePenalty = (1 - confidence) * 30;
  const rejectionPenalty = telemetry.arbitration === 'rejected-disagreement' ? 55 : 0;
  return Math.min(100, Math.max(2, spread + confidencePenalty + rejectionPenalty));
}

export function centsFromFrequency(frequency: number | null, target: number) {
  if (!validFrequency(frequency) || !validFrequency(target)) return null;
  return 1_200 * Math.log2(frequency / target);
}

function cloneDetectionFrame(frame: DetectionFrame): DetectionFrame {
  return {
    ...frame,
    pipeline: createPipelineTelemetry(frame.pipeline),
    target: frame.target ? { ...frame.target } : null,
  };
}

function unavailable(reason: string): WhatIfResult {
  return { decision: null, frequency: null, kind: 'unavailable', reason };
}

function same(frame: DetectionFrame, reason: string): WhatIfResult {
  return { decision: frame.pipeline.decision, frequency: frame.freq, kind: 'same', reason };
}

function changed(
  frequency: number | null,
  decision: PipelineDecision,
  reason: string,
): WhatIfResult {
  return { decision, frequency, kind: 'changed', reason };
}

function nullableDelta(left: number | null, right: number | null) {
  return left == null || right == null ? null : left - right;
}

function validFrequency(value: number | null | undefined): value is number {
  return Number.isFinite(value) && (value ?? 0) > 0;
}
