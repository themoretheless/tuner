import { onUnmounted, ref } from 'vue';
import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { listen as tauriListen } from '@tauri-apps/api/event';
import type { PitchDetectionRange } from '../utils/pitch';
import type { DetectionFrame } from '../types/frames';
import { isTauriRuntime } from '../utils/settingsStorage';

type NativeAudioFrame = DetectionFrame & {
  frequency?: number | null;
};

type InvokeFn = (command: string, args?: Record<string, unknown>) => Promise<unknown>;
type ListenFn = <T>(event: string, handler: (event: { payload: T }) => void) => Promise<() => void>;

export interface NativeAudioApi {
  invoke: InvokeFn;
  listen: ListenFn;
}

export function useNativeAudioInput(api?: NativeAudioApi) {
  const available = ref(false);
  const error = ref<string | null>(null);
  const frame = ref<DetectionFrame | null>(null);
  const isListening = ref(false);
  const isStarting = ref(false);

  let invokeFn: InvokeFn | null = api?.invoke ?? null;
  let listenFn: ListenFn | null = api?.listen ?? null;
  let unlistenFrame: (() => void) | null = null;
  let unlistenError: (() => void) | null = null;
  let generation = 0;
  let operationQueue: Promise<void> = Promise.resolve();
  let startPromise: Promise<void> | null = null;
  let startPromiseGeneration = -1;

  async function loadApi() {
    if (invokeFn && listenFn) return true;
    if (!isTauriRuntime()) return false;
    invokeFn = tauriInvoke as InvokeFn;
    listenFn = tauriListen as ListenFn;
    return true;
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
    if (isListening.value) return;
    if (startPromise && startPromiseGeneration === generation) return startPromise;

    const token = generation;
    isStarting.value = true;
    const operation = enqueue(async () => {
      if (token !== generation) return;
      if (!await refreshAvailability() || !invokeFn || !listenFn) {
        if (token === generation) error.value = 'Native audio backend unavailable';
        return;
      }
      if (token !== generation) return;

      let nextUnlistenFrame: (() => void) | null = null;
      let nextUnlistenError: (() => void) | null = null;
      let backendStarted = false;
      try {
        const activeInvoke = invokeFn;
        nextUnlistenFrame = await listenFn<NativeAudioFrame>('native-audio-frame', (event) => {
          if (token === generation) {
            frame.value = normalizeNativeFrame(event.payload);
          }
        });
        if (token !== generation) return;
        nextUnlistenError = await listenFn<unknown>('native-audio-error', () => {
          if (token !== generation) return;
          error.value = 'Native audio stream stopped unexpectedly';
          void stop();
        });
        if (token !== generation) return;

        await activeInvoke('start_native_audio', { range });
        backendStarted = true;
        if (token !== generation) return;

        unlistenFrame = nextUnlistenFrame;
        unlistenError = nextUnlistenError;
        nextUnlistenFrame = null;
        nextUnlistenError = null;
        isListening.value = true;
      } catch {
        if (token === generation) {
          error.value = 'Native audio backend failed to start';
        }
      } finally {
        safelyUnlisten(nextUnlistenFrame);
        safelyUnlisten(nextUnlistenError);
        if (backendStarted && token !== generation) {
          try {
            await invokeFn?.('stop_native_audio');
          } catch {
            // A concurrent stop may already have shut the backend down.
          }
        }
      }
    });

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

  async function stop() {
    generation += 1;
    isStarting.value = false;
    cleanupListener();
    isListening.value = false;
    frame.value = null;
    await enqueue(async () => {
      if (!invokeFn) return;
      try {
        await invokeFn('stop_native_audio');
      } catch {
        // The stream may already be gone during app shutdown.
      }
    });
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
    safelyUnlisten(unlistenFrame);
    safelyUnlisten(unlistenError);
    unlistenFrame = null;
    unlistenError = null;
  }

  function clearError() {
    error.value = null;
  }

  function enqueue(operation: () => Promise<void>) {
    const next = operationQueue.then(operation, operation);
    operationQueue = next.catch(() => {});
    return next;
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
    isStarting,
    refreshAvailability,
    setRange,
    start,
    stop,
  };
}

function normalizeNativeFrame(payload: NativeAudioFrame): DetectionFrame {
  const rawFrequency = finiteNumber(payload.freq ?? payload.frequency);
  const freq = rawFrequency != null && rawFrequency > 0 ? rawFrequency : null;
  return {
    freq,
    confidence: clamp01(finiteNumber(payload.confidence) ?? 0),
    rms: Math.max(0, finiteNumber(payload.rms) ?? 0),
    level: clamp01(finiteNumber(payload.level) ?? 0),
    cents: finiteNumber(payload.cents) ?? 0,
    note: typeof payload.note === 'string' ? payload.note : '—',
    target: payload.target ?? null,
    inTune: payload.inTune === true,
    isPower: payload.isPower === true,
  };
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function finiteNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function safelyUnlisten(unlisten: (() => void) | null) {
  try {
    unlisten?.();
  } catch {
    // Listener cleanup must not prevent the backend from being stopped.
  }
}
