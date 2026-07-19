import { describe, expect, it, vi } from 'vitest';
import { useNativeAudioInput } from '../src/composables/useNativeAudioInput';
import type { NativeInvoke, NativeListen } from '../src/platform/nativeAudioApi';

describe('native audio input adapter', () => {
  it('surfaces a failed native teardown instead of reporting silent success', async () => {
    const invoke = vi.fn(async (command: string) => {
      if (command === 'native_audio_available') return true;
      if (command === 'stop_native_audio') throw new Error('native stream did not stop');
      return null;
    }) as NativeInvoke;
    const unlisten = vi.fn();
    const listen = vi.fn(async () => unlisten) as unknown as NativeListen;
    const adapter = useNativeAudioInput(async () => ({ invoke, listen }));

    await adapter.refreshAvailability();
    expect(await adapter.start()).toBe(true);
    expect(adapter.isListening.value).toBe(true);
    expect(invoke.mock.calls.filter(([command]) => (
      command === 'native_audio_available'
    ))).toHaveLength(1);

    await expect(adapter.stop()).rejects.toThrow('native stream did not stop');
    expect(adapter.error.value).toBe('native stream did not stop');
    expect(adapter.isListening.value).toBe(false);
    expect(unlisten).toHaveBeenCalledOnce();
  });
});
