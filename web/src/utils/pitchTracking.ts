import type { FrameContext } from '../types/frames';
import type { PipelineDecision } from '../domain/pipelineTelemetry';
import {
  createDefaultPipelineConfig,
  normalizePipelineConfig,
  pipelineConfigsEqual,
  type PipelineConfig,
} from '../domain/pipelineConfig';
import { GATE_THRESHOLDS } from '../generated/gateThresholds';
import {
  normalizePitchDetectionRange,
  type PitchDetectionRange,
  type PitchEstimate,
  type SignalStats,
} from './pitch';

// Canonical gate values come from the Rust core via generated/gateThresholds.ts
// (scripts/generate-gate-thresholds.mjs); do not reintroduce local literals.
const ADAPTIVE = GATE_THRESHOLDS.adaptive;
const BASE_RMS = GATE_THRESHOLDS.rmsGate;
const BASE_PEAK = GATE_THRESHOLDS.peakGate;
const ACQUIRE_FRAMES = 2;
const ACQUIRE_CENTS = 45;
const INLIER_CENTS = 85;
const CHANGE_FRAMES = 3;
const OCTAVE_CHANGE_FRAMES = 7;
const PENDING_CENTS = 55;
const HOLD_FRAMES = 6;
const SELECTED_TARGET_LIMIT_CENTS = 350;
const TUNING_TARGET_LIMIT_CENTS = 450;

/** Stateful fallback for browsers where the shared WASM processor cannot load. */
export class StreamingPitchTracker {
  private belowGateFrames = 0;
  private calibratedFrames = 0;
  private contextKey = '';
  private gateOpen = false;
  private history: number[] = [];
  private lastAdaptiveGateOpen = false;
  private lastDecision: PipelineDecision = 'no-candidate';
  private lastSelected: PitchEstimate | null = null;
  private maxFrequency = 1_200;
  private minFrequency = 24;
  private missingFrames = 0;
  private noiseFloor: number = BASE_RMS;
  private pipelineConfig = createDefaultPipelineConfig();
  private pendingConfidence = 0;
  private pendingLog: number | null = null;
  private pendingStreak = 0;
  private previousRms = 0;
  private selectedTarget: number | null = null;
  private stableConfidence = 0;
  private stableLog: number | null = null;
  private targets: number[] = [];
  private unstableFrames = 0;

  setContext(context: FrameContext) {
    const selected = validFrequency(context.selectedTarget?.frequency)
      ? context.selectedTarget!.frequency
      : null;
    const targets = context.tuningTargets
      .map((target) => target.frequency)
      .filter(validFrequency)
      .sort((left, right) => left - right);
    const key = `${selected ?? ''}|${targets.map((value) => value.toFixed(3)).join(',')}`;
    if (key === this.contextKey) return;
    this.contextKey = key;
    this.selectedTarget = selected;
    this.targets = targets;
    this.reset();
  }

  setPipelineConfig(config: PipelineConfig) {
    const normalized = normalizePipelineConfig(config);
    if (pipelineConfigsEqual(this.pipelineConfig, normalized)) return;
    this.pipelineConfig = normalized;
    this.reset();
  }

  setDetectionRange(range: PitchDetectionRange) {
    const normalized = normalizePitchDetectionRange(range);
    if (
      normalized.minFrequency === this.minFrequency
      && normalized.maxFrequency === this.maxFrequency
    ) return;
    this.minFrequency = normalized.minFrequency;
    this.maxFrequency = normalized.maxFrequency;
    this.reset();
  }

  update(estimate: PitchEstimate | null, stats: SignalStats): PitchEstimate | null {
    const resolvedEstimate = this.resolveEstimate(estimate);
    this.lastSelected = resolvedEstimate;
    const gateOpen = !this.pipelineConfig.adaptiveGateEnabled
      || this.observeGate(stats, resolvedEstimate);
    this.lastAdaptiveGateOpen = gateOpen;
    if (!gateOpen) {
      this.lastDecision = 'adaptive-gate-rejected';
      this.resetTrack();
      return null;
    }
    if (!resolvedEstimate) {
      this.missingFrames += 1;
      if (this.pipelineConfig.holdEnabled && this.missingFrames <= HOLD_FRAMES) {
        const held = this.current();
        this.lastDecision = held
          ? 'held'
          : estimate ? 'target-rejected' : 'no-candidate';
        return held;
      }
      this.lastDecision = estimate ? 'target-rejected' : 'no-candidate';
      this.resetTrack();
      return null;
    }

    this.missingFrames = 0;
    const candidate = Math.log2(resolvedEstimate.frequency);
    if (!Number.isFinite(candidate)) return this.current();

    if (!this.pipelineConfig.trackingEnabled) {
      this.stableLog = candidate;
      this.stableConfidence = resolvedEstimate.confidence;
      this.history = [candidate];
      this.clearPending();
      this.unstableFrames = 0;
      this.lastDecision = 'published';
      return this.current();
    }

    if (this.stableLog == null) {
      this.updatePending(candidate, resolvedEstimate.confidence, ACQUIRE_CENTS);
      if (this.pendingStreak < ACQUIRE_FRAMES) {
        this.lastDecision = 'tracking-acquiring';
        return null;
      }
      this.commitPending();
      this.lastDecision = 'published';
      return this.current();
    }

    const distance = Math.abs(centsBetween(candidate, this.stableLog));
    if (distance <= INLIER_CENTS) {
      this.clearPending();
      this.unstableFrames = 0;
      this.history.push(candidate);
      if (this.history.length > 3) this.history.shift();
      const sorted = [...this.history].sort((left, right) => left - right);
      const median = sorted[Math.floor(sorted.length / 2)];
      const residual = Math.abs(centsBetween(median, this.stableLog));
      const alpha = residual < 12 ? 0.2 : residual < 35 ? 0.35 : 0.55;
      this.stableLog += alpha * (median - this.stableLog);
      this.stableConfidence = 0.25 * resolvedEstimate.confidence + 0.75 * this.stableConfidence;
      this.lastDecision = 'published';
      return this.current();
    }

    this.unstableFrames += 1;
    this.updatePending(candidate, resolvedEstimate.confidence, PENDING_CENTS);
    const required = looksLikeOctave(candidate, this.stableLog)
      ? OCTAVE_CHANGE_FRAMES
      : CHANGE_FRAMES;
    if (this.pendingStreak >= required) {
      this.commitPending();
      this.lastDecision = 'published';
      return this.current();
    }
    if (this.unstableFrames >= 7) {
      const pendingLog = this.pendingLog;
      const pendingConfidence = this.pendingConfidence;
      this.resetTrack();
      this.pendingLog = pendingLog;
      this.pendingConfidence = pendingConfidence;
      this.pendingStreak = pendingLog == null ? 0 : 1;
      this.lastDecision = 'tracking-acquiring';
      return null;
    }
    this.lastDecision = 'tracking-acquiring';
    return this.current();
  }

  telemetry() {
    return {
      adaptiveGateOpen: this.lastAdaptiveGateOpen,
      decision: this.lastDecision,
      gateThreshold: this.gateOpen
        ? Math.max(BASE_RMS * ADAPTIVE.closeBaseRmsFactor, this.noiseFloor * ADAPTIVE.closeNoiseRatio)
        : Math.max(BASE_RMS * ADAPTIVE.openBaseRmsFactor, this.noiseFloor * ADAPTIVE.openNoiseRatio),
      noiseFloor: this.noiseFloor,
      selected: this.lastSelected,
    } as const;
  }

  reset() {
    this.resetTrack();
    this.belowGateFrames = 0;
    this.calibratedFrames = 0;
    this.gateOpen = false;
    this.lastAdaptiveGateOpen = false;
    this.lastDecision = 'no-candidate';
    this.lastSelected = null;
    this.noiseFloor = BASE_RMS;
    this.previousRms = 0;
  }

  private observeGate(stats: SignalStats, estimate: PitchEstimate | null) {
    const onset = this.previousRms > 0
      && stats.rms - this.previousRms >= ADAPTIVE.onsetRmsDelta
      && stats.rms >= this.previousRms * ADAPTIVE.onsetRatio;
    this.previousRms = stats.rms;

    if (this.gateOpen) {
      const closeThreshold = Math.max(
        BASE_RMS * ADAPTIVE.closeBaseRmsFactor,
        this.noiseFloor * ADAPTIVE.closeNoiseRatio,
      );
      this.belowGateFrames = stats.rms < closeThreshold || stats.maxAbs < BASE_PEAK * ADAPTIVE.closePeakFactor
        ? this.belowGateFrames + 1
        : 0;
      if (this.belowGateFrames >= ADAPTIVE.closeConfirmFrames) this.gateOpen = false;
      return this.gateOpen;
    }

    const strongAttack = stats.rms >= ADAPTIVE.strongAttackRms && stats.maxAbs >= ADAPTIVE.strongAttackPeak;
    const targetDistance = estimate ? this.directTargetDistance(estimate.frequency) : null;
    const trusted = estimate != null && (
      estimate.confidence >= ADAPTIVE.universalConfidence
      || (estimate.confidence >= ADAPTIVE.targetConfidence
        && targetDistance != null
        && targetDistance <= ADAPTIVE.targetDistanceCents)
    );
    const attackOpen = estimate != null && (strongAttack || onset);
    const qualityOpen = estimate != null
      && stats.rms >= Math.max(BASE_RMS * ADAPTIVE.openBaseRmsFactor, this.noiseFloor * ADAPTIVE.openNoiseRatio)
      && stats.maxAbs >= BASE_PEAK
      && trusted;

    if (attackOpen || qualityOpen) {
      this.gateOpen = true;
      this.belowGateFrames = 0;
      return true;
    }
    if (this.calibratedFrames < ADAPTIVE.calibrationFrames) {
      this.calibratedFrames += 1;
      this.updateNoiseFloor(stats.rms);
      return false;
    }
    if (!strongAttack && !trusted) this.updateNoiseFloor(stats.rms);
    return false;
  }

  private updateNoiseFloor(rms: number) {
    if (!Number.isFinite(rms) || rms < 0) return;
    const bounded = Math.min(rms, Math.max(BASE_RMS, this.noiseFloor * ADAPTIVE.noiseFloorCapFactor));
    this.noiseFloor = ADAPTIVE.noiseFloorDecay * this.noiseFloor
      + ADAPTIVE.noiseFloorUpdateWeight * bounded;
  }

  private correctOctave(frequency: number) {
    const direct = this.directTargetDistance(frequency);
    const foldedFrequency = frequency * 0.5;
    const folded = this.inDetectionRange(foldedFrequency)
      ? this.directTargetDistance(foldedFrequency)
      : null;
    return direct != null && folded != null
      && folded <= 80 && direct >= 120 && direct - folded >= 50
      ? foldedFrequency
      : frequency;
  }

  private resolveEstimate(estimate: PitchEstimate | null): PitchEstimate | null {
    if (!estimate) return null;
    const frequency = this.pipelineConfig.octaveEnabled
      ? this.correctOctave(estimate.frequency)
      : estimate.frequency;
    if (!this.inDetectionRange(frequency)) return null;
    const distance = this.directTargetDistance(frequency);
    if (distance == null) return { ...estimate, frequency };
    const limit = this.selectedTarget != null
      ? SELECTED_TARGET_LIMIT_CENTS
      : TUNING_TARGET_LIMIT_CENTS;
    return distance <= limit ? { ...estimate, frequency } : null;
  }

  private directTargetDistance(frequency: number): number | null {
    const targets = this.selectedTarget != null ? [this.selectedTarget] : this.targets;
    if (!validFrequency(frequency) || targets.length === 0) return null;
    return Math.min(...targets.map((target) => Math.abs(1_200 * Math.log2(frequency / target))));
  }

  private inDetectionRange(frequency: number) {
    return frequency >= this.minFrequency && frequency <= this.maxFrequency;
  }

  private updatePending(candidate: number, confidence: number, tolerance: number) {
    if (this.pendingLog != null && Math.abs(centsBetween(candidate, this.pendingLog)) <= tolerance) {
      const weight = 1 / (this.pendingStreak + 1);
      this.pendingLog += weight * (candidate - this.pendingLog);
      this.pendingConfidence += weight * (confidence - this.pendingConfidence);
      this.pendingStreak += 1;
    } else {
      this.pendingLog = candidate;
      this.pendingConfidence = confidence;
      this.pendingStreak = 1;
    }
  }

  private commitPending() {
    if (this.pendingLog == null) return;
    this.stableLog = this.pendingLog;
    this.stableConfidence = this.pendingConfidence;
    this.history = [this.pendingLog];
    this.clearPending();
    this.unstableFrames = 0;
  }

  private current(): PitchEstimate | null {
    return this.stableLog == null
      ? null
      : { confidence: this.stableConfidence, frequency: 2 ** this.stableLog };
  }

  private clearPending() {
    this.pendingLog = null;
    this.pendingConfidence = 0;
    this.pendingStreak = 0;
  }

  private resetTrack() {
    this.clearPending();
    this.history = [];
    this.missingFrames = 0;
    this.stableConfidence = 0;
    this.stableLog = null;
    this.unstableFrames = 0;
  }
}

function centsBetween(leftLog: number, rightLog: number) {
  return 1_200 * (leftLog - rightLog);
}

function looksLikeOctave(candidate: number, stable: number) {
  const distance = Math.abs(centsBetween(candidate, stable));
  return distance >= 900 && Math.abs(distance - Math.round(distance / 1_200) * 1_200) <= 100;
}

function validFrequency(value: number | null | undefined): value is number {
  return Number.isFinite(value) && (value ?? 0) > 0;
}
