/**
 * In-tune confirmation feedback (M73) and readout stability control (M62).
 *
 * Pure, framework-free helpers so the transition logic, channel dispatch and
 * the stability mapping can be unit-tested without mounting Vue components.
 *
 * Feedback channels (sound / vibration / flash) are independently toggleable
 * in the display preferences; each channel is optional and fails soft when
 * the platform does not support it.
 */

import type { TuneState } from './tuneA11y';

/**
 * Edge detector for the "in tune" confirmation.
 *
 * Fires exactly once per transition INTO the 'in-tune' state. The detector
 * re-arms only after the state leaves 'in-tune' (any other state, including
 * 'silent'), so holding a tuned note never re-triggers the feedback while a
 * short detune-and-recover does.
 */
export class InTuneConfirmation {
  private armed = true;

  /** Returns true when this snapshot should trigger the confirmation. */
  push(state: TuneState): boolean {
    if (state === 'in-tune') {
      if (!this.armed) return false;
      this.armed = false;
      return true;
    }
    this.armed = true;
    return false;
  }

  reset() {
    this.armed = true;
  }
}

export interface InTuneFeedbackChannels {
  sound: boolean;
  vibrate: boolean;
  flash: boolean;
}

export interface InTuneFeedbackResult {
  flashed: boolean;
  played: boolean;
  vibrated: boolean;
}

export interface InTuneFeedbackOptions {
  /** Injected for tests; defaults to a lazily created shared AudioContext. */
  audioContext?: AudioContext | null;
  /** When true (or when the OS prefers reduced motion) the flash is skipped. */
  reducedMotion?: boolean;
  now?: () => number;
}

/**
 * Fires the enabled confirmation channels. Visual flash is reported back via
 * `flashed` so the caller can drive a CSS pulse; it is suppressed when the
 * user (or the OS) asks for reduced motion.
 */
export function fireInTuneFeedback(
  channels: InTuneFeedbackChannels,
  options: InTuneFeedbackOptions = {},
): InTuneFeedbackResult {
  const result: InTuneFeedbackResult = { flashed: false, played: false, vibrated: false };
  if (channels.sound) {
    result.played = playInTuneBeep(options.audioContext);
  }
  if (channels.vibrate) {
    result.vibrated = vibrateInTune();
  }
  if (channels.flash) {
    const reduced = options.reducedMotion ?? prefersReducedMotion();
    result.flashed = !reduced;
  }
  return result;
}

let sharedAudioContext: AudioContext | null = null;

function getSharedAudioContext(): AudioContext | null {
  if (sharedAudioContext) return sharedAudioContext;
  try {
    if (typeof AudioContext === 'undefined') return null;
    sharedAudioContext = new AudioContext();
    return sharedAudioContext;
  } catch {
    return null;
  }
}

/**
 * Short synthesized "in tune" blip — no audio assets required. Two quick
 * sine partials (E5 → A5) with a fast decay; total duration ≈140 ms at low
 * gain so it reads as a confirmation, not an alarm. Never throws.
 */
export function playInTuneBeep(context?: AudioContext | null): boolean {
  const ctx = context ?? getSharedAudioContext();
  if (!ctx) return false;
  try {
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    const startAt = ctx.currentTime + 0.01;
    const notes: Array<{ frequency: number; offset: number }> = [
      { frequency: 659.25, offset: 0 },
      { frequency: 880, offset: 0.07 },
    ];
    for (const { frequency, offset } of notes) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      const noteStart = startAt + offset;
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.12, noteStart + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.09);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(noteStart);
      oscillator.stop(noteStart + 0.1);
    }
    return true;
  } catch {
    return false;
  }
}

/** Short haptic tick on devices with vibration support; no-op elsewhere. */
export function vibrateInTune(pattern: number | number[] = 35): boolean {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
      return false;
    }
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

export function prefersReducedMotion(): boolean {
  try {
    return typeof globalThis.matchMedia === 'function'
      && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// M62: readout stability ("needle steadiness") a11y control
// ---------------------------------------------------------------------------

/**
 * Maps the user-facing stability ratio (0..1) to the EMA alpha used by the
 * readout stabilizer. 0 = responsive (alpha 1, no extra smoothing),
 * 1 = maximum steadiness (alpha 0.08 — heavy smoothing for tremor users).
 */
export function stabilityToAlpha(stability: number): number {
  const clamped = Math.max(0, Math.min(1, Number(stability) || 0));
  return 1 - 0.92 * clamped;
}

/** Named presets for the segmented stability control in the settings UI. */
export const READOUT_STABILITY_PRESETS = Object.freeze({
  low: 0.15,
  medium: 0.55,
  high: 0.9,
});

export type ReadoutStabilityPresetId = keyof typeof READOUT_STABILITY_PRESETS;

export function nearestStabilityPreset(stability: number): ReadoutStabilityPresetId {
  let best: ReadoutStabilityPresetId = 'medium';
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const id of Object.keys(READOUT_STABILITY_PRESETS) as ReadoutStabilityPresetId[]) {
    const distance = Math.abs(READOUT_STABILITY_PRESETS[id] - stability);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = id;
    }
  }
  return best;
}

/**
 * Display-only cents stabilizer: a simple exponential moving average applied
 * AFTER the detection machine, so it never affects in-tune hysteresis or the
 * pipeline — it only steadies the needle/gauge the user watches. Null input
 * (lost detection) resets the filter so the next note starts un-smoothed.
 */
export class CentsStabilizer {
  private ema: number | null = null;
  private alpha = stabilityToAlpha(0.5);

  setStability(stability: number) {
    this.alpha = stabilityToAlpha(stability);
  }

  /** Returns the smoothed cents, or null when there is no detection. */
  add(cents: number | null): number | null {
    if (cents == null || !Number.isFinite(cents)) {
      this.reset();
      return null;
    }
    this.ema = this.ema == null
      ? cents
      : this.alpha * cents + (1 - this.alpha) * this.ema;
    return this.ema;
  }

  reset() {
    this.ema = null;
  }
}
