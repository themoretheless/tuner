import { onUnmounted, ref, type Ref } from 'vue';
import type { DetectionFrameInputPort } from '../ports/audioInput';
import {
  loadNativeAudioApi,
  type NativeAudioApiLoader,
  type NativeInvoke,
  type NativeListen,
} from '../platform/nativeAudioApi';
import type { PitchDetectionRange } from '../utils/pitch';
import type { PipelineConfig } from '../domain/pipelineConfig';
import type { DetectionFrame, FrameContext } from '../types/frames';
import {
  cloneNativeAudioConfiguration,
  createNativeAudioConfiguration,
  normalizeNativeFrame,
  withNativeAudioRange,
  withNativeFrameContext,
  withNativePipelineConfig,
  type NativeAudioConfiguration,
  type NativeAudioFramePayload,
} from '../platform/nativeAudioContract';

export interface NativeAudioInputAdapter extends DetectionFrameInputPort {
  available: Ref<boolean>;
  error: Ref<string | null>;
  frame: Ref<DetectionFrame | null>;
  isListening: Ref<boolean>;
  refreshAvailability(): Promise<boolean>;
}

export function useNativeAudioInput(
  apiLoader: NativeAudioApiLoader = loadNativeAudioApi,
): NativeAudioInputAdapter {
  const available = ref(false);
  const error = ref<string | null>(null);
  const frame = ref<DetectionFrame | null>(null);
  const isListening = ref(false);

  let invokeFn: NativeInvoke | null = null;
  let listenFn: NativeListen | null = null;
  let availabilitySync: Promise<boolean> | null = null;
  let unlisten: (() => void) | null = null;
  let configuration: NativeAudioConfiguration = createNativeAudioConfiguration();
  let configurationSync: Promise<void> | null = null;
  let configurationRevision = 0;
  let syncedConfigurationRevision = 0;

  async function loadApi() {
    if (invokeFn && listenFn) return true;

    try {
      const api = await apiLoader();
      if (!api) return false;
      invokeFn = api.invoke;
      listenFn = api.listen;
      return true;
    } catch {
      return false;
    }
  }

  function refreshAvailability() {
    if (availabilitySync) return availabilitySync;
    availabilitySync = (async () => {
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
    })().finally(() => {
      availabilitySync = null;
    });
    return availabilitySync;
  }

  async function start() {
    error.value = null;
    const isAvailable = available.value || await refreshAvailability();
    if (!isAvailable || !invokeFn || !listenFn) {
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
    await configurationSync;
    error.value = null;
    try {
      if (invokeFn) {
        await invokeFn('stop_native_audio');
      }
    } catch (cause) {
      const nativeError = cause instanceof Error ? cause : new Error(String(cause));
      error.value = nativeError.message;
      throw nativeError;
    } finally {
      cleanupListener();
      isListening.value = false;
      frame.value = null;
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

  async function setPipelineConfig(config: PipelineConfig) {
    configuration = withNativePipelineConfig(configuration, config);
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
    void stop().catch(() => {});
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
    setPipelineConfig,
    start,
    stop,
  };
}
