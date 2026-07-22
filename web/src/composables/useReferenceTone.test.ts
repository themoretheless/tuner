import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';

import { useReferenceTone } from './useReferenceTone';

describe('useReferenceTone ownership', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('stops replaced timed tones and follows continuous target changes', async () => {
    vi.useFakeTimers();
    const oscillators: Array<{
      connect: ReturnType<typeof vi.fn>;
      disconnect: ReturnType<typeof vi.fn>;
      frequency: { value: number };
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
      type: OscillatorType;
    }> = [];

    class FakeAudioContext {
      currentTime = 0;
      destination = {};
      state: AudioContextState = 'running';
      close = vi.fn(async () => {});
      resume = vi.fn(async () => {});

      createOscillator() {
        const oscillator = {
          connect: vi.fn(),
          disconnect: vi.fn(),
          frequency: { value: 0 },
          start: vi.fn(),
          stop: vi.fn(),
          type: 'sine' as OscillatorType,
        };
        oscillators.push(oscillator);
        return oscillator;
      }

      createGain() {
        return {
          connect: vi.fn(),
          disconnect: vi.fn(),
          gain: {
            exponentialRampToValueAtTime: vi.fn(),
            setValueAtTime: vi.fn(),
            value: 0,
          },
        };
      }

      createBiquadFilter() {
        return {
          connect: vi.fn(),
          disconnect: vi.fn(),
          frequency: { value: 0 },
          type: 'lowpass' as BiquadFilterType,
        };
      }
    }

    vi.stubGlobal('window', {
      AudioContext: FakeAudioContext,
      clearTimeout,
      setTimeout,
    });

    const target = ref({ name: 'A' as const, octave: 4, frequency: 440 });
    const tone = useReferenceTone(() => target.value);
    tone.playTimedTone(target.value, 1500);
    tone.playTimedTone({ name: 'E', octave: 4, frequency: 329.63 }, 1500);
    expect(oscillators[0].stop).toHaveBeenCalledOnce();

    tone.playReferenceTone();
    const firstReference = oscillators[2];
    target.value = { name: 'A', octave: 4, frequency: 442 };
    await nextTick();
    expect(firstReference.stop).toHaveBeenCalledOnce();
    expect(oscillators.at(-1)?.frequency.value).toBe(442);

    tone.cleanupReferenceAudio();
    expect(oscillators.at(-1)?.stop).toHaveBeenCalledOnce();
  });
});
