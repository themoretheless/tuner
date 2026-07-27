import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CentsStabilizer,
  InTuneConfirmation,
  READOUT_STABILITY_PRESETS,
  fireInTuneFeedback,
  nearestStabilityPreset,
  playInTuneBeep,
  stabilityToAlpha,
  vibrateInTune,
} from '../src/utils/inTuneFeedback';
import {
  createDefaultSettings,
  normalizePersistedSettings,
} from '../src/settings/normalizeSettings';
import { createSettingsStore } from '../src/composables/useSettings';

function createFakeAudioContext() {
  const gainNode = {
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn((destination: unknown) => destination),
  };
  const oscillator = {
    type: '',
    frequency: { value: 0 },
    connect: vi.fn(() => gainNode),
    start: vi.fn(),
    stop: vi.fn(),
  };
  return {
    state: 'running',
    currentTime: 1,
    destination: {},
    createOscillator: vi.fn(() => oscillator),
    createGain: vi.fn(() => gainNode),
    resume: vi.fn(async () => {}),
  } as unknown as AudioContext;
}

describe('InTuneConfirmation (M73)', () => {
  it('fires exactly once on the transition into in-tune', () => {
    const confirmation = new InTuneConfirmation();
    expect(confirmation.push('near')).toBe(false);
    expect(confirmation.push('in-tune')).toBe(true);
    expect(confirmation.push('in-tune')).toBe(false);
    expect(confirmation.push('in-tune')).toBe(false);
  });

  it('re-arms after the note leaves the in-tune state', () => {
    const confirmation = new InTuneConfirmation();
    expect(confirmation.push('in-tune')).toBe(true);
    expect(confirmation.push('out')).toBe(false);
    expect(confirmation.push('in-tune')).toBe(true);
    expect(confirmation.push('silent')).toBe(false);
    expect(confirmation.push('in-tune')).toBe(true);
  });

  it('reset re-arms immediately', () => {
    const confirmation = new InTuneConfirmation();
    expect(confirmation.push('in-tune')).toBe(true);
    confirmation.reset();
    expect(confirmation.push('in-tune')).toBe(true);
  });
});

describe('fireInTuneFeedback channels (M73)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('runs only the enabled channels', () => {
    const audioContext = createFakeAudioContext();
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate });

    const all = fireInTuneFeedback(
      { sound: true, vibrate: true, flash: true },
      { audioContext, reducedMotion: false },
    );
    expect(all).toEqual({ flashed: true, played: true, vibrated: true });
    expect(vibrate).toHaveBeenCalledTimes(1);

    const none = fireInTuneFeedback(
      { sound: false, vibrate: false, flash: false },
      { audioContext, reducedMotion: false },
    );
    expect(none).toEqual({ flashed: false, played: false, vibrated: false });
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('suppresses the flash when reduced motion is requested', () => {
    const result = fireInTuneFeedback(
      { sound: false, vibrate: false, flash: true },
      { audioContext: null, reducedMotion: true },
    );
    expect(result.flashed).toBe(false);
  });

  it('fails soft when the platform lacks vibration support', () => {
    vi.stubGlobal('navigator', {});
    expect(vibrateInTune()).toBe(false);
  });
});

describe('playInTuneBeep (M73)', () => {
  it('schedules a two-note blip on the provided context', () => {
    const audioContext = createFakeAudioContext();
    expect(playInTuneBeep(audioContext)).toBe(true);
    expect(audioContext.createOscillator).toHaveBeenCalledTimes(2);
  });

  it('returns false instead of throwing without a context', () => {
    expect(playInTuneBeep(null)).toBe(false);
  });
});

describe('readout stability mapping (M62)', () => {
  it('maps 0..1 stability to a descending EMA alpha', () => {
    expect(stabilityToAlpha(0)).toBeCloseTo(1);
    expect(stabilityToAlpha(1)).toBeCloseTo(0.08);
    expect(stabilityToAlpha(0.5)).toBeGreaterThan(stabilityToAlpha(0.9));
    expect(stabilityToAlpha(0.5)).toBeLessThan(stabilityToAlpha(0.1));
  });

  it('clamps out-of-range and non-numeric input', () => {
    expect(stabilityToAlpha(-5)).toBe(stabilityToAlpha(0));
    expect(stabilityToAlpha(42)).toBe(stabilityToAlpha(1));
    expect(stabilityToAlpha(Number.NaN)).toBe(stabilityToAlpha(0));
  });

  it('round-trips segmented presets through nearestStabilityPreset', () => {
    expect(nearestStabilityPreset(READOUT_STABILITY_PRESETS.low)).toBe('low');
    expect(nearestStabilityPreset(READOUT_STABILITY_PRESETS.medium)).toBe('medium');
    expect(nearestStabilityPreset(READOUT_STABILITY_PRESETS.high)).toBe('high');
    expect(nearestStabilityPreset(0.5)).toBe('medium');
  });
});

describe('CentsStabilizer (M62)', () => {
  it('passes the first reading through, then smooths', () => {
    const stabilizer = new CentsStabilizer();
    stabilizer.setStability(0.5);
    expect(stabilizer.add(10)).toBe(10);
    const next = stabilizer.add(20);
    expect(next).toBeGreaterThan(10);
    expect(next).toBeLessThan(20);
  });

  it('smooths harder at higher stability', () => {
    const soft = new CentsStabilizer();
    soft.setStability(0.1);
    soft.add(0);
    const softStep = soft.add(100) ?? 0;

    const hard = new CentsStabilizer();
    hard.setStability(0.9);
    hard.add(0);
    const hardStep = hard.add(100) ?? 0;

    expect(softStep).toBeGreaterThan(hardStep);
  });

  it('resets on null (lost detection)', () => {
    const stabilizer = new CentsStabilizer();
    stabilizer.add(30);
    expect(stabilizer.add(null)).toBeNull();
    expect(stabilizer.add(5)).toBe(5);
  });
});

describe('feedback & stability settings persistence (M62/M73)', () => {
  it('has the required defaults', () => {
    const defaults = createDefaultSettings();
    expect(defaults.feedbackFlash).toBe(true);
    expect(defaults.feedbackSound).toBe(false);
    expect(defaults.feedbackVibrate).toBe(false);
    expect(defaults.readoutStability).toBe(0.5);
  });

  it('normalizes persisted values and drops garbage', () => {
    const normalized = normalizePersistedSettings({
      feedbackFlash: 'yes',
      feedbackSound: true,
      feedbackVibrate: 1,
      readoutStability: 7,
    } as never);
    expect(normalized.feedbackFlash).toBe(true);
    expect(normalized.feedbackSound).toBe(true);
    expect(normalized.feedbackVibrate).toBe(false);
    expect(normalized.readoutStability).toBe(1);
    expect(normalizePersistedSettings({ readoutStability: -2 }).readoutStability).toBe(0);
  });

  it('persists feedback toggles and stability through the settings store', async () => {
    const save = vi.fn(async () => {});
    const store = createSettingsStore({ load: async () => ({}), save });
    await store.load();

    store.feedbackSound.value = true;
    store.feedbackFlash.value = false;
    store.readoutStability.value = 0.9;
    await store.save();

    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({
      feedbackFlash: false,
      feedbackSound: true,
      feedbackVibrate: false,
      readoutStability: 0.9,
    }));
    store.dispose();
  });

  it('hydrates feedback settings from storage', async () => {
    const store = createSettingsStore({
      load: async () => ({ feedbackVibrate: true, readoutStability: 0.2 }),
      save: async () => {},
    });
    await store.load();
    expect(store.feedbackVibrate.value).toBe(true);
    expect(store.readoutStability.value).toBe(0.2);
    expect(store.feedbackFlash.value).toBe(true);
    store.dispose();
  });
});
