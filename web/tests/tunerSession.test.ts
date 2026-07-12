import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';

import { useTunerSession } from '../src/composables/useTunerSession';
import { MIN_USABLE_PITCH_CONFIDENCE } from '../src/utils/pitch';
import { resolveSyntheticAudioFixture } from '../src/utils/syntheticAudio';
import type { AudioBackend } from '../src/utils/settingsStorage';

describe('useTunerSession', () => {
  let now = 0;
  let nextRafId = 1;
  let timers: Map<number, ReturnType<typeof setTimeout>>;

  beforeEach(() => {
    now = 0;
    nextRafId = 1;
    timers = new Map();
    vi.useFakeTimers();
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const id = nextRafId;
      nextRafId += 1;
      const timer = setTimeout(() => {
        now += 34;
        callback(now);
      }, 0);
      timers.set(id, timer);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      const timer = timers.get(id);
      if (timer) clearTimeout(timer);
      timers.delete(id);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('runs detection through the synthetic audio session path', async () => {
    const audioBackend = ref<AudioBackend>('web');
    const selectedInputDeviceId = ref('');
    const session = useTunerSession({
      audioBackend,
      selectedInputDeviceId,
      syntheticFixture: resolveSyntheticAudioFixture('E2'),
    });

    await session.start({ minFrequency: 60, maxFrequency: 120 });
    expect(session.status.value).toBe('listening');
    for (let i = 0; i < 4; i += 1) {
      await vi.runOnlyPendingTimersAsync();
      await nextTick();
    }

    expect(session.usingSyntheticAudio.value).toBe(true);
    expect(session.isListening.value).toBe(true);
    expect(session.volume.value).toBeGreaterThan(0);
    expect(session.detectionFrame.value.level).toBeGreaterThan(0);
    expect(session.detectionFrame.value.confidence).toBeGreaterThanOrEqual(MIN_USABLE_PITCH_CONFIDENCE);
    expect(session.detectionFrame.value.confidence).toBeLessThanOrEqual(1);
    expect(session.detectedFrequency.value).not.toBeNull();
    expect(session.detectionFrame.value.freq).toBe(session.detectedFrequency.value);
    expect(Math.abs(session.detectedFrequency.value! - 82.4069)).toBeLessThan(1.5);

    await session.stop();
    expect(session.status.value).toBe('idle');
    expect(session.isListening.value).toBe(false);
    expect(session.detectedFrequency.value).toBeNull();
    expect(session.detectionFrame.value.freq).toBeNull();
    expect(session.detectionFrame.value.level).toBe(0);
  });
});
