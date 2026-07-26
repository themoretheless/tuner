import { describe, expect, it, vi } from 'vitest';
import { useNativeAudioInput } from '../src/composables/useNativeAudioInput';
import type { NativeInvoke, NativeListen } from '../src/platform/nativeAudioApi';

describe('native audio input adapter', () => {
  it('surfaces a failed native teardown instead of reporting silent success', async () => {
    const invokeMock = vi.fn(async (command: string) => {
      if (command === 'native_audio_available') return true;
      if (command === 'stop_native_audio') throw new Error('native stream did not stop');
      return null;
    });
    const invoke = invokeMock as NativeInvoke;
    const unlisten = vi.fn();
    const listen = vi.fn(async () => unlisten) as unknown as NativeListen;
    const adapter = useNativeAudioInput(async () => ({ invoke, listen }));

    await adapter.refreshAvailability();
    expect(await adapter.start()).toBe(true);
    expect(adapter.isListening.value).toBe(true);
    expect(invokeMock.mock.calls.filter(([command]) => (
      command === 'native_audio_available'
    ))).toHaveLength(1);

    await expect(adapter.stop()).rejects.toThrow('native stream did not stop');
    expect(adapter.error.value).toBe('native stream did not stop');
    expect(adapter.isListening.value).toBe(false);
    expect(unlisten).toHaveBeenCalledTimes(3);
  });

  it('turns a native runtime event into a terminal adapter failure', async () => {
    const handlers = new Map<string, (event: { payload: unknown }) => void>();
    const invoke = vi.fn(async (command: string) => (
      command === 'native_audio_available' ? true : null
    )) as NativeInvoke;
    const unlisten = vi.fn();
    const listen = vi.fn(async (event: string, handler: (event: { payload: unknown }) => void) => {
      handlers.set(event, handler);
      return unlisten;
    }) as unknown as NativeListen;
    const adapter = useNativeAudioInput(async () => ({ invoke, listen }));

    await adapter.refreshAvailability();
    expect(await adapter.start()).toBe(true);
    handlers.get('native-audio-error')?.({ payload: { message: 'Microphone disconnected' } });

    expect(adapter.error.value).toBe('Microphone disconnected');
    expect(adapter.frame.value).toBeNull();
    expect(adapter.isListening.value).toBe(false);
    expect(unlisten).toHaveBeenCalledTimes(3);
  });

  it('tracks typed recovery telemetry without killing the session', async () => {
    const handlers = new Map<string, (event: { payload: unknown }) => void>();
    const invoke = vi.fn(async (command: string) => (
      command === 'native_audio_available' ? true : null
    )) as NativeInvoke;
    const listen = vi.fn(async (event: string, handler: (event: { payload: unknown }) => void) => {
      handlers.set(event, handler);
      return vi.fn();
    }) as unknown as NativeListen;
    const adapter = useNativeAudioInput(async () => ({ invoke, listen }));

    await adapter.refreshAvailability();
    expect(await adapter.start()).toBe(true);

    handlers.get('native-audio-recovery')?.({
      payload: { code: 'backend-stream-lost', reason: 'device unplugged' },
    });
    expect(adapter.recoveryDiagnostics.value).toEqual(['backend-stream-lost']);
    expect(adapter.isListening.value).toBe(true);
    expect(adapter.error.value).toBeNull();

    handlers.get('native-audio-recovery')?.({
      payload: { code: 'backend-recovery-attempted', attempt: 1, maxAttempts: 3 },
    });
    expect(adapter.recoveryDiagnostics.value).toEqual([
      'backend-stream-lost',
      'backend-recovery-attempted',
    ]);

    handlers.get('native-audio-recovery')?.({
      payload: { code: 'backend-recovery-succeeded', attempt: 1 },
    });
    expect(adapter.recoveryDiagnostics.value).toEqual(['backend-recovery-succeeded']);
    expect(adapter.isListening.value).toBe(true);

    // Unknown payloads are ignored.
    handlers.get('native-audio-recovery')?.({ payload: { code: 'not-a-code' } });
    expect(adapter.recoveryDiagnostics.value).toEqual(['backend-recovery-succeeded']);
  });

  it('surfaces an exhausted recovery as a typed fatal error', async () => {
    const handlers = new Map<string, (event: { payload: unknown }) => void>();
    const invoke = vi.fn(async (command: string) => (
      command === 'native_audio_available' ? true : null
    )) as NativeInvoke;
    const listen = vi.fn(async (event: string, handler: (event: { payload: unknown }) => void) => {
      handlers.set(event, handler);
      return vi.fn();
    }) as unknown as NativeListen;
    const adapter = useNativeAudioInput(async () => ({ invoke, listen }));

    await adapter.refreshAvailability();
    expect(await adapter.start()).toBe(true);

    handlers.get('native-audio-recovery')?.({
      payload: { code: 'backend-recovery-failed', reason: 'device gone', attempts: 3 },
    });
    expect(adapter.recoveryDiagnostics.value).toEqual(['backend-recovery-failed']);
    expect(adapter.isListening.value).toBe(true);

    handlers.get('native-audio-error')?.({
      payload: {
        message: 'Audio input stream could not be recovered — reconnect the input device',
        code: 'backend-recovery-failed',
      },
    });
    expect(adapter.errorCode.value).toBe('backend-recovery-failed');
    expect(adapter.isListening.value).toBe(false);
  });

  it('rejects configuration updates that native did not accept', async () => {
    const invoke = vi.fn(async (command: string) => {
      if (command === 'native_audio_available') return true;
      if (command === 'configure_native_audio') throw new Error('configuration rejected');
      return null;
    }) as NativeInvoke;
    const listen = vi.fn(async () => vi.fn()) as unknown as NativeListen;
    const adapter = useNativeAudioInput(async () => ({ invoke, listen }));

    await adapter.refreshAvailability();
    expect(await adapter.start()).toBe(true);
    await expect(adapter.setDetectionRange({
      minFrequency: 50,
      maxFrequency: 500,
    })).rejects.toThrow('configuration rejected');

    expect(adapter.error.value).toBe('configuration rejected');
  });
});
