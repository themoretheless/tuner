import { computed, onUnmounted, ref, type ComputedRef, type Ref } from 'vue';
import type { AudioFrame, AudioFrameInputPort } from '../ports/audioInput';
import { fillSyntheticAudioBuffer, type SyntheticAudioFixture } from '../utils/syntheticAudio';

// Kept in step with the live input's analysis window (useAudioInput) so the
// synthetic fixture exercises the same buffer size as a real microphone.
const DEFAULT_FFT_SIZE = 8192;
const DEFAULT_SAMPLE_RATE = 44100;
const FRAME_INTERVAL_MS = 33;

export interface SyntheticAudioInputAdapter extends AudioFrameInputPort {
  enabled: ComputedRef<boolean>;
  fixture: SyntheticAudioFixture | null;
  sampleRate: Ref<number>;
}

export function useSyntheticAudioInput(
  fixture: SyntheticAudioFixture | null,
  fftSize = DEFAULT_FFT_SIZE,
  nowMs: () => number = () => globalThis.performance?.now() ?? Date.now(),
): SyntheticAudioInputAdapter {
  const error = ref<string | null>(null);
  const isListening = ref(false);
  const sampleRate = ref(fixture?.sampleRate ?? DEFAULT_SAMPLE_RATE);
  const enabled = computed(() => fixture != null);

  let buffer = new Float32Array(fftSize) as Float32Array<ArrayBuffer>;
  let activeFrameStart = 0;
  let frameIndex = 0;
  let framePrepared = false;
  let nextAdvanceAt = 0;

  async function start() {
    error.value = null;
    if (!fixture) {
      error.value = 'No synthetic audio fixture selected';
      return false;
    }
    sampleRate.value = fixture.sampleRate;
    resetTimeline();
    isListening.value = true;
    return true;
  }

  async function stop() {
    isListening.value = false;
    resetTimeline();
  }

  function readFrame(): AudioFrame | null {
    if (!fixture || !isListening.value) return null;

    if (buffer.length !== fftSize) {
      buffer = new Float32Array(fftSize) as Float32Array<ArrayBuffer>;
    }
    const now = nowMs();
    if (!framePrepared) {
      prepareFrame(fixture, 0);
      nextAdvanceAt = now + FRAME_INTERVAL_MS;
    } else if (now >= nextAdvanceAt) {
      const elapsedSteps = Math.floor((now - nextAdvanceAt) / FRAME_INTERVAL_MS) + 1;
      frameIndex += elapsedSteps;
      const startSample = Math.round(
        frameIndex * fixture.sampleRate * FRAME_INTERVAL_MS / 1000,
      );
      prepareFrame(fixture, startSample);
      nextAdvanceAt += elapsedSteps * FRAME_INTERVAL_MS;
    }

    return {
      buffer,
      sampleRate: fixture.sampleRate,
      timebase: {
        endSample: activeFrameStart + fftSize,
        source: 'synthetic',
        startSample: activeFrameStart,
      },
    };
  }

  function prepareFrame(activeFixture: SyntheticAudioFixture, startSample: number) {
    activeFrameStart = startSample;
    fillSyntheticAudioBuffer(buffer, activeFixture, startSample);
    framePrepared = true;
  }

  function resetTimeline() {
    activeFrameStart = 0;
    frameIndex = 0;
    framePrepared = false;
    nextAdvanceAt = 0;
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
