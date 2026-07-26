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
import {
  normalizeDiagnosticCodes,
  type DiagnosticCode,
} from '../domain/diagnostics';
import type { DetectionFrame, FrameContext } from '../types/frames';
import {
  cloneNativeAudioConfiguration,
  createNativeAudioConfiguration,
  NATIVE_AUDIO_ERROR_EVENT,
  NATIVE_AUDIO_FRAME_EVENT,
  NATIVE_AUDIO_RECOVERY_EVENT,
  normalizeNativeAudioError,
  normalizeNativeAudioRecovery,
  normalizeNativeFrame,
  withNativeAudioRange,
  withNativeFrameContext,
  withNativePipelineConfig,
  type NativeAudioConfiguration,
  type NativeAudioErrorPayload,
  type NativeAudioFramePayload,
  type NativeAudioRecoveryPayload,
} from '../platform/nativeAudioContract';

export interface NativeAudioInputAdapter extends DetectionFrameInputPort {
  available: Ref<boolean>;
  error: Ref<string | null>;
  /** Stable diagnostic code attached to the current error, when typed. */
  errorCode: Ref<DiagnosticCode | null>;
  frame: Ref<DetectionFrame | null>;
  isListening: Ref<boolean>;
  /** Signal-quality diagnostic codes reported by the native engine. */
  signalDiagnostics: Ref<DiagnosticCode[]>;
  /** Stream-loss recovery telemetry codes reported by the native backend. */
  recoveryDiagnostics: Ref<DiagnosticCode[]>;
  refreshAvailability(): Promise<boolean>;
}

export function useNativeAudioInput(
  apiLoader: NativeAudioApiLoader = loadNativeAudioApi,
): NativeAudioInputAdapter {
  const available = ref(false);
  const error = ref<string | null>(null);
  const errorCode = ref<DiagnosticCode | null>(null);
  const frame = ref<DetectionFrame | null>(null);
  const isListening = ref(false);
  const signalDiagnostics = ref<DiagnosticCode[]>([]);
  const recoveryDiagnostics = ref<DiagnosticCode[]>([]);

  let invokeFn: NativeInvoke | null = null;
  let listenFn: NativeListen | null = null;
  let availabilitySync: Promise<boolean> | null = null;
  let unlistenError: (() => void) | null = null;
  let unlistenFrame: (() => void) | null = null;
  let unlistenRecovery: (() => void) | null = null;
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
    errorCode.value = null;
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
      unlistenError = await listenFn<NativeAudioErrorPayload>(NATIVE_AUDIO_ERROR_EVENT, (event) => {
        const nativeError = normalizeNativeAudioError(event.payload);
        error.value = nativeError.message;
        errorCode.value = nativeError.code;
        frame.value = null;
        signalDiagnostics.value = [];
        isListening.value = false;
        cleanupListeners();
      });
      unlistenRecovery = await listenFn<NativeAudioRecoveryPayload>(
        NATIVE_AUDIO_RECOVERY_EVENT,
        (event) => {
          const recovery = normalizeNativeAudioRecovery(event.payload);
          if (recovery) applyRecoveryEvent(recovery.code);
        },
      );
      unlistenFrame = await listenFn<NativeAudioFramePayload>(NATIVE_AUDIO_FRAME_EVENT, (event) => {
        frame.value = normalizeNativeFrame(event.payload);
        signalDiagnostics.value = normalizeDiagnosticCodes(event.payload?.signal);
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
      if (isListening.value && invokeFn) {
        await invokeFn('stop_native_audio').catch(() => {});
      }
      cleanupListeners();
      isListening.value = false;
      frame.value = null;
      signalDiagnostics.value = [];
      if (!error.value) {
        error.value = nativeError instanceof Error ? nativeError.message : String(nativeError);
        errorCode.value = null;
      }
      return false;
    }
  }

  /** Reduce one recovery telemetry event into the visible diagnostics list. */
  function applyRecoveryEvent(code: DiagnosticCode) {
    switch (code) {
      case 'backend-stream-lost':
        recoveryDiagnostics.value = ['backend-stream-lost'];
        break;
      case 'backend-recovery-attempted':
        recoveryDiagnostics.value = ['backend-stream-lost', 'backend-recovery-attempted'];
        break;
      case 'backend-recovery-succeeded':
        recoveryDiagnostics.value = ['backend-recovery-succeeded'];
        break;
      case 'backend-recovery-failed':
        recoveryDiagnostics.value = ['backend-recovery-failed'];
        break;
      default:
        break;
    }
  }

  async function stop() {
    await configurationSync?.catch(() => {});
    try {
      if (invokeFn) {
        await invokeFn('stop_native_audio');
      }
    } catch (cause) {
      const nativeError = cause instanceof Error ? cause : new Error(String(cause));
      error.value = nativeError.message;
      throw nativeError;
    } finally {
      cleanupListeners();
      isListening.value = false;
      frame.value = null;
      signalDiagnostics.value = [];
      recoveryDiagnostics.value = [];
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
        } catch (cause) {
          failed = true;
          const nativeError = cause instanceof Error ? cause : new Error(String(cause));
          error.value = nativeError.message;
          throw nativeError;
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

  function cleanupListeners() {
    unlistenError?.();
    unlistenFrame?.();
    unlistenRecovery?.();
    unlistenError = null;
    unlistenFrame = null;
    unlistenRecovery = null;
  }

  function clearError() {
    error.value = null;
    errorCode.value = null;
  }

  void refreshAvailability();
  onUnmounted(() => {
    void stop().catch(() => {});
  });

  return {
    available,
    clearError,
    detectorBackend: 'native',
    error,
    errorCode,
    frame,
    id: 'native',
    isListening,
    output: 'detection-frame',
    recoveryDiagnostics,
    refreshAvailability,
    setDetectionRange,
    setFrameContext,
    setPipelineConfig,
    signalDiagnostics,
    start,
    stop,
  };
}
