// Pitch detection utilities
// YIN algorithm (much better for guitar than plain autocorrelation)
// + fallback to improved autocorrelation

import {
  createDefaultPipelineConfig,
  normalizePipelineConfig,
  type PipelineConfig,
} from '../domain/pipelineConfig';

export interface PitchDetectionRange {
  minFrequency: number;
  maxFrequency: number;
}

export interface PitchEstimate {
  confidence: number;
  frequency: number;
}

export interface PitchGuidance {
  selectedFrequency?: number | null;
  targetFrequencies?: readonly number[];
}

export const DEFAULT_PITCH_DETECTION_RANGE: PitchDetectionRange = {
  minFrequency: 24,
  maxFrequency: 1200,
};

const YIN_THRESHOLD = 0.12; // classic value, can be tuned 0.1-0.2
const MIN_RMS = 0.0025;
const MIN_PEAK = 0.012;
const DETECTOR_AGREEMENT_CENTS = 35;
const DECISIVE_CONFIDENCE_MARGIN = 0.12;
const GUIDED_IMPROVEMENT_CENTS = 80;
const GUIDED_RAW_DISTANCE_CENTS = 300;
const STRONG_DISAGREEMENT_CONFIDENCE = 0.9;

// Confidence is normalized periodicity quality, not a probability. Frames
// below this score do not update the readout in either the Rust or TS path.
export const MIN_USABLE_PITCH_CONFIDENCE = 0.7;

export interface SignalStats {
  rms: number;
  maxAbs: number;
}

export function computeSignalStats(buffer: Float32Array): SignalStats {
  let sumSq = 0;
  let maxAbs = 0;
  for (let i = 0; i < buffer.length; i++) {
    const v = buffer[i];
    sumSq += v * v;
    const a = Math.abs(v);
    if (a > maxAbs) maxAbs = a;
  }
  return {
    rms: Math.sqrt(sumSq / buffer.length),
    maxAbs,
  };
}

export function isBelowPitchDetectionGate(stats: SignalStats) {
  return stats.rms < 0.002 || stats.maxAbs < 0.01;
}

// Reusable buffers
let yinBuffer: Float32Array | null = null;
let diffBuffer: Float32Array | null = null;
let centeredBuffer: Float32Array | null = null;

function removeDcOffset(buffer: Float32Array) {
  if (buffer.length === 0) return buffer;
  if (!centeredBuffer || centeredBuffer.length !== buffer.length) {
    centeredBuffer = new Float32Array(buffer.length);
  }
  let sum = 0;
  for (let index = 0; index < buffer.length; index += 1) sum += buffer[index];
  const mean = sum / buffer.length;
  for (let index = 0; index < buffer.length; index += 1) {
    centeredBuffer[index] = buffer[index] - mean;
  }
  return centeredBuffer;
}

function ensureYinBuffers(size: number) {
  const half = Math.floor(size / 2);
  if (!yinBuffer || yinBuffer.length < half) {
    yinBuffer = new Float32Array(half);
  }
  if (!diffBuffer || diffBuffer.length < half) {
    diffBuffer = new Float32Array(half);
  }
  return { yin: yinBuffer, diff: diffBuffer };
}

export function normalizePitchDetectionRange(range: Partial<PitchDetectionRange> | null | undefined): PitchDetectionRange {
  const minFrequency = Math.max(20, Math.min(600, Number(range?.minFrequency) || DEFAULT_PITCH_DETECTION_RANGE.minFrequency));
  const maxFrequency = Math.max(80, Math.min(1800, Number(range?.maxFrequency) || DEFAULT_PITCH_DETECTION_RANGE.maxFrequency));

  if (maxFrequency <= minFrequency * 1.2) {
    return { ...DEFAULT_PITCH_DETECTION_RANGE };
  }

  return { minFrequency, maxFrequency };
}

/**
 * YIN pitch detection (De Cheveigné & Kawahara 2002)
 * Significantly more robust on real guitar signals than basic autocorrelation.
 */
export function detectPitchYINEstimate(
  buffer: Float32Array,
  sampleRate: number,
  stats = computeSignalStats(buffer),
  range: Partial<PitchDetectionRange> | null | undefined = DEFAULT_PITCH_DETECTION_RANGE,
  enforceSignalGate = true,
): PitchEstimate | null {
  const size = buffer.length;
  const half = Math.floor(size / 2);
  const detectionRange = normalizePitchDetectionRange(range);

  // Limit tau to the active instrument range for perf and correctness.
  const minTau = Math.max(1, Math.floor(sampleRate / detectionRange.maxFrequency));
  const maxTau = Math.min(half, Math.floor(sampleRate / detectionRange.minFrequency));
  if (maxTau <= minTau + 2) return null;
  const analysisLength = size - maxTau;

  // Gate on energy
  if (enforceSignalGate && (stats.rms < MIN_RMS || stats.maxAbs < MIN_PEAK)) return null;

  const { yin, diff } = ensureYinBuffers(size);

  // 1. Difference function. CMNDF needs the full prefix even though target
  // selection is range-limited; this matches the Rust confidence scale.
  for (let tau = 1; tau < maxTau; tau++) {
    let sum = 0;
    for (let i = 0; i < analysisLength; i++) {
      const delta = buffer[i] - buffer[i + tau];
      sum += delta * delta;
    }
    diff[tau] = sum;
  }

  // 2. Cumulative mean normalized difference
  yin[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau < maxTau; tau++) {
    runningSum += diff[tau];
    yin[tau] = runningSum > 0 ? diff[tau] * (tau / runningSum) : 1;
  }

  // 3. Absolute threshold + find first dip below threshold (limited)
  let tauEstimate = -1;
  for (let tau = minTau; tau < maxTau; tau++) {
    if (yin[tau] < YIN_THRESHOLD) {
      // search for local minimum
      while (tau + 1 < maxTau && yin[tau + 1] < yin[tau]) {
        tau++;
      }
      tauEstimate = tau;
      break;
    }
  }

  // Fallback: global minimum if no threshold crossed (limited)
  if (tauEstimate === -1) {
    let minVal = Infinity;
    for (let tau = minTau; tau < maxTau; tau++) {
      if (yin[tau] < minVal) {
        minVal = yin[tau];
        tauEstimate = tau;
      }
    }
    if (minVal > 0.35) return null; // too uncertain
  }

  if (tauEstimate < 2) return null;

  // 4. Parabolic interpolation
  let betterTau = tauEstimate;
  if (tauEstimate > 1 && tauEstimate < maxTau - 1) {
    const s0 = yin[tauEstimate - 1];
    const s1 = yin[tauEstimate];
    const s2 = yin[tauEstimate + 1];
    const denom = 2 * s1 - s0 - s2;
    if (Math.abs(denom) > 1e-9) {
      const delta = (s2 - s0) / (2 * denom);
      betterTau = tauEstimate + delta;
    }
  }

  const freq = sampleRate / betterTau;

  if (freq < detectionRange.minFrequency || freq > detectionRange.maxFrequency) return null;
  const confidence = Math.max(0, Math.min(1, 1 - yin[tauEstimate]));
  if (confidence < MIN_USABLE_PITCH_CONFIDENCE) return null;
  return { confidence, frequency: freq };
}

export function detectPitchYIN(
  buffer: Float32Array,
  sampleRate: number,
  stats = computeSignalStats(buffer),
  range: Partial<PitchDetectionRange> | null | undefined = DEFAULT_PITCH_DETECTION_RANGE,
): number | null {
  return detectPitchYINEstimate(buffer, sampleRate, stats, range)?.frequency ?? null;
}

// Legacy improved autocorrelation (kept for comparison / fallback)
let corrBuffer: Float32Array | null = null;
let windowBuffer: Float32Array | null = null;

function ensureBuffers(size: number) {
  if (!corrBuffer || corrBuffer.length < size) corrBuffer = new Float32Array(size);
  if (!windowBuffer || windowBuffer.length < size) windowBuffer = new Float32Array(size);
  return { corr: corrBuffer, win: windowBuffer };
}

export function autoCorrelateEstimate(
  buffer: Float32Array,
  sampleRate: number,
  stats = computeSignalStats(buffer),
  range: Partial<PitchDetectionRange> | null | undefined = DEFAULT_PITCH_DETECTION_RANGE,
  enforceSignalGate = true,
): PitchEstimate | null {
  const SIZE = buffer.length;
  const detectionRange = normalizePitchDetectionRange(range);
  const minLag = Math.max(1, Math.floor(sampleRate / detectionRange.maxFrequency));
  const maxLag = Math.min(Math.floor(sampleRate / detectionRange.minFrequency), Math.floor(SIZE / 2));
  if (maxLag <= minLag + 2) return null;

  if (enforceSignalGate && isBelowPitchDetectionGate(stats)) return null;

  let start = 0, end = SIZE - 1;
  while (start < SIZE / 2 && Math.abs(buffer[start]) < 1e-4) start++;
  while (end > start && Math.abs(buffer[end]) < 1e-4) end--;
  const W = Math.min(end - start + 1, SIZE);
  if (W < 64) return null;

  const { corr, win } = ensureBuffers(W + 1);
  for (let i = 0; i < W; i++) win[i] = buffer[start + i];

  const corrSize = Math.min(W, maxLag + 1);
  for (let lag = 0; lag < corrSize; lag++) {
    let s = 0;
    for (let i = 0; i < W - lag; i++) s += win[i] * win[i + lag];
    corr[lag] = s;
  }

  let d = minLag;
  while (d < corrSize - 1 && corr[d] > corr[d + 1]) d++;

  let bestLag = -1, bestVal = -1;
  for (let lag = d; lag < corrSize; lag++) {
    if (corr[lag] > bestVal) { bestVal = corr[lag]; bestLag = lag; }
  }
  if (bestLag < 4) return null;
  const confidence = Math.max(0, Math.min(1, bestVal / Math.max(corr[0], Number.EPSILON)));
  if (confidence < MIN_USABLE_PITCH_CONFIDENCE) return null;

  let period = bestLag;
  if (bestLag > 1 && bestLag < corrSize - 1) {
    const x0 = corr[bestLag-1], x1 = corr[bestLag], x2 = corr[bestLag+1];
    const denom = 2*x1 - x0 - x2;
    if (Math.abs(denom) > 1e-6) period = bestLag + (x2 - x0) / (2 * denom);
  }

  const freq = sampleRate / period;
  return (freq >= detectionRange.minFrequency && freq <= detectionRange.maxFrequency)
    ? { confidence, frequency: freq }
    : null;
}

export function autoCorrelate(
  buffer: Float32Array,
  sampleRate: number,
  stats = computeSignalStats(buffer),
  range: Partial<PitchDetectionRange> | null | undefined = DEFAULT_PITCH_DETECTION_RANGE,
): number | null {
  return autoCorrelateEstimate(buffer, sampleRate, stats, range)?.frequency ?? null;
}

/** Main fallback detector - reconciles two independent periodicity estimates. */
export function detectPitchEstimate(
  buffer: Float32Array,
  sampleRate: number,
  stats = computeSignalStats(buffer),
  range: Partial<PitchDetectionRange> | null | undefined = DEFAULT_PITCH_DETECTION_RANGE,
  guidance?: PitchGuidance,
  pipelineConfig: PipelineConfig = createDefaultPipelineConfig(),
): PitchEstimate | null {
  const pipeline = normalizePipelineConfig(pipelineConfig);
  const detectorBuffer = pipeline.dcRemovalEnabled ? removeDcOffset(buffer) : buffer;
  const detectorStats = detectorBuffer === buffer ? stats : computeSignalStats(detectorBuffer);
  if (pipeline.fixedGateEnabled && isBelowPitchDetectionGate(detectorStats)) return null;

  const yin = pipeline.yinEnabled
    ? detectPitchYINEstimate(
      detectorBuffer,
      sampleRate,
      detectorStats,
      range,
      pipeline.fixedGateEnabled,
    )
    : null;
  const autocorrelation = pipeline.secondaryDetectorEnabled
    ? autoCorrelateEstimate(
      detectorBuffer,
      sampleRate,
      detectorStats,
      range,
      pipeline.fixedGateEnabled,
    )
    : null;
  return selectPitchCandidate(yin, autocorrelation, guidance);
}

export function selectPitchCandidate(
  left: PitchEstimate | null,
  right: PitchEstimate | null,
  guidance?: PitchGuidance,
): PitchEstimate | null {
  left = validEstimate(left) ? left : null;
  right = validEstimate(right) ? right : null;
  if (!left) return right;
  if (!right) return left;

  if (centsDistance(left.frequency, right.frequency) <= DETECTOR_AGREEMENT_CENTS) {
    const leftWeight = Math.max(0.01, left.confidence);
    const rightWeight = Math.max(0.01, right.confidence);
    return {
      confidence: Math.max(0, Math.min(1, (left.confidence + right.confidence) * 0.5)),
      frequency: 2 ** (
        (Math.log2(left.frequency) * leftWeight + Math.log2(right.frequency) * rightWeight)
        / (leftWeight + rightWeight)
      ),
    };
  }

  const leftDistance = guidanceDistance(left.frequency, guidance);
  const rightDistance = guidanceDistance(right.frequency, guidance);
  if (leftDistance != null && rightDistance != null) {
    const [preferred, preferredDistance, otherDistance] = leftDistance <= rightDistance
      ? [left, leftDistance, rightDistance]
      : [right, rightDistance, leftDistance];
    if (preferredDistance <= GUIDED_RAW_DISTANCE_CENTS
      && otherDistance - preferredDistance >= GUIDED_IMPROVEMENT_CENTS) {
      return preferred;
    }
  }

  const [stronger, weaker] = left.confidence >= right.confidence
    ? [left, right]
    : [right, left];
  return stronger.confidence >= STRONG_DISAGREEMENT_CONFIDENCE
    && stronger.confidence - weaker.confidence >= DECISIVE_CONFIDENCE_MARGIN
    ? stronger
    : null;
}

function centsDistance(left: number, right: number) {
  return Math.abs(1_200 * Math.log2(left / right));
}

function guidanceDistance(frequency: number, guidance?: PitchGuidance): number | null {
  if (!guidance) return null;
  let minimum = Number.POSITIVE_INFINITY;
  for (const candidate of [frequency, frequency * 0.5, frequency * 2]) {
    const distance = directGuidanceDistance(candidate, guidance);
    if (distance != null) minimum = Math.min(minimum, distance);
  }
  return Number.isFinite(minimum) ? minimum : null;
}

function directGuidanceDistance(frequency: number, guidance: PitchGuidance): number | null {
  if (!validFrequency(frequency)) return null;
  if (validFrequency(guidance.selectedFrequency)) {
    return centsDistance(frequency, guidance.selectedFrequency);
  }
  let minimum = Number.POSITIVE_INFINITY;
  for (const target of guidance.targetFrequencies ?? []) {
    if (validFrequency(target)) minimum = Math.min(minimum, centsDistance(frequency, target));
  }
  return Number.isFinite(minimum) ? minimum : null;
}

function validFrequency(value: number | null | undefined): value is number {
  return Number.isFinite(value) && (value ?? 0) > 0;
}

function validEstimate(estimate: PitchEstimate | null): estimate is PitchEstimate {
  return estimate != null
    && validFrequency(estimate.frequency)
    && Number.isFinite(estimate.confidence)
    && estimate.confidence >= 0
    && estimate.confidence <= 1;
}

export function detectPitch(
  buffer: Float32Array,
  sampleRate: number,
  stats = computeSignalStats(buffer),
  range: Partial<PitchDetectionRange> | null | undefined = DEFAULT_PITCH_DETECTION_RANGE,
  guidance?: PitchGuidance,
  pipelineConfig: PipelineConfig = createDefaultPipelineConfig(),
): number | null {
  return detectPitchEstimate(
    buffer,
    sampleRate,
    stats,
    range,
    guidance,
    pipelineConfig,
  )?.frequency ?? null;
}

export class FrequencySmoother {
  private history: number[] = [];
  private ema: number | null = null;
  private readonly maxHistory = 5;
  private readonly alpha = 0.4;

  add(freq: number | null): number | null {
    if (freq == null || !isFinite(freq) || freq <= 0) {
      this.reset();
      return null;
    }

    this.ema = this.ema == null
      ? freq
      : this.alpha * freq + (1 - this.alpha) * this.ema;

    this.history.push(this.ema);
    if (this.history.length > this.maxHistory) this.history.shift();

    // Median filter
    const sorted = this.history.slice().sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) * 0.5;
  }

  reset() {
    this.history.length = 0;
    this.ema = null;
  }
}

// Convenience normalized 0..1 level (with soft knee)
export function normalizeLevel(rms: number): number {
  // Typical mic guitar signal after gate is ~0.01-0.2 rms
  return Math.min(1, rms * 18);
}
