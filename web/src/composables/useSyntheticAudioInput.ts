import { computed, onUnmounted, ref } from 'vue';
import type { AudioFrame } from './useAudioInput';
import { fillSyntheticAudioBuffer, type SyntheticAudioFixture } from '../utils/syntheticAudio';

const DEFAULT_FFT_SIZE = 4096;
const DEFAULT_SAMPLE_RATE = 44100;

export function useSyntheticAudioInput(fixture: SyntheticAudioFixture | null, fftSize = DEFAULT_FFT_SIZE) {
  const error = ref<string | null>(null);
  const isListening = ref(false);
  const sampleRate = ref(fixture?.sampleRate ?? DEFAULT_SAMPLE_RATE);
  const enabled = computed(() => fixture != null);

  let buffer = new Float32Array(fftSize) as Float32Array<ArrayBuffer>;
  let sampleCursor = 0;

  function start() {
    error.value = null;
    if (!fixture) {
      error.value = 'No synthetic audio fixture selected';
      return;
    }
    sampleRate.value = fixture.sampleRate;
    sampleCursor = 0;
    isListening.value = true;
  }

  function stop() {
    isListening.value = false;
    sampleCursor = 0;
  }

  function readFrame(): AudioFrame | null {
    if (!fixture || !isListening.value) return null;

    if (buffer.length !== fftSize) {
      buffer = new Float32Array(fftSize) as Float32Array<ArrayBuffer>;
    }
    sampleCursor = fillSyntheticAudioBuffer(buffer, fixture, sampleCursor);

    return {
      buffer,
      sampleRate: fixture.sampleRate,
    };
  }

  function clearError() {
    error.value = null;
  }

  onUnmounted(stop);

  return {
    clearError,
    enabled,
    error,
    fixture,
    isListening,
    readFrame,
    sampleRate,
    start,
    stop,
  };
}
