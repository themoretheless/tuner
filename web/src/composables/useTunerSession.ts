import { computed, onUnmounted, ref, watch, type Ref } from 'vue';
import { useAudioInput } from './useAudioInput';
import { useFileAudioInput } from './useFileAudioInput';
import { useNativeAudioInput } from './useNativeAudioInput';
import { usePitchLoop } from './usePitchLoop';
import { useSyntheticAudioInput } from './useSyntheticAudioInput';
import {
  isAudioFrameInputPort,
  isDetectionFrameInputPort,
  isExactPcmCaptureInputPort,
  isDiagnosableAudioInputPort,
  type ExactPcmCapture,
  type ExactPcmCaptureInputPort,
  type AudioInputPort,
  type AudioInputPortRegistry,
} from '../ports/audioInput';
import { decodeWav } from '../audio/wav';
import {
  SessionLifecycle,
  type SessionBackend,
  type SessionLifecycleSnapshot,
} from '../session/sessionLifecycle';
import { DEFAULT_PITCH_DETECTION_RANGE, type PitchDetectionRange } from '../utils/pitch';
import type { AudioBackend } from '../utils/settingsStorage';
import { syntheticAudioFixtureFromLocation, type SyntheticAudioFixture } from '../utils/syntheticAudio';
import type { DetectionFrame, FrameContext } from '../types/frames';
import { createDefaultFrameContext } from '../domain/frameContext';
import { createUnresolvedDetectionFrame } from '../domain/detectionFrame';
import { createDefaultPipelineConfig, type PipelineConfig } from '../domain/pipelineConfig';

const MAX_WAV_FILE_BYTES = 64 * 1024 * 1024;

interface TunerSessionOptions {
  audioBackend: Ref<AudioBackend>;
  pipelineConfig?: Ref<PipelineConfig>;
  selectedInputDeviceId: Ref<string>;
  syntheticFixture?: SyntheticAudioFixture | null;
}

export function useTunerSession(options: TunerSessionOptions) {
  const audio = useAudioInput(options.selectedInputDeviceId);
  const fileAudio = useFileAudioInput();
  const nativeAudio = useNativeAudioInput();
  const syntheticAudio = useSyntheticAudioInput(
    'syntheticFixture' in options ? options.syntheticFixture ?? null : syntheticAudioFixtureFromLocation(),
  );
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

  const usingSyntheticAudio = computed(() => syntheticAudio.enabled.value);
  const usingFileAudio = computed(() => (
    !usingSyntheticAudio.value && fileMode.value && fileAudio.available.value
  ));
  const usingNativeAudio = computed(() => (
    !usingSyntheticAudio.value &&
    !usingFileAudio.value &&
    options.audioBackend.value === 'native' &&
    nativeAudio.available.value
  ));

  function requestedBackend(): SessionBackend {
    if (usingSyntheticAudio.value) return 'synthetic';
    if (usingFileAudio.value) return 'file';
    return usingNativeAudio.value ? 'native' : 'web';
  }

  const activeInputPort = computed<AudioInputPort>(() => (
    inputPorts[lifecycleSnapshot.value.activeBackend ?? requestedBackend()]
  ));

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
      if (isDetectionFrameInputPort(port)) void port.setPipelineConfig(config);
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
  const error = computed(() => loadError.value ?? adapterError.value);
  const inputDiagnostics = computed(() => {
    const port = activeInputPort.value;
    return isDiagnosableAudioInputPort(port) ? port.inputDiagnostics.value : null;
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
      void lifecycle.fail();
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
      if (isDetectionFrameInputPort(port)) void port.setDetectionRange(range);
    }
  }

  function setFrameContext(context: FrameContext) {
    frameContext.value = context;
    for (const port of Object.values(inputPorts)) {
      if (isDetectionFrameInputPort(port)) void port.setFrameContext(context);
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
    const sessionBackend = lifecycleSnapshot.value.activeBackend ?? requestedBackend();
    const shouldRestart = (
      status.value === 'starting' || status.value === 'listening'
    ) && sessionBackend === 'web';
    if (shouldRestart) await stop();
    audio.selectInputDevice(deviceId);
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
  }

  function adapterIsListening(backend: SessionBackend | null) {
    return backend ? inputPorts[backend].isListening.value : false;
  }

  onUnmounted(() => {
    void stop();
  });

  return {
    analyser: audio.analyser,
    audioSampleRate: audio.sampleRate,
    clearError,
    currentFrequency: computed(() => detectionFrame.value.freq),
    detectionFrame,
    detectionFrameTimebase: computed(() => (
      isDetectionFrameInputPort(activeInputPort.value) ? null : pitch.frameTimebase.value
    )),
    detectionFrameResolved,
    detectorBackend: computed(() => (
      isDetectionFrameInputPort(activeInputPort.value)
        ? 'native' as const
        : pitch.detectorBackend.value
    )),
    detectedFrequency,
    detectionRange,
    error,
    exactPcmCaptureAvailable: computed(() => {
      const port = activeInputPort.value;
      return isExactPcmCaptureInputPort(port) && port.exactPcmCaptureAvailable.value;
    }),
    beginExactPcmCapture,
    finishExactPcmCapture,
    fileAudioDuration: fileAudio.durationSeconds,
    fileAudioName: fileAudio.fileName,
    fileAudioProgress: fileAudio.progress,
    inputDevices: audio.inputDevices,
    inputDiagnostics,
    isListening,
    nativeAudioAvailable: nativeAudio.available,
    refreshInputDevices: audio.refreshInputDevices,
    resetDetection,
    selectedInputDeviceId: audio.selectedInputDeviceId,
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
