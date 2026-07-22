import { computed, ref, type Ref } from 'vue';
import { useAudioInput } from './useAudioInput';
import { useNativeAudioInput } from './useNativeAudioInput';
import { usePitchLoop } from './usePitchLoop';
import { useSyntheticAudioInput } from './useSyntheticAudioInput';
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
  const isStarting = ref(false);
  let generation = 0;
  let startPromise: Promise<void> | null = null;
  let startPromiseGeneration = -1;

  const usingSyntheticAudio = computed(() => syntheticAudio.enabled.value);
  const usingNativeAudio = computed(() => (
    !usingSyntheticAudio.value &&
    options.audioBackend.value === 'native' &&
    nativeAudio.available.value
  ));

  const pitch = usePitchLoop(
    () => usingSyntheticAudio.value ? syntheticAudio.readFrame() : audio.readFrame(),
    detectionRange,
  );

  const detectionFrame = computed<DetectionFrame>(() => {
    if (usingNativeAudio.value) {
      return nativeAudio.frame.value ?? createDetectionFrame(null, 0, 0, 0);
    }
    return createDetectionFrame(
      pitch.smoothedFrequency.value,
      pitch.confidence.value,
      pitch.rms.value,
      pitch.volume.value,
    );
  });
  const detectedFrequency = computed(() => detectionFrame.value.freq);

  const isListening = computed(() => {
    if (usingSyntheticAudio.value) return syntheticAudio.isListening.value;
    return usingNativeAudio.value ? nativeAudio.isListening.value : audio.isListening.value;
  });

  const error = computed(() => {
    if (usingSyntheticAudio.value) return syntheticAudio.error.value;
    return usingNativeAudio.value ? nativeAudio.error.value : audio.error.value;
  });

  const volume = computed(() => detectionFrame.value.level);

  async function start(range: PitchDetectionRange = detectionRange.value) {
    setDetectionRange(range);
    if (isListening.value) return;
    if (startPromise && startPromiseGeneration === generation) return startPromise;

    const token = generation;
    const precedingStart = startPromise;
    isStarting.value = true;
    const operation = (async () => {
      if (precedingStart) {
        await precedingStart.catch(() => {});
      }
      if (token !== generation || isListening.value) return;

      if (!usingSyntheticAudio.value && options.audioBackend.value === 'native') {
        await nativeAudio.refreshAvailability();
        if (token !== generation) return;
      }

      if (usingSyntheticAudio.value) {
        pitch.reset();
        audio.stop();
        void nativeAudio.stop();
        syntheticAudio.start();
        if (token === generation && syntheticAudio.isListening.value) {
          pitch.start();
        }
        return;
      }

      if (usingNativeAudio.value) {
        pitch.reset();
        audio.stop();
        syntheticAudio.stop();
        await nativeAudio.start(detectionRange.value);
        if (token !== generation) void nativeAudio.stop();
        return;
      }

      syntheticAudio.stop();
      void nativeAudio.stop();
      await audio.start();
      if (token !== generation) {
        audio.stop();
      } else if (audio.isListening.value) {
        pitch.reset();
        pitch.start();
      }
    })();

    startPromise = operation;
    startPromiseGeneration = token;
    try {
      await operation;
    } finally {
      if (startPromise === operation) {
        startPromise = null;
        startPromiseGeneration = -1;
      }
      if (token === generation) {
        isStarting.value = false;
      }
    }
  }

  function stop() {
    generation += 1;
    isStarting.value = false;
    pitch.stop();
    audio.stop();
    syntheticAudio.stop();
    void nativeAudio.stop();
  }

  function resetDetection() {
    pitch.reset();
  }

  function setDetectionRange(range: PitchDetectionRange) {
    detectionRange.value = range;
    void nativeAudio.setRange(range);
  }

  function clearError() {
    audio.clearError();
    nativeAudio.clearError();
    syntheticAudio.clearError();
  }

  async function setInputDevice(deviceId: string) {
    const shouldRestart = !usingSyntheticAudio.value && !usingNativeAudio.value &&
      (isListening.value || isStarting.value);
    options.selectedInputDeviceId.value = deviceId;
    if (!shouldRestart) return;
    stop();
    await start();
  }

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
    isStarting,
    nativeAudioAvailable: nativeAudio.available,
    refreshInputDevices: audio.refreshInputDevices,
    resetDetection,
    selectedInputDeviceId: audio.selectedInputDeviceId,
    setDetectionRange,
    setInputDevice,
    start,
    stop,
    syntheticAudioFixture: syntheticAudio.fixture,
    usingNativeAudio,
    usingSyntheticAudio,
    volume,
    webAudioListening: audio.isListening,
  };
}

function createDetectionFrame(
  freq: number | null,
  confidence: number,
  rms: number,
  level: number,
): DetectionFrame {
  return {
    freq,
    confidence: freq == null ? 0 : confidence,
    rms,
    level,
    cents: 0,
    note: '—',
    target: null,
    inTune: false,
    isPower: false,
  };
}
