import { computed, ref, type Ref } from 'vue';
import { useAudioInput } from './useAudioInput';
import { useNativeAudioInput } from './useNativeAudioInput';
import { usePitchLoop } from './usePitchLoop';
import { useSyntheticAudioInput } from './useSyntheticAudioInput';
import { DEFAULT_PITCH_DETECTION_RANGE, type PitchDetectionRange } from '../utils/pitch';
import type { AudioBackend } from '../utils/settingsStorage';
import { syntheticAudioFixtureFromLocation } from '../utils/syntheticAudio';

interface TunerSessionOptions {
  audioBackend: Ref<AudioBackend>;
  selectedInputDeviceId: Ref<string>;
}

export function useTunerSession(options: TunerSessionOptions) {
  const audio = useAudioInput(options.selectedInputDeviceId);
  const nativeAudio = useNativeAudioInput();
  const syntheticAudio = useSyntheticAudioInput(syntheticAudioFixtureFromLocation());
  const detectionRange = ref<PitchDetectionRange>({ ...DEFAULT_PITCH_DETECTION_RANGE });

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

  const detectedFrequency = computed(() => (
    usingNativeAudio.value ? nativeAudio.frequency.value : pitch.smoothedFrequency.value
  ));

  const isListening = computed(() => {
    if (usingSyntheticAudio.value) return syntheticAudio.isListening.value;
    return usingNativeAudio.value ? nativeAudio.isListening.value : audio.isListening.value;
  });

  const error = computed(() => {
    if (usingSyntheticAudio.value) return syntheticAudio.error.value;
    return usingNativeAudio.value ? nativeAudio.error.value : audio.error.value;
  });

  const volume = computed(() => (
    usingNativeAudio.value ? nativeAudio.level.value : pitch.volume.value
  ));

  async function start(range: PitchDetectionRange = detectionRange.value) {
    setDetectionRange(range);

    if (usingSyntheticAudio.value) {
      pitch.reset();
      audio.stop();
      void nativeAudio.stop();
      syntheticAudio.start();
      if (syntheticAudio.isListening.value) {
        pitch.start();
      }
      return;
    }

    if (usingNativeAudio.value) {
      pitch.reset();
      audio.stop();
      await nativeAudio.start(detectionRange.value);
      return;
    }

    await audio.start();
    if (audio.isListening.value) {
      pitch.reset();
      pitch.start();
    }
  }

  function stop() {
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

  return {
    analyser: audio.analyser,
    audioSampleRate: audio.sampleRate,
    clearError,
    currentFrequency: computed(() => usingNativeAudio.value ? nativeAudio.frequency.value : pitch.currentFrequency.value),
    detectedFrequency,
    detectionRange,
    error,
    inputDevices: audio.inputDevices,
    isListening,
    nativeAudioAvailable: nativeAudio.available,
    refreshInputDevices: audio.refreshInputDevices,
    resetDetection,
    selectedInputDeviceId: audio.selectedInputDeviceId,
    setDetectionRange,
    setInputDevice: audio.setInputDevice,
    start,
    stop,
    syntheticAudioFixture: syntheticAudio.fixture,
    usingNativeAudio,
    usingSyntheticAudio,
    volume,
    webAudioListening: audio.isListening,
  };
}
