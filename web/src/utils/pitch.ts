// Pitch detection utilities
// Shared with native via pitch-core (WASM in browser, direct in egui).
// No JS fallback implementations - build WASM for functionality.

let wasmModule: any = null;

export async function initPitchWasm() {
  if (wasmModule) return;
  try {
    // @ts-expect-error - wasm module generated at build time
    const mod = await import(/* @vite-ignore */ '/wasm/pitch_core.js');
    await mod.default();
    wasmModule = mod;
    console.log('[pitch] WASM core loaded');
  } catch (e) {
    console.warn('[pitch] WASM core failed to load. Functions will return no-op results.');
  }
}



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
    } catch (e) {
      console.warn('WASM YIN failed', e);
    }
  }
  return null;
}

export function detectPitchMPM(buffer: Float32Array, sampleRate: number): { freq: number; confidence: number } | null {
  if (wasmModule?.detect_pitch_mpm) {
    try {
      const res = wasmModule.detect_pitch_mpm(buffer, sampleRate);
      if (res && res.freq !== undefined) {
        return { freq: res.freq, confidence: res.confidence ?? 0 };
      }
    } catch (e) {
      console.warn('WASM MPM failed', e);
    }
  }
  return null;
}

/** Main detector - delegates to WASM (YIN preferred, then MPM) */
export function detectPitch(buffer: Float32Array, sampleRate: number): { freq: number; confidence: number } | null {
  if (wasmModule?.detect_pitch_wasm) {
    try {
      const res = wasmModule.detect_pitch_wasm(buffer, sampleRate);
      if (res && res.freq !== undefined) {
        return { freq: res.freq, confidence: res.confidence ?? 0 };
      }
    } catch (e) {
      console.warn('WASM detect failed', e);
    }
  }
  return null;
}

export class FrequencySmoother {
  private wasmSmoother: any = null;

  constructor() {
    if (wasmModule?.WasmSmoother) {
      try {
        this.wasmSmoother = new wasmModule.WasmSmoother();
      } catch (e) {
        console.warn('Failed to init WasmSmoother');
      }
    }
  }

  add(freq: number | null): number | null {
    if (this.wasmSmoother) {
      try {
        return this.wasmSmoother.add(freq);
      } catch (e) {
        console.warn('WASM smoother failed');
      }
    }
    return null;
  }

  reset() {
    if (this.wasmSmoother) {
      this.wasmSmoother.reset();
    }
  }
}

export function computeRmsVolume(buffer: Float32Array): number {
  if (wasmModule?.compute_rms_volume) {
    try {
      return wasmModule.compute_rms_volume(buffer);
    } catch (e) {
      console.warn('WASM RMS failed');
    }
  }
  // JS fallback (simple RMS) - pure math, always available
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    const v = buffer[i];
    sum += v * v;
  }
  return Math.sqrt(sum / buffer.length);
}

// Downsample for pitch detection perf (YIN O(n^2) expensive on 2048@60fps)
export function downsampleForPitch(buffer: Float32Array, factor: number = 2): Float32Array {
  if (wasmModule?.downsample_for_pitch) {
    try {
      return new Float32Array(wasmModule.downsample_for_pitch(buffer, factor));
    } catch (e) {
      console.warn('WASM downsample failed');
    }
  }
  return buffer;
}

// Convenience normalized 0..1 level (exact impl in WASM core)
export function normalizeLevel(rms: number): number {
  if (wasmModule?.normalize_level) {
    try {
      return wasmModule.normalize_level(rms);
    } catch (e) {
      console.warn('WASM normalize failed');
    }
  }
  // simple fallback for volume (same as core)
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
  return false;
}