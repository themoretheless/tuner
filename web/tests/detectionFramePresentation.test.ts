import { effectScope, ref } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDetectionFramePresentation } from '../src/composables/useDetectionFramePresentation';
import { createUnresolvedDetectionFrame } from '../src/domain/detectionFrame';
import {
  hasPriorityTransition,
  interpolateDetectionFrame,
  PRESENTATION_TRANSITION_MS,
} from '../src/session/detectionFramePresentation';

function frame(frequency: number | null, cents = 0) {
  return {
    ...createUnresolvedDetectionFrame({
      confidence: frequency == null ? 0 : 0.8,
      freq: frequency,
      level: frequency == null ? 0 : 0.5,
      rms: frequency == null ? 0 : 0.05,
      pipeline: { decision: frequency == null ? 'no-candidate' : 'published' },
    }),
    cents,
    note: frequency == null ? '—' : 'E2',
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('detection frame presentation', () => {
  it('interpolates visual values without fabricating diagnostic telemetry', () => {
    const previous = frame(80, -20);
    const next = frame(84, 20);
    const presented = interpolateDetectionFrame(previous, next, 0.5);

    expect(presented.freq).toBeCloseTo(Math.sqrt(80 * 84), 6);
    expect(presented.cents).toBeCloseTo(0, 6);
    expect(presented.pipeline).toBe(next.pipeline);
    expect(presented.rawFreq).toBe(next.rawFreq);
  });

  it('publishes acquisition, loss and note changes without interpolation', () => {
    const idle = frame(null);
    const acquired = frame(82.4);
    const nextNote = { ...acquired, note: 'F2' };

    expect(hasPriorityTransition(idle, acquired)).toBe(true);
    expect(interpolateDetectionFrame(idle, acquired, 0)).toBe(acquired);
    expect(interpolateDetectionFrame(acquired, idle, 0)).toBe(idle);
    expect(interpolateDetectionFrame(acquired, nextNote, 0)).toBe(nextNote);
  });

  it('updates visual state immediately without interrupting numeric interpolation', () => {
    const previous = frame(82.4, 0);
    const next = {
      ...frame(82.8, 8),
      inTune: true,
      isPower: true,
      pipeline: { ...frame(82.8, 8).pipeline, decision: 'held' as const },
    };
    const presented = interpolateDetectionFrame(previous, next, 0.5);

    expect(hasPriorityTransition(previous, next)).toBe(false);
    expect(presented.cents).toBe(4);
    expect(presented.freq).toBeGreaterThan(previous.freq!);
    expect(presented.freq).toBeLessThan(next.freq!);
    expect(presented.inTune).toBe(true);
    expect(presented.isPower).toBe(true);
    expect(presented.pipeline).toBe(next.pipeline);
  });

  it('uses the newest source frame when several arrive before repaint', () => {
    let repaint: FrameRequestCallback = () => {
      throw new Error('requestAnimationFrame callback was not registered');
    };
    vi.spyOn(performance, 'now').mockReturnValue(0);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      repaint = callback;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const source = ref(frame(82.4));
    const scope = effectScope();
    const presented = scope.run(() => useDetectionFramePresentation(source));
    source.value = frame(82.6, 4);
    source.value = frame(82.8, 8);

    expect(presented?.value.freq).toBe(82.4);
    repaint(PRESENTATION_TRANSITION_MS);
    expect(presented?.value.freq).toBeCloseTo(82.8, 6);
    expect(presented?.value.cents).toBe(8);
    scope.stop();
  });
});
