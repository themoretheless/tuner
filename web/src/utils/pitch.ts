// Pitch detection utilities
// YIN algorithm (much better for guitar than plain autocorrelation)
// + fallback to improved autocorrelation

const GUITAR_MIN_FREQ = 30;
const GUITAR_MAX_FREQ = 400;
const YIN_THRESHOLD = 0.12; // classic value, can be tuned 0.1-0.2
const MIN_RMS = 0.0025;
const MIN_PEAK = 0.012;

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

/**
 * YIN pitch detection (De Cheveigné & Kawahara 2002)
 * Significantly more robust on real guitar signals than basic autocorrelation.
 */
export function detectPitchYIN(buffer: Float32Array, sampleRate: number, stats = computeSignalStats(buffer)): number | null {
  const size = buffer.length;
  const half = Math.floor(size / 2);

  // Limit tau to guitar frequency range for perf (avoid useless high lags)
  const minTau = Math.floor(sampleRate / GUITAR_MAX_FREQ);
  const maxTau = Math.min(half, Math.floor(sampleRate / GUITAR_MIN_FREQ));

  // Gate on energy
  if (stats.rms < MIN_RMS || stats.maxAbs < MIN_PEAK) return null;

  const { yin, diff } = ensureYinBuffers(size);

  // 1. Difference function (limited range)
  for (let tau = minTau; tau < maxTau; tau++) {
    let sum = 0;
    for (let i = 0; i < half; i++) {
      const delta = buffer[i] - buffer[i + tau];
      sum += delta * delta;
    }
    diff[tau] = sum;
  }

  // 2. Cumulative mean normalized difference (limited)
  yin[0] = 1;
  let runningSum = 0;
  for (let tau = minTau; tau < maxTau; tau++) {
    runningSum += diff[tau];
    yin[tau] = diff[tau] * (tau / runningSum);
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

  if (freq < GUITAR_MIN_FREQ || freq > GUITAR_MAX_FREQ) return null;
  return freq;
}

// Legacy improved autocorrelation (kept for comparison / fallback)
let corrBuffer: Float32Array | null = null;
let windowBuffer: Float32Array | null = null;

function ensureBuffers(size: number) {
  if (!corrBuffer || corrBuffer.length < size) corrBuffer = new Float32Array(size);
  if (!windowBuffer || windowBuffer.length < size) windowBuffer = new Float32Array(size);
  return { corr: corrBuffer, win: windowBuffer };
}

export function autoCorrelate(buffer: Float32Array, sampleRate: number, stats = computeSignalStats(buffer)): number | null {
  const SIZE = buffer.length;
  const maxLag = Math.min(Math.floor(sampleRate / GUITAR_MIN_FREQ), Math.floor(SIZE / 2));

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

  let d = 1;
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
  return (freq >= GUITAR_MIN_FREQ && freq <= GUITAR_MAX_FREQ) ? freq : null;
}

/** Main detector - prefers YIN */
export function detectPitch(buffer: Float32Array, sampleRate: number, stats = computeSignalStats(buffer)): number | null {
  if (stats.rms < 0.002 || stats.maxAbs < 0.01) return null;

  // Try YIN first
  const yinResult = detectPitchYIN(buffer, sampleRate, stats);
  if (yinResult != null) return yinResult;

  // Fallback to autocorrelation
  return autoCorrelate(buffer, sampleRate, stats);
}

export class FrequencySmoother {
  private history: number[] = [];
  private ema: number | null = null;
  private readonly maxHistory = 5;
  private readonly alpha = 0.4;

  add(freq: number | null): number | null {
    if (freq == null || !isFinite(freq)) return this.ema;

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
