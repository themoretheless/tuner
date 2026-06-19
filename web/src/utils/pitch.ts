// Pitch detection utilities
// YIN algorithm (much better for guitar than plain autocorrelation)
// + fallback to improved autocorrelation
// Uses shared Rust pitch-core via WASM in browser, native in egui.

let wasmModule: any = null;

export async function initPitchWasm() {
  if (wasmModule) return;
  try {
    // Build steps (run once):
    // cd pitch-core
    // cargo build --target wasm32-unknown-unknown --features wasm --release
    // wasm-bindgen target/wasm32-unknown-unknown/release/pitch_core.wasm --out-dir ../web/public/wasm --target web
    // Then the glue JS + .wasm will be in web/public/wasm/ and copied to dist
    // @ts-expect-error - wasm module generated at build time
    const mod = await import(/* @vite-ignore */ '/wasm/pitch_core.js');
    await mod.default();
    wasmModule = mod;
    console.log('[pitch] WASM core loaded');
  } catch (e) {
    console.log('[pitch] Using JS fallback (WASM not available)');
  }
}

const GUITAR_MIN_FREQ = 30;
const GUITAR_MAX_FREQ = 400;

/**
 * YIN pitch detection (De Cheveigné & Kawahara 2002)
 * Significantly more robust on real guitar signals than basic autocorrelation.
 */
export function detectPitchYIN(buffer: Float32Array, sampleRate: number): { freq: number; confidence: number } | null {
  if (wasmModule?.detect_pitch_yin) {
    try {
      const res = wasmModule.detect_pitch_yin(buffer, sampleRate);
      if (res && res.freq !== undefined) {
        return { freq: res.freq, confidence: res.confidence ?? 0 };
      }
      return null;
    } catch (e) {
      console.warn('WASM YIN failed, falling back to JS', e);
    }
  }

  // Fallback only - WASM should be used for full YIN
  console.warn('YIN fallback (build WASM for full impl)');
  return null;
}

// Legacy improved autocorrelation (kept for comparison / fallback)
let corrBuffer: Float32Array | null = null;
let windowBuffer: Float32Array | null = null;

function ensureBuffers(size: number) {
  if (!corrBuffer || corrBuffer.length < size) corrBuffer = new Float32Array(size);
  if (!windowBuffer || windowBuffer.length < size) windowBuffer = new Float32Array(size);
  return { corr: corrBuffer, win: windowBuffer };
}

export function autoCorrelate(buffer: Float32Array, sampleRate: number): { freq: number; confidence: number } | null {
  const SIZE = buffer.length;
  const maxLag = Math.min(Math.floor(sampleRate / GUITAR_MIN_FREQ), Math.floor(SIZE / 2));

  let sumSq = 0;
  let maxAbs = 0;
  for (let i = 0; i < SIZE; i++) {
    const v = buffer[i];
    sumSq += v * v;
    if (Math.abs(v) > maxAbs) maxAbs = Math.abs(v);
  }
  const rms = Math.sqrt(sumSq / SIZE);
  if (rms < 0.002 || maxAbs < 0.01) return null;

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
    if (Math.abs(denom) > 1e-6) {
      const delta = (x2 - x0) / (2 * denom);
      if (Math.abs(delta) < 1) {
        period = bestLag + delta;
      }
    }
  }

  const freq = sampleRate / period;
  if (freq < GUITAR_MIN_FREQ || freq > GUITAR_MAX_FREQ) return null;

  // Lower confidence for autocorrelation fallback
  const confidence = 0.6;
  return { freq, confidence };
}

export function detectPitchMPM(buffer: Float32Array, sampleRate: number): { freq: number; confidence: number } | null {
  if (wasmModule?.detect_pitch_mpm) {
    try {
      const res = wasmModule.detect_pitch_mpm(buffer, sampleRate);
      if (res && res.freq !== undefined) {
        return { freq: res.freq, confidence: res.confidence ?? 0 };
      }
      return null;
    } catch (e) {
      console.warn('WASM MPM failed, falling back to JS', e);
    }
  }

  // Fallback only
  console.warn('MPM fallback (build WASM for full impl)');
  return null;
}

/** Main detector - prefers WASM (YIN/MPM) if loaded, else JS version */
export function detectPitch(buffer: Float32Array, sampleRate: number): { freq: number; confidence: number } | null {
  if (wasmModule?.detect_pitch_wasm) {
    try {
      const res = wasmModule.detect_pitch_wasm(buffer, sampleRate);
      if (res && res.freq !== undefined) {
        return { freq: res.freq, confidence: res.confidence ?? 0 };
      }
    } catch (e) {
      console.warn('WASM detect failed, using JS', e);
    }
  }

  // JS fallback (YIN primary, MPM if weak, auto)
  let best = detectPitchYIN(buffer, sampleRate);
  let bestConf = best ? best.confidence : 0;

  if (!best || bestConf < 0.5) {
    const mpm = detectPitchMPM(buffer, sampleRate);
    if (mpm && mpm.confidence > bestConf) {
      best = mpm;
      bestConf = mpm.confidence;
    }
  }

  if (!best || bestConf < 0.3) {
    const ac = autoCorrelate(buffer, sampleRate);
    if (ac && ac.confidence > bestConf) {
      best = ac;
    }
  }

  return best;
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

export function computeRmsVolume(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    const v = buffer[i];
    sum += v * v;
  }
  return Math.sqrt(sum / buffer.length);
}

// Downsample for pitch detection perf (YIN O(n^2) expensive on 2048@60fps)
export function downsampleForPitch(buffer: Float32Array, factor: number = 2): Float32Array {
  if (factor <= 1) return buffer;
  const outLen = Math.floor(buffer.length / factor);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    out[i] = buffer[i * factor];
  }
  return out;
}

// Convenience normalized 0..1 level (with soft knee)
export function normalizeLevel(rms: number): number {
  // Typical mic guitar signal after gate is ~0.01-0.2 rms
  return Math.min(1, rms * 18);
}

export function isLikelyPowerChord(buffer: Float32Array, sampleRate: number, fundamental: number): boolean {
  if (wasmModule?.is_likely_power_chord) {
    try {
      return !!wasmModule.is_likely_power_chord(buffer, sampleRate, fundamental);
    } catch (e) {
      console.warn('WASM power chord failed', e);
    }
  }
  if (!fundamental || fundamental < 40) return false;
  const f5 = fundamental * 1.4983; // approx perfect fifth
  const lag = Math.floor(sampleRate / f5);
  if (lag < 2 || lag >= buffer.length - 64) return false;

  let corr = 0;
  let energy = 0;
  const len = Math.min(512, buffer.length - lag);
  for (let i = 0; i < len; i++) {
    const v = buffer[i];
    corr += v * buffer[i + lag];
    energy += v * v;
  }
  return energy > 0 && (corr / energy) > 0.5;
}