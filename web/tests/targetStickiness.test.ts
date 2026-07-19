import { describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { createSettingsStore } from '../src/composables/useSettings';
import { useTuningState } from '../src/composables/useTuningState';

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
