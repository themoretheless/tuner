import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const tauri = vi.hoisted(() => ({
  invoke: vi.fn(),
  listen: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: tauri.invoke }));
vi.mock('@tauri-apps/api/event', () => ({ listen: tauri.listen }));

import { useNativeAudioInput, type NativeAudioApi } from './useNativeAudioInput';

describe('useNativeAudioInput transaction', () => {
  let handlers: Map<string, (event: { payload: unknown }) => void>;
  let unlisteners: Map<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    handlers = new Map();
    unlisteners = new Map();
    tauri.invoke.mockImplementation(async (command: string) => (
      command === 'native_audio_available' ? true : undefined
    ));
    tauri.listen.mockImplementation(async (
      event: string,
      handler: (value: { payload: unknown }) => void,
    ) => {
      handlers.set(event, handler);
      const unlisten = vi.fn();
      unlisteners.set(event, unlisten);
      return unlisten;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('subscribes frame and error events before start and clears both on runtime failure', async () => {
    const audio = useNativeAudioInput({
      invoke: tauri.invoke as NativeAudioApi['invoke'],
      listen: tauri.listen as NativeAudioApi['listen'],
    });
    await audio.start({ minFrequency: 60, maxFrequency: 400 });

    expect(audio.error.value).toBeNull();
    expect(handlers.has('native-audio-frame')).toBe(true);
    expect(handlers.has('native-audio-error')).toBe(true);
    const startInvocation = tauri.invoke.mock.invocationCallOrder.find((_, index) => (
      tauri.invoke.mock.calls[index][0] === 'start_native_audio'
    ));
    const lastListenInvocation = tauri.listen.mock.invocationCallOrder.at(-1);
    expect(startInvocation).toBeDefined();
    expect(lastListenInvocation).toBeDefined();
    expect(startInvocation!).toBeGreaterThan(lastListenInvocation!);
    expect(audio.isListening.value).toBe(true);

    handlers.get('native-audio-frame')?.({
      payload: {
        cents: 0,
        confidence: 0.9,
        freq: 110,
        inTune: true,
        isPower: false,
        level: 0.5,
        note: 'A2',
        rms: 0.03,
        target: null,
      },
    });
    expect(audio.frame.value?.freq).toBe(110);

    handlers.get('native-audio-error')?.({ payload: 'raw host error details' });
    expect(audio.error.value).toBe('Native audio stream stopped unexpectedly');
    expect(audio.isListening.value).toBe(false);
    expect(audio.frame.value).toBeNull();
    expect(unlisteners.get('native-audio-frame')).toHaveBeenCalledOnce();
    expect(unlisteners.get('native-audio-error')).toHaveBeenCalledOnce();
  });
});
