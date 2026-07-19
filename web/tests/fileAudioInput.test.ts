import { afterEach, describe, expect, it, vi } from 'vitest';
import { useFileAudioInput } from '../src/composables/useFileAudioInput';

describe('FileAudioInputPort', () => {
  afterEach(() => vi.restoreAllMocks());

  it('advances overlapping windows on the source sample clock', async () => {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const input = useFileAudioInput(4);
    input.load({
      channels: 1,
      sampleRate: 1_000,
      samples: Float32Array.from({ length: 100 }, (_, index) => index),
    }, 'timeline.wav');

    expect(await input.start()).toBe(true);
    const first = input.readFrame()!;
    expect(Array.from(first.buffer)).toEqual([0, 1, 2, 3]);
    expect(first.timebase).toEqual({ endSample: 4, source: 'file', startSample: 0 });

    expect(input.beginExactPcmCapture()).toBe(true);
    now = 34;
    const second = input.readFrame()!;
    expect(Array.from(second.buffer)).toEqual([33, 34, 35, 36]);
    expect(second.timebase).toEqual({ endSample: 37, source: 'file', startSample: 33 });

    const capture = input.finishExactPcmCapture()!;
    expect(capture.startSample).toBe(0);
    expect(capture.endSample).toBe(37);
    expect(capture.samples[36]).toBe(36);
  });

  it('ends cleanly after the final source window', async () => {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const input = useFileAudioInput(4);
    input.load({
      channels: 1,
      sampleRate: 1_000,
      samples: Float32Array.from([1, 2, 3, 4]),
    }, 'short.wav');
    await input.start();

    expect(input.readFrame()).not.toBeNull();
    expect(input.beginExactPcmCapture()).toBe(true);
    now = 34;
    expect(input.readFrame()).toBeNull();
    expect(input.isListening.value).toBe(false);
    await input.stop();
    expect(Array.from(input.finishExactPcmCapture()!.samples)).toEqual([1, 2, 3, 4]);
  });
});
