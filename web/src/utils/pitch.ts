// Pitch detection utilities
// YIN algorithm (much better for guitar than plain autocorrelation)
// + fallback to improved autocorrelation

export interface PitchDetectionRange {
  minFrequency: number;
  maxFrequency: number;
}

export const DEFAULT_PITCH_DETECTION_RANGE: PitchDetectionRange = {
  minFrequency: 24,
  maxFrequency: 1200,
};

const YIN_THRESHOLD = 0.12; // classic value, can be tuned 0.1-0.2
const MIN_RMS = 0.0025;
const MIN_PEAK = 0.012;

export interface SignalStats {
  rms: number;
  maxAbs: number;
}

export interface PitchDetectionResult {
  frequency: number;
  confidence: number;
}

export function computeSignalStats(buffer: Float32Array): SignalStats {
  if (buffer.length === 0) {
    return { rms: 0, maxAbs: 0 };
  }

  let sumSq = 0;
  let maxAbs = 0;
  for (let i = 0; i < buffer.length; i++) {
    const v = buffer[i];
    if (!Number.isFinite(v)) {
      return { rms: 0, maxAbs: 0 };
    }
    sumSq += v * v;
    const a = Math.abs(v);
    if (a > maxAbs) maxAbs = a;
  }
  return {
    rms: Math.sqrt(sumSq / buffer.length),
    maxAbs,
  };
}

// Reusable buffers
let yinBuffer: Float32Array | null = null;
let diffBuffer: Float32Array | null = null;

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
export function detectPitchYINResult(
  buffer: Float32Array,
  sampleRate: number,
  stats = computeSignalStats(buffer),
  range: Partial<PitchDetectionRange> | null | undefined = DEFAULT_PITCH_DETECTION_RANGE,
): PitchDetectionResult | null {
  const size = buffer.length;
  if (!isValidPitchInput(buffer, sampleRate, stats)) return null;
  const half = Math.floor(size / 2);
  const detectionRange = normalizePitchDetectionRange(range);

  // Limit tau to the active instrument range for perf and correctness.
  const minTau = Math.max(1, Math.floor(sampleRate / detectionRange.maxFrequency));
  const maxTau = Math.min(half, Math.floor(sampleRate / detectionRange.minFrequency));
  if (maxTau <= minTau + 2) return null;

  // Gate on energy
  if (stats.rms < MIN_RMS || stats.maxAbs < MIN_PEAK) return null;

  const { yin, diff } = ensureYinBuffers(size);

  // Canonical YIN requires every lag from 1 to be included in the cumulative
  // mean. Starting at minTau makes the first in-range values artificially
  // large and biases the selected period.
  for (let tau = 1; tau < maxTau; tau++) {
    let sum = 0;
    for (let i = 0; i < half; i++) {
      const delta = buffer[i] - buffer[i + tau];
      sum += delta * delta;
    }
    diff[tau] = sum;
  }

  // 2. Cumulative mean normalized difference (CMNDF)
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
  let confidence = 0;
  if (tauEstimate === -1) {
    let minVal = Infinity;
    for (let tau = minTau; tau < maxTau; tau++) {
      if (yin[tau] < minVal) {
        minVal = yin[tau];
        tauEstimate = tau;
      }
    }
    if (minVal > 0.35) return null; // too uncertain
    confidence = clamp01(1 - minVal);
  } else {
    confidence = clamp01(1 - yin[tauEstimate]);
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
      if (Math.abs(delta) < 1) {
        betterTau = tauEstimate + delta;
      }
    }
  }

  const freq = sampleRate / betterTau;

  if (freq < detectionRange.minFrequency || freq > detectionRange.maxFrequency) return null;
  return { frequency: freq, confidence };
}

export function detectPitchYIN(
  buffer: Float32Array,
  sampleRate: number,
  stats = computeSignalStats(buffer),
  range: Partial<PitchDetectionRange> | null | undefined = DEFAULT_PITCH_DETECTION_RANGE,
): number | null {
  return detectPitchYINResult(buffer, sampleRate, stats, range)?.frequency ?? null;
}

// Legacy improved autocorrelation (kept for comparison / fallback)
let corrBuffer: Float32Array | null = null;
let windowBuffer: Float32Array | null = null;

function ensureBuffers(size: number) {
  if (!corrBuffer || corrBuffer.length < size) corrBuffer = new Float32Array(size);
  if (!windowBuffer || windowBuffer.length < size) windowBuffer = new Float32Array(size);
  return { corr: corrBuffer, win: windowBuffer };
}

export function autoCorrelate(
  buffer: Float32Array,
  sampleRate: number,
  stats = computeSignalStats(buffer),
  range: Partial<PitchDetectionRange> | null | undefined = DEFAULT_PITCH_DETECTION_RANGE,
): number | null {
  return autoCorrelateResult(buffer, sampleRate, stats, range)?.frequency ?? null;
}

function autoCorrelateResult(
  buffer: Float32Array,
  sampleRate: number,
  stats = computeSignalStats(buffer),
  range: Partial<PitchDetectionRange> | null | undefined = DEFAULT_PITCH_DETECTION_RANGE,
): PitchDetectionResult | null {
  const SIZE = buffer.length;
  if (!isValidPitchInput(buffer, sampleRate, stats)) return null;
  const detectionRange = normalizePitchDetectionRange(range);
  const minLag = Math.max(1, Math.floor(sampleRate / detectionRange.maxFrequency));
  const maxLag = Math.min(Math.floor(sampleRate / detectionRange.minFrequency), Math.floor(SIZE / 2));
  if (maxLag <= minLag + 2) return null;

  if (stats.rms < 0.002 || stats.maxAbs < 0.01) return null;

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

  let period = bestLag;
  if (bestLag > 1 && bestLag < corrSize - 1) {
    const x0 = corr[bestLag-1], x1 = corr[bestLag], x2 = corr[bestLag+1];
    const denom = 2*x1 - x0 - x2;
    if (Math.abs(denom) > 1e-6) period = bestLag + (x2 - x0) / (2 * denom);
  }

  const freq = sampleRate / period;
  if (freq < detectionRange.minFrequency || freq > detectionRange.maxFrequency) return null;

  const zeroLag = corr[0];
  const confidence = zeroLag > 0 ? clamp01(bestVal / zeroLag) : 0;
  return { frequency: freq, confidence };
}

/** Main detector - prefers YIN */
export function detectPitch(
  buffer: Float32Array,
  sampleRate: number,
  stats = computeSignalStats(buffer),
  range: Partial<PitchDetectionRange> | null | undefined = DEFAULT_PITCH_DETECTION_RANGE,
): number | null {
  return detectPitchWithConfidence(buffer, sampleRate, stats, range)?.frequency ?? null;
}

export function detectPitchWithConfidence(
  buffer: Float32Array,
  sampleRate: number,
  stats = computeSignalStats(buffer),
  range: Partial<PitchDetectionRange> | null | undefined = DEFAULT_PITCH_DETECTION_RANGE,
): PitchDetectionResult | null {
  if (!isValidPitchInput(buffer, sampleRate, stats)) return null;
  if (stats.rms < 0.002 || stats.maxAbs < 0.01) return null;

  // Try YIN first
  const yinResult = detectPitchYINResult(buffer, sampleRate, stats, range);
  if (yinResult != null) return yinResult;

  // Fallback to autocorrelation
  return autoCorrelateResult(buffer, sampleRate, stats, range);
}

export class FrequencySmoother {
  private history: number[] = [];
  private ema: number | null = null;
  private pendingJump: number | null = null;
  private pendingJumpCount = 0;
  private readonly maxHistory = 5;
  private readonly alpha = 0.4;
  private readonly largeJumpCents = 150;
  private readonly jumpAgreementCents = 50;

  add(freq: number | null): number | null {
    if (freq == null || !Number.isFinite(freq) || freq <= 0) return this.ema;

    if (this.ema != null && centsBetween(freq, this.ema) > this.largeJumpCents) {
      if (
        this.pendingJump != null &&
        centsBetween(freq, this.pendingJump) <= this.jumpAgreementCents
      ) {
        this.pendingJumpCount += 1;
      } else {
        this.pendingJump = freq;
        this.pendingJumpCount = 1;
      }

      // Ignore a single outlier, but switch promptly when two consecutive
      // frames agree on a genuinely different note.
      if (this.pendingJumpCount < 2) return this.currentMedian();

      this.history.length = 0;
      this.ema = freq;
      this.pendingJump = null;
      this.pendingJumpCount = 0;
      this.history.push(freq);
      return freq;
    }

    this.pendingJump = null;
    this.pendingJumpCount = 0;

    this.ema = this.ema == null
      ? freq
      : this.alpha * freq + (1 - this.alpha) * this.ema;

    this.history.push(this.ema);
    if (this.history.length > this.maxHistory) this.history.shift();

    // Median filter
    return this.currentMedian();
  }

  reset() {
    this.history.length = 0;
    this.ema = null;
    this.pendingJump = null;
    this.pendingJumpCount = 0;
  }

  private currentMedian(): number | null {
    if (!this.history.length) return this.ema;
    const sorted = this.history.slice().sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) * 0.5;
  }
}

function centsBetween(a: number, b: number) {
  return Math.abs(1200 * Math.log2(a / b));
}

function isValidPitchInput(buffer: Float32Array, sampleRate: number, stats: SignalStats) {
  if (
    buffer.length < 64 ||
    !Number.isFinite(sampleRate) ||
    sampleRate <= 0 ||
    !Number.isFinite(stats.rms) ||
    !Number.isFinite(stats.maxAbs) ||
    stats.rms < 0 ||
    stats.maxAbs < 0
  ) {
    return false;
  }
  for (let index = 0; index < buffer.length; index += 1) {
    if (!Number.isFinite(buffer[index])) return false;
  }
  return true;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

// Convenience normalized 0..1 level (with soft knee)
export function normalizeLevel(rms: number): number {
  // Typical mic guitar signal after gate is ~0.01-0.2 rms
  return Number.isFinite(rms) && rms > 0 ? Math.min(1, rms * 18) : 0;
}
