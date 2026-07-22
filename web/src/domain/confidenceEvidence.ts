import type {
  PipelineCandidateTelemetry,
  PipelineConfidenceTelemetry,
  PipelineDecision,
} from './pipelineTelemetry';

const HISTORY_CAPACITY = 5;
const MAX_UNCERTAINTY_CENTS = 100;

export interface ConfidenceObservation {
  decision: PipelineDecision;
  noiseFloor: number;
  outputConfidence: number;
  rawFrequency: number | null;
  rms: number;
  secondary: PipelineCandidateTelemetry | null;
  yin: PipelineCandidateTelemetry | null;
}

export class ConfidenceEvidenceEstimator {
  private readonly history: number[] = [];
  private last = emptyEvidence();

  observe(observation: ConfidenceObservation): PipelineConfidenceTelemetry {
    if (observation.decision === 'held') {
      this.last = {
        ...this.last,
        calibrated: clamp01(this.last.calibrated * 0.94),
        stability: clamp01(this.last.stability * 0.92),
        uncertaintyCents: clamp(
          this.last.uncertaintyCents + 4,
          2,
          MAX_UNCERTAINTY_CENTS,
        ),
      };
      return { ...this.last };
    }

    // Rejected, pending, and acquiring frames must not present fresh
    // evidence: the raw detector output behind them was not published
    // (octave-pending frequencies are suspected wrong outright), so seeding
    // the jitter history with it would let the panel show a confident
    // readout that contradicts the frame's own decision.
    if (observation.decision !== 'published') {
      this.reset();
      return { ...this.last };
    }

    const frequency = observation.rawFrequency;
    if (!validFrequency(frequency)) {
      this.reset();
      return { ...this.last };
    }

    this.history.push(Math.log2(frequency));
    if (this.history.length > HISTORY_CAPACITY) this.history.shift();
    const temporalSpread = temporalSpreadCents(this.history);
    const stability = this.history.length === 1
      ? 0.72
      : clamp01(1 - temporalSpread / 45);
    const [agreement, detectorSpread] = detectorAgreement(
      observation.yin,
      observation.secondary,
    );
    const periodicity = clamp01(Math.max(
      observation.outputConfidence,
      observation.yin?.confidence ?? 0,
      observation.secondary?.confidence ?? 0,
    ));
    const signal = signalEvidence(observation.rms, observation.noiseFloor);
    const calibrated = clamp01(
      0.45 * periodicity
      + 0.20 * agreement
      + 0.20 * stability
      + 0.15 * signal,
    );
    const uncertaintyCents = clamp(
      2 + detectorSpread * 0.5 + temporalSpread + (1 - calibrated) * 18,
      2,
      MAX_UNCERTAINTY_CENTS,
    );

    this.last = {
      agreement,
      calibrated,
      periodicity,
      signal,
      stability,
      uncertaintyCents,
    };
    return { ...this.last };
  }

  reset() {
    this.history.length = 0;
    this.last = emptyEvidence();
  }
}

export function detectCompetingTarget(
  frequency: number | null,
  selectedTarget: number | null | undefined,
  tuningTargets: readonly number[],
) {
  if (!validFrequency(frequency) || !validFrequency(selectedTarget)) return null;
  if (octaveEquivalentDistanceCents(frequency, selectedTarget) < 180) return null;
  const candidates = tuningTargets
    .filter(validFrequency)
    .filter((target) => octaveEquivalentDistanceCents(target, selectedTarget) > 10)
    .map((target) => ({
      target,
      distance: octaveEquivalentDistanceCents(frequency, target),
    }))
    .sort((left, right) => left.distance - right.distance);
  const closest = candidates[0];
  if (!closest || closest.distance > 55) return null;
  return {
    candidateFrequency: frequency,
    competingTargetFrequency: closest.target,
    distanceCents: closest.distance,
    selectedTargetFrequency: selectedTarget,
  };
}

export function strongestCandidateFrequency(
  ...candidates: Array<PipelineCandidateTelemetry | null | undefined>
) {
  let strongest: PipelineCandidateTelemetry | null = null;
  for (const candidate of candidates) {
    if (!candidate || !validFrequency(candidate.frequency)) continue;
    if (!strongest || candidate.confidence > strongest.confidence) strongest = candidate;
  }
  return strongest?.frequency ?? null;
}

function detectorAgreement(
  yin: PipelineCandidateTelemetry | null,
  secondary: PipelineCandidateTelemetry | null,
): [number, number] {
  if (yin && secondary && validFrequency(yin.frequency) && validFrequency(secondary.frequency)) {
    const spread = Math.abs(1_200 * Math.log2(yin.frequency / secondary.frequency));
    return [clamp01(1 - spread / 70), Math.min(MAX_UNCERTAINTY_CENTS, spread)];
  }
  if (yin || secondary) return [0.68, 10];
  return [0, MAX_UNCERTAINTY_CENTS];
}

function temporalSpreadCents(values: number[]) {
  if (values.length < 2) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const median = sorted[Math.floor(sorted.length / 2)];
  const deviations = sorted
    .map((value) => Math.abs(value - median) * 1_200)
    .sort((left, right) => left - right);
  return deviations[Math.floor(deviations.length / 2)];
}

function signalEvidence(rms: number, noiseFloor: number) {
  if (!Number.isFinite(rms) || rms <= 0 || !Number.isFinite(noiseFloor) || noiseFloor <= 0) {
    return 0;
  }
  return clamp01((rms / noiseFloor - 1) / 3);
}

function emptyEvidence(): PipelineConfidenceTelemetry {
  return {
    agreement: 0,
    calibrated: 0,
    periodicity: 0,
    signal: 0,
    stability: 0,
    uncertaintyCents: 100,
  };
}

function octaveEquivalentDistanceCents(left: number, right: number) {
  const cents = 1_200 * Math.log2(left / right);
  return Math.abs(cents - Math.round(cents / 1_200) * 1_200);
}

function validFrequency(value: number | null | undefined): value is number {
  return Number.isFinite(value) && (value ?? 0) > 0;
}

function clamp01(value: number) {
  return clamp(value, 0, 1);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : minimum));
}
