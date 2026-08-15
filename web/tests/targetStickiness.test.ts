import { describe, expect, it } from 'vitest';
import { nextTick, ref } from 'vue';
import { createSettingsStore } from '../src/composables/useSettings';
import { useTuningState } from '../src/composables/useTuningState';
import { TUNINGS } from '../src/utils/notes';

// E2 (82.41) and A2 (110) sit either side of ~95.2 Hz; readings wobbling a
// few cents around that midpoint used to flip the auto target every frame,
// slamming the cents needle across the whole scale.
describe('auto target stickiness', () => {
  it('keeps the current target through jitter around the midpoint', () => {
    const frequency = ref<number | null>(null);
    const settings = createSettingsStore({
      load: async () => ({}),
      save: async () => {},
    });
    const state = useTuningState(frequency, { settings });

    frequency.value = 95.0; // closest string: E2, just below the midpoint
    expect(state.targetNote.value.name).toBe('E');

    // Nudged just past the midpoint: A2 is now nominally closer, but only
    // by ~11 cents - the sticky margin keeps the target on E2.
    frequency.value = 95.5;
    expect(state.targetNote.value.name).toBe('E');

    // Decisively closer to A2: the target switches.
    frequency.value = 104.0;
    expect(state.targetNote.value.name).toBe('A');

    // Silence clears the stickiness; the next reading picks fresh.
    frequency.value = null;
    frequency.value = 95.0;
    expect(state.targetNote.value.name).toBe('E');
    settings.dispose();
  });
});

describe('stored tuning selection', () => {
  it('recovers from a stored tuning id that no longer exists', async () => {
    const frequency = ref<number | null>(null);
    const settings = createSettingsStore({
      load: async () => ({ lastTuningId: 'deleted-custom-tuning' }),
      save: async () => {},
    });
    await settings.load();
    const state = useTuningState(frequency, { settings });
    await nextTick();

    // Storage normalization resolves the dangling id, so the session starts
    // on a real tuning instead of an empty selection.
    expect(settings.lastTuningId.value).not.toBe('deleted-custom-tuning');
    expect(state.currentTuning.value.id).toBe(settings.lastTuningId.value);
    expect(state.strings.value.length).toBeGreaterThan(0);
    settings.dispose();
  });

  it('applies a stored custom tuning once it is available', async () => {
    const frequency = ref<number | null>(null);
    const custom = {
      id: 'custom-mine',
      instrument: 'guitar' as const,
      name: 'Mine',
      strings: TUNINGS.find((tuning) => tuning.id === 'standard')!.strings,
    };
    const settings = createSettingsStore({
      load: async () => ({ customTunings: [custom], lastTuningId: 'custom-mine' }),
      save: async () => {},
    });
    await settings.load();
    const state = useTuningState(frequency, { settings });
    await nextTick();

    expect(state.currentTuning.value.id).toBe('custom-mine');
    expect(settings.lastTuningId.value).toBe('custom-mine');
    settings.dispose();
  });
});
