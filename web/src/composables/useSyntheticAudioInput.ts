import { computed, onUnmounted, ref, type ComputedRef, type Ref } from 'vue';
import type { AudioFrame, AudioFrameInputPort } from '../ports/audioInput';
import { fillSyntheticAudioBuffer, type SyntheticAudioFixture } from '../utils/syntheticAudio';

// Kept in step with the live input's analysis window (useAudioInput) so the
// synthetic fixture exercises the same buffer size as a real microphone.
const DEFAULT_FFT_SIZE = 8192;
const DEFAULT_SAMPLE_RATE = 44100;

export interface SyntheticAudioInputAdapter extends AudioFrameInputPort {
  enabled: ComputedRef<boolean>;
  fixture: SyntheticAudioFixture | null;
  sampleRate: Ref<number>;
}

export function useSyntheticAudioInput(
  fixture: SyntheticAudioFixture | null,
  fftSize = DEFAULT_FFT_SIZE,
): SyntheticAudioInputAdapter {
  const error = ref<string | null>(null);
  const isListening = ref(false);
  const sampleRate = ref(fixture?.sampleRate ?? DEFAULT_SAMPLE_RATE);
  const enabled = computed(() => fixture != null);

  let buffer = new Float32Array(fftSize) as Float32Array<ArrayBuffer>;
  let sampleCursor = 0;

  async function start() {
    error.value = null;
    if (!fixture) {
      error.value = 'No synthetic audio fixture selected';
      return false;
    }
    sampleRate.value = fixture.sampleRate;
    sampleCursor = 0;
    isListening.value = true;
    return true;
  }

  async function stop() {
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

  onUnmounted(() => {
    void stop();
  });

  return {
    available: enabled,
    clearError,
    enabled,
    error,
    fixture,
    id: 'synthetic',
    isListening,
    output: 'audio-frame',
    readFrame,
    sampleRate,
    start,
    stop,
  };
}
