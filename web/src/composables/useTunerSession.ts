import { computed, onUnmounted, ref, watch, type Ref } from 'vue';
import { usePitchLoop } from './usePitchLoop';
import {
  isAudioFrameInputPort,
  isDeviceSelectableAudioInputPort,
  isDetectionFrameInputPort,
  isExactPcmCaptureInputPort,
  isDiagnosableAudioInputPort,
  type ExactPcmCapture,
  type ExactPcmCaptureInputPort,
  type AudioInputPort,
  type AudioInputPortRegistry,
} from '../ports/audioInput';
import type { TunerInputSet } from '../ports/tunerInputSet';
import { decodeWav } from '../audio/wav';
import {
  SessionLifecycle,
  type SessionBackend,
  type SessionLifecycleSnapshot,
} from '../session/sessionLifecycle';
import { DEFAULT_PITCH_DETECTION_RANGE, type PitchDetectionRange } from '../utils/pitch';
import type { AudioBackend } from '../utils/settingsStorage';
import type { DetectionFrame, FrameContext } from '../types/frames';
import { createDefaultFrameContext } from '../domain/frameContext';
import { createUnresolvedDetectionFrame } from '../domain/detectionFrame';
import { createDefaultPipelineConfig, type PipelineConfig } from '../domain/pipelineConfig';
import {
  createDiagnostic,
  diagnosticsFromInputWarnings,
  diagnosticsFromMicrophoneFailure,
  microphoneTrackLostDiagnostic,
  nativeStreamFailedDiagnostic,
  signalDiagnostics,
  type DiagnosticSource,
  type TunerDiagnostic,
} from '../domain/diagnostics';

const MAX_WAV_FILE_BYTES = 64 * 1024 * 1024;

interface TunerSessionOptions {
  audioBackend: Ref<AudioBackend>;
  inputs: TunerInputSet;
  pipelineConfig?: Ref<PipelineConfig>;
  selectedInputDeviceId: Ref<string>;
}

export function useTunerSession(options: TunerSessionOptions) {
  const audio = options.inputs.web;
  const fileAudio = options.inputs.file;
  const nativeAudio = options.inputs.native;
  const syntheticAudio = options.inputs.synthetic;
  const inputPorts: AudioInputPortRegistry = {
    file: fileAudio,
    web: audio,
    native: nativeAudio,
    synthetic: syntheticAudio,
  };
  const detectionRange = ref<PitchDetectionRange>({ ...DEFAULT_PITCH_DETECTION_RANGE });
  const frameContext = ref<FrameContext>(createDefaultFrameContext());
  const pipelineConfig = options.pipelineConfig ?? ref(createDefaultPipelineConfig());
  const fileMode = ref(false);
  const loadError = ref<string | null>(null);
  const lifecycleSnapshot = ref<SessionLifecycleSnapshot>({
    activeBackend: null,
    failure: null,
    status: 'idle',
  });
  let exactCapturePort: ExactPcmCaptureInputPort | null = null;
  let fileLoadRevision = 0;

  const syntheticInputRequested = computed(() => syntheticAudio.enabled.value);
  const fileInputRequested = computed(() => (
    !syntheticInputRequested.value && fileMode.value && fileAudio.available.value
  ));
  const nativeInputRequested = computed(() => (
    !syntheticInputRequested.value &&
    !fileInputRequested.value &&
    options.audioBackend.value === 'native' &&
    nativeAudio.available.value
  ));

  function requestedBackend(): SessionBackend {
    if (syntheticInputRequested.value) return 'synthetic';
    if (fileInputRequested.value) return 'file';
    return nativeInputRequested.value ? 'native' : 'web';
  }

  const effectiveInputId = computed<SessionBackend>(() => (
    lifecycleSnapshot.value.activeBackend ?? requestedBackend()
  ));
  const activeInputId = computed(() => lifecycleSnapshot.value.activeBackend);
  const requestedInputId = computed(requestedBackend);
  const usingSyntheticAudio = computed(() => effectiveInputId.value === 'synthetic');
  const usingFileAudio = computed(() => effectiveInputId.value === 'file');
  const usingNativeAudio = computed(() => effectiveInputId.value === 'native');

  const activeInputPort = computed<AudioInputPort>(() => (
    inputPorts[effectiveInputId.value]
  ));
  const deviceInputPort = computed(() => {
    const port = activeInputPort.value;
    return isDeviceSelectableAudioInputPort(port) ? port : null;
  });

  const pitch = usePitchLoop(
    () => {
      const port = activeInputPort.value;
      return isAudioFrameInputPort(port) ? port.readFrame() : null;
    },
    detectionRange,
    frameContext,
    pipelineConfig,
  );

  watch(pipelineConfig, (config) => {
    for (const port of Object.values(inputPorts)) {
      if (isDetectionFrameInputPort(port)) void port.setPipelineConfig(config).catch(() => {});
    }
  }, { deep: true, immediate: true });

  const sourceDetectionFrame = computed<DetectionFrame>(() => {
    const port = activeInputPort.value;
    if (isDetectionFrameInputPort(port)) {
      return port.frame.value ?? createUnresolvedDetectionFrame();
    }
    return pitch.detectionFrame.value;
  });
  const detectionFrame = sourceDetectionFrame;
  const detectedFrequency = computed(() => detectionFrame.value.freq);
  const detectionFrameResolved = computed(() => (
    isDetectionFrameInputPort(activeInputPort.value)
      || pitch.frameSemantics.value === 'resolved'
  ));

  const adapterError = computed(() => activeInputPort.value.error.value);
  const lifecycleError = computed(() => {
    const failure = lifecycleSnapshot.value.failure;
    if (!failure) return null;
    return failure.message ?? `Audio ${failure.operation} failed`;
  });
  const error = computed(() => loadError.value ?? adapterError.value ?? lifecycleError.value);
  const inputDiagnostics = computed(() => {
    const port = activeInputPort.value;
    return isDiagnosableAudioInputPort(port) ? port.inputDiagnostics.value : null;
  });

  // Unified typed user-facing diagnostics, shared shape across platforms.
  // The web backend contributes typed mic failures, track loss, processing
  // warnings and signal health measured in the pitch loop; the native (Tauri)
  // backend contributes its typed stream failure plus the signal-quality
  // codes computed inside the native engine.
  const diagnostics = computed<TunerDiagnostic[]>(() => {
    const result: TunerDiagnostic[] = [];
    const backend = effectiveInputId.value;
    const source: DiagnosticSource = backend === 'native' ? 'tauri' : 'web';
    if (backend === 'native') {
      if (nativeAudio.error.value) {
        result.push(nativeStreamFailedDiagnostic('tauri'));
      }
      for (const code of nativeAudio.signalDiagnostics.value) {
        result.push(createDiagnostic(code, 'tauri'));
      }
      return result;
    }
    if (audio.startFailure.value) {
      result.push(...diagnosticsFromMicrophoneFailure(audio.startFailure.value, 'web'));
    }
    if (audio.trackLost.value) {
      result.push(microphoneTrackLostDiagnostic('web'));
    }
    const processing = inputDiagnostics.value;
    if (processing) {
      result.push(...diagnosticsFromInputWarnings(processing.warnings, source));
    }
    const health = pitch.signalHealth.value;
    if (health && isListening.value) {
      result.push(...signalDiagnostics(health, source));
    }
    return result;
  });

  const status = computed(() => {
    const state = lifecycleSnapshot.value.status;
    if (adapterError.value && state !== 'idle' && state !== 'stopping') return 'error';
    return state;
  });
  const isListening = computed(() => status.value === 'listening' && adapterIsListening(
    lifecycleSnapshot.value.activeBackend,
  ));

  const volume = computed(() => detectionFrame.value.level);

  const lifecycle = new SessionLifecycle({
    start: startAdapter,
    stop: stopAdapter,
  }, {
    onChange(snapshot) {
      lifecycleSnapshot.value = snapshot;
    },
  });

  watch(adapterError, (currentError) => {
    if (
      currentError
      && (lifecycleSnapshot.value.status === 'starting'
        || lifecycleSnapshot.value.status === 'listening')
    ) {
      void lifecycle.fail(currentError);
    }
  });

  watch(
    () => ({
      error: activeInputPort.value.error.value,
      listening: activeInputPort.value.isListening.value,
    }),
    ({ error: adapterError, listening }) => {
      if (
        !listening
        && !adapterError
        && lifecycleSnapshot.value.status === 'listening'
      ) {
        void lifecycle.stop();
      }
    },
  );

  async function start(range: PitchDetectionRange = detectionRange.value) {
    setDetectionRange(range);
    await lifecycle.start(requestedBackend());
  }

  async function startAdapter(backend: SessionBackend) {
    clearError();
    pitch.reset();
    const port = inputPorts[backend];
    const started = await port.start();
    if (started && isAudioFrameInputPort(port)) {
      pitch.start();
    }
    return started && port.isListening.value;
  }

  async function stopAdapter(backend: SessionBackend) {
    pitch.stop();
    await inputPorts[backend].stop();
  }

  function stop() {
    return lifecycle.stop();
  }

  function resetDetection() {
    pitch.reset();
  }

  function setDetectionRange(range: PitchDetectionRange) {
    detectionRange.value = range;
    for (const port of Object.values(inputPorts)) {
      if (isDetectionFrameInputPort(port)) void port.setDetectionRange(range).catch(() => {});
    }
  }

  function setFrameContext(context: FrameContext) {
    frameContext.value = context;
    for (const port of Object.values(inputPorts)) {
      if (isDetectionFrameInputPort(port)) void port.setFrameContext(context).catch(() => {});
    }
  }

  async function setAudioBackend(backend: AudioBackend) {
    if (backend !== 'web' && backend !== 'native') return;
    fileLoadRevision += 1;
    const shouldRestart = status.value === 'starting' || status.value === 'listening';
    if (shouldRestart) await stop();
    fileMode.value = false;
    options.audioBackend.value = backend;
    if (shouldRestart) await start();
  }

  async function setInputDevice(deviceId: string) {
    fileLoadRevision += 1;
    const port = deviceInputPort.value;
    if (!port) return;
    const sessionBackend = lifecycleSnapshot.value.activeBackend ?? requestedBackend();
    const shouldRestart = (
      status.value === 'starting' || status.value === 'listening'
    ) && sessionBackend === port.id;
    if (shouldRestart) await stop();
    port.selectInputDevice(deviceId);
    if (shouldRestart) await start();
  }

  async function loadAudioFile(file: File) {
    const loadRevision = ++fileLoadRevision;
    loadError.value = null;
    if (typeof file.size === 'number' && file.size > MAX_WAV_FILE_BYTES) {
      loadError.value = 'WAV file is larger than the 64 MB import limit';
      return false;
    }
    let decoded;
    try {
      decoded = decodeWav(await file.arrayBuffer());
    } catch (cause) {
      if (loadRevision !== fileLoadRevision) return false;
      loadError.value = cause instanceof Error ? cause.message : 'Unable to read WAV file';
      return false;
    }
    if (loadRevision !== fileLoadRevision) return false;

    if (status.value !== 'idle') await stop();
    if (loadRevision !== fileLoadRevision) return false;
    fileAudio.load(decoded, file.name);
    fileMode.value = true;
    await start();
    return loadRevision === fileLoadRevision
      && usingFileAudio.value
      && status.value === 'listening';
  }

  async function useMicrophoneInput() {
    fileLoadRevision += 1;
    const shouldRestart = status.value === 'starting' || status.value === 'listening';
    if (shouldRestart) await stop();
    fileMode.value = false;
    loadError.value = null;
    if (shouldRestart) await start();
  }

  function beginExactPcmCapture() {
    if (exactCapturePort) return false;
    const port = activeInputPort.value;
    if (!isExactPcmCaptureInputPort(port) || !port.beginExactPcmCapture()) return false;
    exactCapturePort = port;
    return true;
  }

  function finishExactPcmCapture(): ExactPcmCapture | null {
    const port = exactCapturePort;
    exactCapturePort = null;
    return port?.finishExactPcmCapture() ?? null;
  }

  function clearError() {
    loadError.value = null;
    for (const port of Object.values(inputPorts)) port.clearError();
    lifecycle.clearFailure();
  }

  function adapterIsListening(backend: SessionBackend | null) {
    return backend ? inputPorts[backend].isListening.value : false;
  }

  onUnmounted(() => {
    void stop();
  });

  return {
    activeInputId,
    analyser: computed(() => audio.analyser.value),
    audioSampleRate: computed(() => audio.sampleRate.value),
    clearError,
    currentFrequency: computed(() => detectionFrame.value.freq),
    detectionFrame,
    detectionFrameTimebase: computed(() => (
      isDetectionFrameInputPort(activeInputPort.value) ? null : pitch.frameTimebase.value
    )),
    detectionFrameResolved,
    detectorBackend: computed(() => (
      isDetectionFrameInputPort(activeInputPort.value)
        ? activeInputPort.value.detectorBackend
        : pitch.detectorBackend.value
    )),
    detectedFrequency,
    detectionRange,
    diagnostics,
    error,
    exactPcmCaptureAvailable: computed(() => {
      const port = activeInputPort.value;
      return isExactPcmCaptureInputPort(port) && port.exactPcmCaptureAvailable.value;
    }),
    beginExactPcmCapture,
    finishExactPcmCapture,
    fileAudioDuration: computed(() => fileAudio.durationSeconds.value),
    fileAudioName: computed(() => fileAudio.fileName.value),
    fileAudioProgress: computed(() => fileAudio.progress.value),
    inputDevices: computed(() => deviceInputPort.value?.inputDevices.value ?? []),
    inputDiagnostics,
    isListening,
    nativeAudioAvailable: computed(() => nativeAudio.available.value),
    refreshInputDevices: () => deviceInputPort.value?.refreshInputDevices() ?? Promise.resolve(),
    requestedInputId,
    resetDetection,
    selectedInputDeviceId: computed(() => (
      deviceInputPort.value?.selectedInputDeviceId.value ?? options.selectedInputDeviceId.value
    )),
    setAudioBackend,
    setDetectionRange,
    setFrameContext,
    setInputDevice,
    loadAudioFile,
    start,
    status,
    stop,
    syntheticAudioFixture: syntheticAudio.fixture,
    usingNativeAudio,
    usingFileAudio,
    useMicrophoneInput,
    usingSyntheticAudio,
    volume,
    webAudioListening: audio.isListening,
  };
}
