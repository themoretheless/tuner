import { computed, onUnmounted, ref, watch, type Ref } from 'vue';
import { useAudioInput } from './useAudioInput';
import { useNativeAudioInput } from './useNativeAudioInput';
import { usePitchLoop } from './usePitchLoop';
import { useSyntheticAudioInput } from './useSyntheticAudioInput';
import {
  SessionLifecycle,
  type SessionBackend,
  type SessionLifecycleSnapshot,
} from '../session/sessionLifecycle';
import { DEFAULT_PITCH_DETECTION_RANGE, type PitchDetectionRange } from '../utils/pitch';
import type { AudioBackend } from '../utils/settingsStorage';
import { syntheticAudioFixtureFromLocation, type SyntheticAudioFixture } from '../utils/syntheticAudio';
import type { DetectionFrame } from '../types/frames';

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
  const detectionRange = ref<PitchDetectionRange>({ ...DEFAULT_PITCH_DETECTION_RANGE });
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

  const pitch = usePitchLoop(
    () => usingSyntheticAudio.value ? syntheticAudio.readFrame() : audio.readFrame(),
    detectionRange,
  );

  const detectionFrame = computed<DetectionFrame>(() => {
    if (usingNativeAudio.value) {
      return nativeAudio.frame.value ?? createDetectionFrame(null, 0);
    }
    return createDetectionFrame(pitch.smoothedFrequency.value, pitch.volume.value);
  });
  const detectedFrequency = computed(() => detectionFrame.value.freq);

  const error = computed(() => {
    if (usingSyntheticAudio.value) return syntheticAudio.error.value;
    return usingNativeAudio.value ? nativeAudio.error.value : audio.error.value;
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

    if (backend === 'synthetic') {
      pitch.reset();
      syntheticAudio.start();
      if (syntheticAudio.isListening.value) {
        pitch.start();
      }
      return syntheticAudio.isListening.value;
    }

    if (backend === 'native') {
      await nativeAudio.start(detectionRange.value);
      return nativeAudio.isListening.value;
    }

    await audio.start();
    if (audio.isListening.value) {
      pitch.start();
    }
    return audio.isListening.value;
  }

  async function stopAdapter(backend: SessionBackend) {
    pitch.stop();
    if (backend === 'web') audio.stop();
    if (backend === 'synthetic') syntheticAudio.stop();
    if (backend === 'native') await nativeAudio.stop();
  }

  function stop() {
    return lifecycle.stop();
  }

  function resetDetection() {
    pitch.reset();
  }

  function setDetectionRange(range: PitchDetectionRange) {
    detectionRange.value = range;
    void nativeAudio.setRange(range);
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
    audio.clearError();
    nativeAudio.clearError();
    syntheticAudio.clearError();
  }

  function adapterIsListening(backend: SessionBackend | null) {
    if (backend === 'synthetic') return syntheticAudio.isListening.value;
    if (backend === 'native') return nativeAudio.isListening.value;
    if (backend === 'web') return audio.isListening.value;
    return false;
  }

  onUnmounted(() => {
    void stop();
  });

  return {
    analyser: audio.analyser,
    audioSampleRate: audio.sampleRate,
    clearError,
    currentFrequency: computed(() => usingNativeAudio.value ? detectionFrame.value.freq : pitch.currentFrequency.value),
    detectionFrame,
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

function createDetectionFrame(freq: number | null, level: number): DetectionFrame {
  return {
    freq,
    confidence: freq == null ? 0 : 1,
    rms: 0,
    level,
    cents: 0,
    note: '—',
    target: null,
    inTune: false,
    isPower: false,
  };
}
