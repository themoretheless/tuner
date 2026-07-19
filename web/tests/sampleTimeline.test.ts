import { describe, expect, it } from 'vitest';
import { SampleTimeline } from '../src/audio/sampleTimeline';

describe('SampleTimeline', () => {
  it('publishes the latest ordered window with an exact sample timebase', () => {
    const timeline = new SampleTimeline(4, 48_000);
    timeline.append(100, Float32Array.from([1, 2, 3, 4]));

    expect(Array.from(timeline.latestFrame()!.buffer)).toEqual([1, 2, 3, 4]);
    expect(timeline.latestFrame()!.timebase).toEqual({
      endSample: 104,
      source: 'worklet',
      startSample: 100,
    });

    timeline.append(104, Float32Array.from([5, 6]));
    expect(Array.from(timeline.latestFrame()!.buffer)).toEqual([3, 4, 5, 6]);
    expect(timeline.latestFrame()!.timebase?.startSample).toBe(102);
  });

  it('preserves gaps as silence and reports dropped source samples', () => {
    const timeline = new SampleTimeline(4, 48_000);
    timeline.append(100, Float32Array.from([1, 2, 3, 4]));
    expect(timeline.beginCapture()).toBe(true);

    timeline.append(106, Float32Array.from([7, 8]));
    const capture = timeline.finishCapture()!;

    expect(capture.startSample).toBe(104);
    expect(capture.endSample).toBe(108);
    expect(capture.droppedSamples).toBe(2);
    expect(Array.from(capture.samples)).toEqual([0, 0, 7, 8]);
  });

  it('trims overlapping worklet messages instead of duplicating samples', () => {
    const timeline = new SampleTimeline(4, 44_100);
    timeline.append(0, Float32Array.from([1, 2, 3]));
    timeline.append(2, Float32Array.from([3, 4, 5]));

    expect(Array.from(timeline.latestFrame()!.buffer)).toEqual([2, 3, 4, 5]);
    expect(timeline.latestFrame()!.timebase?.endSample).toBe(5);
  });
});
