import { onUnmounted, ref } from 'vue';
import type { PitchDetectionRange } from '../utils/pitch';
import type { DetectionFrame } from '../types/frames';

type NativeAudioFrame = DetectionFrame & {
  frequency?: number | null;
};

type InvokeFn = (command: string, args?: Record<string, unknown>) => Promise<unknown>;
type ListenFn = <T>(event: string, handler: (event: { payload: T }) => void) => Promise<() => void>;

export function useNativeAudioInput() {
  const available = ref(false);
  const error = ref<string | null>(null);
  const frame = ref<DetectionFrame | null>(null);
  const isListening = ref(false);

  let invokeFn: InvokeFn | null = null;
  let listenFn: ListenFn | null = null;
  let unlisten: (() => void) | null = null;

  async function loadApi() {
    if (invokeFn && listenFn) return true;

    try {
      const core = await import('@tauri-apps/api/core');
      const event = await import('@tauri-apps/api/event');
      invokeFn = core.invoke as InvokeFn;
      listenFn = event.listen as ListenFn;
      return true;
    } catch {
      return false;
    }
  }

  async function refreshAvailability() {
    if (!await loadApi() || !invokeFn) {
      available.value = false;
      return false;
    }

    try {
      available.value = Boolean(await invokeFn('native_audio_available'));
    } catch {
      available.value = false;
    }
    return available.value;
  }

  async function start(range: PitchDetectionRange) {
    error.value = null;
    if (!await refreshAvailability() || !invokeFn || !listenFn) {
      error.value = 'Native audio backend unavailable';
      return;
    }
    if (isListening.value) return;

    try {
      unlisten = await listenFn<NativeAudioFrame>('native-audio-frame', (event) => {
        frame.value = normalizeNativeFrame(event.payload);
      });
      await invokeFn('start_native_audio', { range });
      isListening.value = true;
    } catch (nativeError) {
      cleanupListener();
      error.value = nativeError instanceof Error ? nativeError.message : String(nativeError);
    }
  }

  async function stop() {
    cleanupListener();
    isListening.value = false;
    frame.value = null;
    if (invokeFn) {
      try {
        await invokeFn('stop_native_audio');
      } catch {
        // The stream may already be gone during app shutdown.
      }
    }
  }

  async function setRange(range: PitchDetectionRange) {
    if (!isListening.value || !invokeFn) return;
    try {
      await invokeFn('set_native_audio_range', { range });
    } catch {
      // Keep the active stream; the next restart will apply the range.
    }
  }

  function cleanupListener() {
    unlisten?.();
    unlisten = null;
  }

  function clearError() {
    error.value = null;
  }

  void refreshAvailability();
  onUnmounted(() => {
    void stop();
  });

  return {
    available,
    clearError,
    error,
    frame,
    isListening,
    refreshAvailability,
    setRange,
    start,
    stop,
  };
}

function normalizeNativeFrame(payload: NativeAudioFrame): DetectionFrame {
  const rawFrequency = Number(payload.freq ?? payload.frequency);
  const freq = Number.isFinite(rawFrequency) && rawFrequency > 0 ? rawFrequency : null;
  return {
    freq,
    confidence: clamp01(Number(payload.confidence) || 0),
    rms: Math.max(0, Number(payload.rms) || 0),
    level: clamp01(Number(payload.level) || 0),
    cents: Number(payload.cents) || 0,
    note: typeof payload.note === 'string' ? payload.note : '—',
    target: payload.target ?? null,
    inTune: Boolean(payload.inTune),
    isPower: Boolean(payload.isPower),
  };
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}
