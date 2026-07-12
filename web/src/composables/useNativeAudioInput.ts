import { onUnmounted, ref, type Ref } from 'vue';
import type {
  AudioInputStartOptions,
  DetectionFrameInputPort,
} from '../ports/audioInput';
import type { PitchDetectionRange } from '../utils/pitch';
import type { DetectionFrame, FrameContext } from '../types/frames';
import {
  cloneNativeAudioConfiguration,
  createNativeAudioConfiguration,
  normalizeNativeFrame,
  withNativeAudioRange,
  withNativeFrameContext,
  type NativeAudioConfiguration,
  type NativeAudioFramePayload,
} from '../platform/nativeAudioContract';

type InvokeFn = (command: string, args?: Record<string, unknown>) => Promise<unknown>;
type ListenFn = <T>(event: string, handler: (event: { payload: T }) => void) => Promise<() => void>;

export interface NativeAudioInputAdapter extends DetectionFrameInputPort {
  available: Ref<boolean>;
  error: Ref<string | null>;
  frame: Ref<DetectionFrame | null>;
  isListening: Ref<boolean>;
  refreshAvailability(): Promise<boolean>;
}

export function useNativeAudioInput(): NativeAudioInputAdapter {
  const available = ref(false);
  const error = ref<string | null>(null);
  const frame = ref<DetectionFrame | null>(null);
  const isListening = ref(false);

  let invokeFn: InvokeFn | null = null;
  let listenFn: ListenFn | null = null;
  let unlisten: (() => void) | null = null;
  let configuration: NativeAudioConfiguration = createNativeAudioConfiguration();
  let configurationSync: Promise<void> | null = null;
  let configurationRevision = 0;
  let syncedConfigurationRevision = 0;

  async function loadApi() {
    if (invokeFn && listenFn) return true;

    try {
      const core = await import('@tauri-apps/api/core');
      const event = await import('@tauri-apps/api/event');
      invokeFn = core.invoke as InvokeFn;
      listenFn = event.listen as ListenFn;
      return true;
    } catch {
      return false;
    }
  }

  async function refreshAvailability() {
    if (!await loadApi() || !invokeFn) {
      available.value = false;
      return false;
    }

    try {
      available.value = Boolean(await invokeFn('native_audio_available'));
    } catch {
      available.value = false;
    }
    return available.value;
  }

  async function start(options: AudioInputStartOptions) {
    updateRange(options.range);
    error.value = null;
    if (!await refreshAvailability() || !invokeFn || !listenFn) {
      error.value = 'Native audio backend unavailable';
      return false;
    }
    if (isListening.value) {
      await syncConfiguration();
      return true;
    }

    try {
      unlisten = await listenFn<NativeAudioFramePayload>('native-audio-frame', (event) => {
        frame.value = normalizeNativeFrame(event.payload);
      });
      const startRevision = configurationRevision;
      await invokeFn('start_native_audio', {
        config: cloneNativeAudioConfiguration(configuration),
      });
      syncedConfigurationRevision = startRevision;
      isListening.value = true;
      if (configurationRevision !== startRevision) await syncConfiguration();
      return true;
    } catch (nativeError) {
      cleanupListener();
      error.value = nativeError instanceof Error ? nativeError.message : String(nativeError);
      return false;
    }
  }

  async function stop() {
    cleanupListener();
    isListening.value = false;
    frame.value = null;
    await configurationSync;
    if (invokeFn) {
      try {
        await invokeFn('stop_native_audio');
      } catch {
        // The stream may already be gone during app shutdown.
      }
    }
  }

  async function setDetectionRange(range: PitchDetectionRange) {
    updateRange(range);
    await syncConfiguration();
  }

  async function setFrameContext(context: FrameContext) {
    configuration = withNativeFrameContext(configuration, context);
    configurationRevision += 1;
    await syncConfiguration();
  }

  function updateRange(range: PitchDetectionRange) {
    configuration = withNativeAudioRange(configuration, range);
    configurationRevision += 1;
  }

  function syncConfiguration() {
    if (
      !isListening.value
      || !invokeFn
      || syncedConfigurationRevision === configurationRevision
    ) return Promise.resolve();
    if (configurationSync) return configurationSync;

    const invoke = invokeFn;
    let failed = false;
    configurationSync = (async () => {
      while (
        isListening.value
        && syncedConfigurationRevision !== configurationRevision
      ) {
        const revision = configurationRevision;
        const snapshot = cloneNativeAudioConfiguration(configuration);
        try {
          await invoke('configure_native_audio', { config: snapshot });
          syncedConfigurationRevision = revision;
        } catch {
          failed = true;
          return;
        }
      }
    })().finally(() => {
      configurationSync = null;
      if (
        !failed
        && isListening.value
        && syncedConfigurationRevision !== configurationRevision
      ) void syncConfiguration();
    });
    return configurationSync;
  }

  function cleanupListener() {
    unlisten?.();
    unlisten = null;
  }

  function clearError() {
    error.value = null;
  }

  void refreshAvailability();
  onUnmounted(() => {
    void stop();
  });

  return {
    available,
    clearError,
    error,
    frame,
    id: 'native',
    isListening,
    output: 'detection-frame',
    refreshAvailability,
    setDetectionRange,
    setFrameContext,
    start,
    stop,
  };
}
