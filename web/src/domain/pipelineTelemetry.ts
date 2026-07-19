export const PIPELINE_ARBITRATIONS = [
  'none',
  'yin-only',
  'secondary-only',
  'fused',
  'guided-yin',
  'guided-secondary',
  'confidence-yin',
  'confidence-secondary',
  'rejected-disagreement',
  'harmonic-rescue',
] as const;

export const PIPELINE_DECISIONS = [
  'no-candidate',
  'fixed-gate-rejected',
  'below-confidence',
  'target-rejected',
  'octave-pending',
  'adaptive-gate-rejected',
  'tracking-acquiring',
  'held',
  'published',
] as const;

export type PipelineArbitration = typeof PIPELINE_ARBITRATIONS[number];
export type PipelineDecision = typeof PIPELINE_DECISIONS[number];

export interface PipelineCandidateTelemetry {
  confidence: number;
  frequency: number;
}

export interface PipelineSpectralTelemetry {
  activeOctave: -1 | 0 | 1;
  baseFrequency: number;
  harmonics: [number, number, number, number, number];
  octaveScores: [number, number, number];
  pendingOctave: -1 | 0 | 1;
}

export interface PipelineConfidenceTelemetry {
  agreement: number;
  calibrated: number;
  periodicity: number;
  signal: number;
  stability: number;
  uncertaintyCents: number;
}

export interface PipelineInterferenceTelemetry {
  candidateFrequency: number;
  competingTargetFrequency: number;
  distanceCents: number;
  selectedTargetFrequency: number;
}

export interface PipelineTelemetry {
  adaptiveGateOpen: boolean;
  arbitration: PipelineArbitration;
  confidence: PipelineConfidenceTelemetry;
  configFingerprint: number;
  decision: PipelineDecision;
  fixedGateOpen: boolean;
  gateThreshold: number;
  held: boolean;
  interference: PipelineInterferenceTelemetry | null;
  noiseFloor: number;
  processingMs: number;
  roundTripMs: number;
  sampleRate: number;
  secondary: PipelineCandidateTelemetry | null;
  selected: PipelineCandidateTelemetry | null;
  spectral: PipelineSpectralTelemetry | null;
  tracked: boolean;
  windowSamples: number;
  yin: PipelineCandidateTelemetry | null;
}

export function createPipelineTelemetry(
  input: Partial<PipelineTelemetry> = {},
): PipelineTelemetry {
  return {
    adaptiveGateOpen: Boolean(input.adaptiveGateOpen),
    arbitration: includes(PIPELINE_ARBITRATIONS, input.arbitration)
      ? input.arbitration
      : 'none',
    confidence: normalizeConfidenceEvidence(input.confidence),
    configFingerprint: normalizeFingerprint(input.configFingerprint),
    decision: includes(PIPELINE_DECISIONS, input.decision)
      ? input.decision
      : 'no-candidate',
    fixedGateOpen: Boolean(input.fixedGateOpen),
    gateThreshold: nonNegativeFinite(input.gateThreshold),
    held: Boolean(input.held),
    interference: normalizeInterference(input.interference),
    noiseFloor: nonNegativeFinite(input.noiseFloor),
    processingMs: nonNegativeFinite(input.processingMs),
    roundTripMs: nonNegativeFinite(input.roundTripMs),
    sampleRate: nonNegativeFinite(input.sampleRate),
    secondary: normalizeCandidate(input.secondary),
    selected: normalizeCandidate(input.selected),
    spectral: normalizeSpectral(input.spectral),
    tracked: Boolean(input.tracked),
    windowSamples: normalizeWindowSamples(input.windowSamples),
    yin: normalizeCandidate(input.yin),
  };
}

function normalizeInterference(value: unknown): PipelineInterferenceTelemetry | null {
  if (!value || typeof value !== 'object') return null;
  const interference = value as Partial<PipelineInterferenceTelemetry>;
  const candidateFrequency = Number(interference.candidateFrequency);
  const competingTargetFrequency = Number(interference.competingTargetFrequency);
  const selectedTargetFrequency = Number(interference.selectedTargetFrequency);
  if (
    candidateFrequency <= 0
    || competingTargetFrequency <= 0
    || selectedTargetFrequency <= 0
    || ![candidateFrequency, competingTargetFrequency, selectedTargetFrequency].every(Number.isFinite)
  ) return null;
  return {
    candidateFrequency,
    competingTargetFrequency,
    distanceCents: Math.min(100, nonNegativeFinite(interference.distanceCents)),
    selectedTargetFrequency,
  };
}

function normalizeConfidenceEvidence(value: unknown): PipelineConfidenceTelemetry {
  if (!value || typeof value !== 'object') {
    return {
      agreement: 0,
      calibrated: 0,
      periodicity: 0,
      signal: 0,
      stability: 0,
      uncertaintyCents: 100,
    };
  }
  const evidence = value as Partial<PipelineConfidenceTelemetry>;
  return {
    agreement: clamp01(evidence.agreement),
    calibrated: clamp01(evidence.calibrated),
    periodicity: clamp01(evidence.periodicity),
    signal: clamp01(evidence.signal),
    stability: clamp01(evidence.stability),
    uncertaintyCents: normalizeUncertainty(evidence.uncertaintyCents),
  };
}

function normalizeFingerprint(value: unknown) {
  const fingerprint = Number(value);
  return Number.isSafeInteger(fingerprint) && fingerprint >= 0
    ? Math.min(0xffff_ffff, fingerprint)
    : 0;
}

function normalizeUncertainty(value: unknown) {
  const uncertainty = Number(value);
  return Number.isFinite(uncertainty)
    ? Math.min(100, Math.max(0, uncertainty))
    : 100;
}

export function normalizePipelineTelemetry(value: unknown): PipelineTelemetry {
  if (!value || typeof value !== 'object') return createPipelineTelemetry();
  return createPipelineTelemetry(value as Partial<PipelineTelemetry>);
}

function normalizeCandidate(value: unknown): PipelineCandidateTelemetry | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<PipelineCandidateTelemetry>;
  const confidence = Number(candidate.confidence);
  const frequency = Number(candidate.frequency);
  if (!Number.isFinite(frequency) || frequency <= 0) return null;
  return {
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0,
    frequency,
  };
}

function normalizeSpectral(value: unknown): PipelineSpectralTelemetry | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<PipelineSpectralTelemetry>;
  const baseFrequency = Number(candidate.baseFrequency);
  if (!Number.isFinite(baseFrequency) || baseFrequency <= 0) return null;
  return {
    activeOctave: normalizeOctave(candidate.activeOctave),
    baseFrequency,
    harmonics: normalizeStrengths(candidate.harmonics, 5),
    octaveScores: normalizeStrengths(candidate.octaveScores, 3),
    pendingOctave: normalizeOctave(candidate.pendingOctave),
  };
}

function normalizeStrengths(value: unknown, length: 5): [number, number, number, number, number];
function normalizeStrengths(value: unknown, length: 3): [number, number, number];
function normalizeStrengths(value: unknown, length: number): number[] {
  const input = Array.isArray(value) ? value : [];
  return Array.from({ length }, (_, index) => clamp01(input[index]));
}

function normalizeOctave(value: unknown): -1 | 0 | 1 {
  const number = Number(value);
  return number === -1 || number === 1 ? number : 0;
}

function normalizeWindowSamples(value: unknown) {
  const samples = Math.trunc(nonNegativeFinite(value));
  return Math.min(samples, 1_048_576);
}

function nonNegativeFinite(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function clamp01(value: unknown) {
  return Math.max(0, Math.min(1, nonNegativeFinite(value)));
}

function includes<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && values.includes(value as T);
}
