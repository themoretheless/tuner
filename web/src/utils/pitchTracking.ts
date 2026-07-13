import type { FrameContext } from '../types/frames';
import type { PitchEstimate, SignalStats } from './pitch';

const BASE_RMS = 0.0025;
const BASE_PEAK = 0.012;
const ACQUIRE_FRAMES = 2;
const ACQUIRE_CENTS = 45;
const INLIER_CENTS = 85;
const CHANGE_FRAMES = 3;
const OCTAVE_CHANGE_FRAMES = 7;
const PENDING_CENTS = 55;
const HOLD_FRAMES = 6;

/** Stateful fallback for browsers where the shared WASM processor cannot load. */
export class StreamingPitchTracker {
  private belowGateFrames = 0;
  private calibratedFrames = 0;
  private contextKey = '';
  private gateOpen = false;
  private history: number[] = [];
  private missingFrames = 0;
  private noiseFloor = BASE_RMS;
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

  update(estimate: PitchEstimate | null, stats: SignalStats): PitchEstimate | null {
    if (!this.observeGate(stats, estimate)) {
      this.resetTrack();
      return null;
    }
    if (!estimate) {
      this.missingFrames += 1;
      if (this.missingFrames <= HOLD_FRAMES) return this.current();
      this.resetTrack();
      return null;
    }

    this.missingFrames = 0;
    const candidate = Math.log2(this.correctOctave(estimate.frequency));
    if (!Number.isFinite(candidate)) return this.current();

    if (this.stableLog == null) {
      this.updatePending(candidate, estimate.confidence, ACQUIRE_CENTS);
      if (this.pendingStreak < ACQUIRE_FRAMES) return null;
      this.commitPending();
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
      this.stableConfidence = 0.25 * estimate.confidence + 0.75 * this.stableConfidence;
      return this.current();
    }

    this.unstableFrames += 1;
    this.updatePending(candidate, estimate.confidence, PENDING_CENTS);
    const required = looksLikeOctave(candidate, this.stableLog)
      ? OCTAVE_CHANGE_FRAMES
      : CHANGE_FRAMES;
    if (this.pendingStreak >= required) {
      this.commitPending();
      return this.current();
    }
    if (this.unstableFrames >= 7) {
      const pendingLog = this.pendingLog;
      const pendingConfidence = this.pendingConfidence;
      this.resetTrack();
      this.pendingLog = pendingLog;
      this.pendingConfidence = pendingConfidence;
      this.pendingStreak = pendingLog == null ? 0 : 1;
      return null;
    }
    return this.current();
  }

  reset() {
    this.resetTrack();
    this.belowGateFrames = 0;
    this.calibratedFrames = 0;
    this.gateOpen = false;
    this.noiseFloor = BASE_RMS;
    this.previousRms = 0;
  }

  private observeGate(stats: SignalStats, estimate: PitchEstimate | null) {
    const onset = this.previousRms > 0
      && stats.rms - this.previousRms >= 0.002
      && stats.rms >= this.previousRms * 1.6;
    this.previousRms = stats.rms;

    if (this.gateOpen) {
      const closeThreshold = Math.max(BASE_RMS * 0.9, this.noiseFloor * 1.25);
      this.belowGateFrames = stats.rms < closeThreshold || stats.maxAbs < BASE_PEAK * 0.75
        ? this.belowGateFrames + 1
        : 0;
      if (this.belowGateFrames >= 3) this.gateOpen = false;
      return this.gateOpen;
    }

    const strongAttack = stats.rms >= 0.012 && stats.maxAbs >= 0.03;
    const targetDistance = estimate ? this.directTargetDistance(estimate.frequency) : null;
    const trusted = estimate != null && (
      estimate.confidence >= 0.9
      || (estimate.confidence >= 0.72 && targetDistance != null && targetDistance <= 90)
    );
    const attackOpen = estimate != null && (strongAttack || onset);
    const qualityOpen = estimate != null
      && stats.rms >= Math.max(BASE_RMS * 1.2, this.noiseFloor * 1.8)
      && stats.maxAbs >= BASE_PEAK
      && trusted;

    if (attackOpen || qualityOpen) {
      this.gateOpen = true;
      this.belowGateFrames = 0;
      return true;
    }
    if (this.calibratedFrames < 4) {
      this.calibratedFrames += 1;
      this.updateNoiseFloor(stats.rms);
      return false;
    }
    if (!strongAttack && !trusted) this.updateNoiseFloor(stats.rms);
    return false;
  }

  private updateNoiseFloor(rms: number) {
    if (!Number.isFinite(rms) || rms < 0) return;
    const bounded = Math.min(rms, Math.max(BASE_RMS, this.noiseFloor * 3));
    this.noiseFloor = 0.85 * this.noiseFloor + 0.15 * bounded;
  }

  private correctOctave(frequency: number) {
    const direct = this.directTargetDistance(frequency);
    const folded = this.directTargetDistance(frequency * 0.5);
    return direct != null && folded != null
      && folded <= 80 && direct >= 120 && direct - folded >= 50
      ? frequency * 0.5
      : frequency;
  }

  private directTargetDistance(frequency: number): number | null {
    const targets = this.selectedTarget != null ? [this.selectedTarget] : this.targets;
    if (!validFrequency(frequency) || targets.length === 0) return null;
    return Math.min(...targets.map((target) => Math.abs(1_200 * Math.log2(frequency / target))));
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
