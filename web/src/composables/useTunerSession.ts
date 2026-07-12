import { computed, onUnmounted, ref, watch, type Ref } from 'vue';
import { useAudioInput } from './useAudioInput';
import { useNativeAudioInput } from './useNativeAudioInput';
import { usePitchLoop } from './usePitchLoop';
import { useSyntheticAudioInput } from './useSyntheticAudioInput';
import {
  isAudioFrameInputPort,
  isDetectionFrameInputPort,
  type AudioInputPort,
  type AudioInputPortRegistry,
} from '../ports/audioInput';
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

interface TunerSessionOptions {
  audioBackend: Ref<AudioBackend>;
  selectedInputDeviceId: Ref<string>;
  syntheticFixture?: SyntheticAudioFixture | null;
}

export function useTunerSession(options: TunerSessionOptions) {
  const audio = useAudioInput(options.selectedInputDeviceId);
  const nativeAudio = useNativeAudioInput();
  const syntheticAudio = useSyntheticAudioInput(
    'syntheticFixture' in options ? options.syntheticFixture ?? null : syntheticAudioFixtureFromLocation(),
  );
  const inputPorts: AudioInputPortRegistry = {
    web: audio,
    native: nativeAudio,
    synthetic: syntheticAudio,
  };
  const detectionRange = ref<PitchDetectionRange>({ ...DEFAULT_PITCH_DETECTION_RANGE });
  const frameContext = ref<FrameContext>(createDefaultFrameContext());
  const lifecycleSnapshot = ref<SessionLifecycleSnapshot>({
    activeBackend: null,
    status: 'idle',
  });

  const usingSyntheticAudio = computed(() => syntheticAudio.enabled.value);
  const usingNativeAudio = computed(() => (
    !usingSyntheticAudio.value &&
    options.audioBackend.value === 'native' &&
    nativeAudio.available.value
  ));

  function requestedBackend(): SessionBackend {
    if (usingSyntheticAudio.value) return 'synthetic';
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
  );

  const detectionFrame = computed<DetectionFrame>(() => {
    const port = activeInputPort.value;
    if (isDetectionFrameInputPort(port)) {
      return port.frame.value ?? createUnresolvedDetectionFrame();
    }
    return pitch.detectionFrame.value;
  });
  const detectedFrequency = computed(() => detectionFrame.value.freq);
  const detectionFrameResolved = computed(() => (
    isDetectionFrameInputPort(activeInputPort.value)
      || pitch.frameSemantics.value === 'resolved'
  ));

  const error = computed(() => {
    return activeInputPort.value.error.value;
  });

  const status = computed(() => {
    const state = lifecycleSnapshot.value.status;
    if (error.value && state !== 'idle' && state !== 'stopping') return 'error';
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

  watch(error, (currentError) => {
    if (
      currentError
      && (lifecycleSnapshot.value.status === 'starting'
        || lifecycleSnapshot.value.status === 'listening')
    ) {
      void lifecycle.fail();
    }
  });

  async function start(range: PitchDetectionRange = detectionRange.value) {
    setDetectionRange(range);
    await lifecycle.start(requestedBackend());
  }

  async function startAdapter(backend: SessionBackend) {
    clearError();
    pitch.reset();
    const port = inputPorts[backend];
    const started = await port.start({ range: detectionRange.value });
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
    const shouldRestart = status.value === 'starting' || status.value === 'listening';
    if (shouldRestart) await stop();
    options.audioBackend.value = backend;
    if (shouldRestart) await start();
  }

  async function setInputDevice(deviceId: string) {
    const shouldRestart = isListening.value && lifecycleSnapshot.value.activeBackend === 'web';
    if (shouldRestart) await stop();
    options.selectedInputDeviceId.value = deviceId;
    if (shouldRestart) await start();
  }

  function clearError() {
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
    currentFrequency: computed(() => (
      isDetectionFrameInputPort(activeInputPort.value)
        ? detectionFrame.value.freq
        : pitch.currentFrequency.value
    )),
    detectionFrame,
    detectionFrameResolved,
    detectorBackend: computed(() => (
      isDetectionFrameInputPort(activeInputPort.value)
        ? 'native' as const
        : pitch.detectorBackend.value
    )),
    detectedFrequency,
    detectionRange,
    error,
    inputDevices: audio.inputDevices,
    isListening,
    nativeAudioAvailable: nativeAudio.available,
    refreshInputDevices: audio.refreshInputDevices,
    resetDetection,
    selectedInputDeviceId: audio.selectedInputDeviceId,
    setAudioBackend,
    setDetectionRange,
    setFrameContext,
    setInputDevice,
    start,
    status,
    stop,
    syntheticAudioFixture: syntheticAudio.fixture,
    usingNativeAudio,
    usingSyntheticAudio,
    volume,
    webAudioListening: audio.isListening,
  };
}
