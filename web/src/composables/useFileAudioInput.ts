import { computed, onUnmounted, ref, type ComputedRef, type Ref } from 'vue';
import type { DecodedWav } from '../audio/wav';
import type {
  AudioFrame,
  ExactPcmCapture,
  ExactPcmCaptureInputPort,
} from '../ports/audioInput';

const DEFAULT_FRAME_SIZE = 8192;
const FRAME_INTERVAL_MS = 33;

export interface FileAudioInputAdapter extends ExactPcmCaptureInputPort {
  durationSeconds: ComputedRef<number>;
  fileName: Ref<string | null>;
  load(decoded: DecodedWav, name: string): void;
  progress: ComputedRef<number>;
  sampleRate: Ref<number>;
  unload(): Promise<void>;
}

export function useFileAudioInput(
  frameSize = DEFAULT_FRAME_SIZE,
): FileAudioInputAdapter {
  const decoded = ref<DecodedWav | null>(null);
  const error = ref<string | null>(null);
  const fileName = ref<string | null>(null);
  const isListening = ref(false);
  const sampleRate = ref(44_100);
  const activeFrameStart = ref(0);
  const available = computed(() => decoded.value != null);
  const durationSeconds = computed(() => (
    decoded.value ? decoded.value.samples.length / decoded.value.sampleRate : 0
  ));
  const exactPcmCaptureAvailable = computed(() => isListening.value && decoded.value != null);
  const progress = computed(() => {
    const source = decoded.value;
    return source ? Math.min(1, activeFrameStart.value / source.samples.length) : 0;
  });

  let captureStart: number | null = null;
  let completedCapture: ExactPcmCapture | null = null;
  let framePrepared = false;
  let nextAdvanceAt = 0;
  let outputBuffer = new Float32Array(frameSize) as Float32Array<ArrayBuffer>;

  function load(source: DecodedWav, name: string) {
    completedCapture = createCapture() ?? completedCapture;
    captureStart = null;
    decoded.value = source;
    error.value = null;
    fileName.value = name;
    sampleRate.value = source.sampleRate;
    resetPlayback();
  }

  async function start() {
    error.value = null;
    if (!decoded.value) {
      error.value = 'No WAV file selected';
      return false;
    }
    completedCapture = createCapture() ?? completedCapture;
    captureStart = null;
    resetPlayback();
    isListening.value = true;
    return true;
  }

  async function stop() {
    completedCapture = createCapture() ?? completedCapture;
    isListening.value = false;
    captureStart = null;
    resetPlayback();
  }

  async function unload() {
    await stop();
    decoded.value = null;
    fileName.value = null;
    sampleRate.value = 44_100;
  }

  function readFrame(): AudioFrame | null {
    const source = decoded.value;
    if (!source || !isListening.value) return null;

    const now = performance.now();
    if (!framePrepared) {
      prepareFrame(source, 0);
      nextAdvanceAt = now + FRAME_INTERVAL_MS;
    } else if (now >= nextAdvanceAt) {
      const elapsedSteps = Math.floor((now - nextAdvanceAt) / FRAME_INTERVAL_MS) + 1;
      const hopSize = Math.max(1, Math.round(source.sampleRate * FRAME_INTERVAL_MS / 1000));
      const nextStart = activeFrameStart.value + elapsedSteps * hopSize;
      nextAdvanceAt += elapsedSteps * FRAME_INTERVAL_MS;
      if (nextStart >= source.samples.length) {
        isListening.value = false;
        return null;
      }
      prepareFrame(source, nextStart);
    }

    return {
      buffer: outputBuffer,
      sampleRate: source.sampleRate,
      timebase: {
        endSample: activeFrameStart.value + frameSize,
        source: 'file',
        startSample: activeFrameStart.value,
      },
    };
  }

  function beginExactPcmCapture() {
    if (!exactPcmCaptureAvailable.value || captureStart != null) return false;
    completedCapture = null;
    captureStart = activeFrameStart.value;
    return true;
  }

  function finishExactPcmCapture(): ExactPcmCapture | null {
    const capture = createCapture() ?? completedCapture;
    completedCapture = null;
    captureStart = null;
    return capture;
  }

  function createCapture(): ExactPcmCapture | null {
    const source = decoded.value;
    const startSample = captureStart;
    if (!source || startSample == null) return null;
    const endSample = Math.min(
      source.samples.length,
      activeFrameStart.value + frameSize,
    );
    if (endSample <= startSample) return null;
    const samples = new Float32Array(endSample - startSample) as Float32Array<ArrayBuffer>;
    samples.set(source.samples.subarray(startSample, endSample));
    return {
      droppedSamples: 0,
      endSample,
      sampleRate: source.sampleRate,
      samples,
      startSample,
    };
  }

  function prepareFrame(source: DecodedWav, startSample: number) {
    if (outputBuffer.length !== frameSize) {
      outputBuffer = new Float32Array(frameSize) as Float32Array<ArrayBuffer>;
    }
    outputBuffer.fill(0);
    outputBuffer.set(source.samples.subarray(startSample, startSample + frameSize));
    activeFrameStart.value = startSample;
    framePrepared = true;
  }

  function resetPlayback() {
    activeFrameStart.value = 0;
    framePrepared = false;
    nextAdvanceAt = 0;
    outputBuffer.fill(0);
  }

  function clearError() {
    error.value = null;
  }

  onUnmounted(() => {
    void stop();
  });

  return {
    available,
    beginExactPcmCapture,
    clearError,
    durationSeconds,
    error,
    exactPcmCaptureAvailable,
    fileName,
    finishExactPcmCapture,
    id: 'file',
    isListening,
    load,
    output: 'audio-frame',
    progress,
    readFrame,
    sampleRate,
    start,
    stop,
    unload,
  };
}
