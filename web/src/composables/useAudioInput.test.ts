import { afterEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import { useAudioInput } from './useAudioInput';

describe('useAudioInput start cancellation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('stops a stream that resolves after stop and never resurrects listening state', async () => {
    let resolveStream!: (stream: MediaStream) => void;
    const getUserMedia = vi.fn(() => new Promise<MediaStream>((resolve) => {
      resolveStream = resolve;
    }));
    const stopTrack = vi.fn();
    const track = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      stop: stopTrack,
    } as unknown as MediaStreamTrack;
    const stream = {
      getAudioTracks: () => [track],
      getTracks: () => [track],
    } as unknown as MediaStream;

    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: vi.fn(async () => []),
        getUserMedia,
      },
    });

    const audio = useAudioInput(ref(''));
    const firstStart = audio.start();
    const duplicateStart = audio.start();
    expect(audio.isStarting.value).toBe(true);
    expect(getUserMedia).toHaveBeenCalledTimes(1);

    audio.stop();
    resolveStream(stream);
    await Promise.all([firstStart, duplicateStart]);

    expect(stopTrack).toHaveBeenCalledOnce();
    expect(audio.isListening.value).toBe(false);
    expect(audio.isStarting.value).toBe(false);
    expect(audio.analyser.value).toBeNull();
  });
});
