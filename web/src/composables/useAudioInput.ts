import { onMounted, onUnmounted, ref, type Ref } from 'vue';
import { createAudioContext, errorMessage } from '../utils/audio';

const DEFAULT_SAMPLE_RATE = 44100;

export interface AudioFrame {
  buffer: Float32Array<ArrayBuffer>;
  sampleRate: number;
}

export function useAudioInput(selectedInputDeviceId: Ref<string>, fftSize = 4096) {
  const isListening = ref(false);
  const isStarting = ref(false);
  const error = ref<string | null>(null);
  const analyser = ref<AnalyserNode | null>(null);
  const inputDevices = ref<MediaDeviceInfo[]>([]);
  const sampleRate = ref(DEFAULT_SAMPLE_RATE);

  let audioContext: AudioContext | null = null;
  let stream: MediaStream | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let timeDomainBuffer: Float32Array<ArrayBuffer> | null = null;
  let activeTrackEndedHandler: (() => void) | null = null;
  let generation = 0;
  let startPromise: Promise<void> | null = null;
  let startPromiseGeneration = -1;

  async function refreshInputDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      inputDevices.value = devices.filter((device) => device.kind === 'audioinput');
      if (
        selectedInputDeviceId.value &&
        inputDevices.value.length > 0 &&
        inputDevices.value.some((device) => device.deviceId) &&
        !inputDevices.value.some((device) => device.deviceId === selectedInputDeviceId.value)
      ) {
        selectedInputDeviceId.value = '';
      }
    } catch {
      inputDevices.value = [];
    }
  }

  async function start() {
    error.value = null;
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

      let nextStream: MediaStream | null = null;
      let nextAudioContext: AudioContext | null = null;
      let nextSource: MediaStreamAudioSourceNode | null = null;

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Microphone access is not supported by this browser');
        }

        nextStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            ...(selectedInputDeviceId.value ? { deviceId: { exact: selectedInputDeviceId.value } } : {}),
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: 1,
          },
        });
        if (token !== generation) return;

        nextAudioContext = createAudioContext();
        if (nextAudioContext.state === 'suspended') {
          await nextAudioContext.resume();
        }
        if (token !== generation) return;

        const nextAnalyser = nextAudioContext.createAnalyser();
        nextAnalyser.fftSize = fftSize;
        nextAnalyser.smoothingTimeConstant = 0.55;
        nextSource = nextAudioContext.createMediaStreamSource(nextStream);
        nextSource.connect(nextAnalyser);
        if (token !== generation) return;

        const committedStream = nextStream;
        const committedContext = nextAudioContext;
        activeTrackEndedHandler = () => {
          if (token !== generation || stream !== committedStream) return;
          error.value = 'Microphone disconnected';
          stop();
        };
        committedStream.getAudioTracks().forEach((track) => {
          track.addEventListener('ended', activeTrackEndedHandler!);
        });

        committedContext.onstatechange = () => {
          if (
            token === generation &&
            audioContext === committedContext &&
            committedContext.state === 'suspended' &&
            isListening.value
          ) {
            void committedContext.resume().catch(() => {});
          }
        };

        stream = committedStream;
        audioContext = committedContext;
        source = nextSource;
        analyser.value = nextAnalyser;
        sampleRate.value = committedContext.sampleRate;
        isListening.value = true;

        nextStream = null;
        nextAudioContext = null;
        nextSource = null;
        void refreshInputDevices();
      } catch (startError: unknown) {
        if (token === generation) {
          error.value = errorMessage(startError, 'Microphone access denied or unavailable');
        }
      } finally {
        disposeAudioResources(nextStream, nextAudioContext, nextSource);
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

  function cleanup() {
    const currentStream = stream;
    const currentContext = audioContext;
    const currentSource = source;
    if (currentStream && activeTrackEndedHandler) {
      currentStream.getAudioTracks().forEach((track) => {
        track.removeEventListener('ended', activeTrackEndedHandler!);
      });
    }
    activeTrackEndedHandler = null;
    stream = null;
    audioContext = null;
    source = null;
    isListening.value = false;

    analyser.value = null;
    sampleRate.value = DEFAULT_SAMPLE_RATE;
    timeDomainBuffer = null;
    disposeAudioResources(currentStream, currentContext, currentSource);
  }

  function stop() {
    generation += 1;
    isStarting.value = false;
    cleanup();
  }

  function clearError() {
    error.value = null;
  }

  async function setInputDevice(deviceId: string) {
    selectedInputDeviceId.value = deviceId;
    if (!isListening.value && !isStarting.value) return;
    stop();
    await start();
  }

  function readFrame(): AudioFrame | null {
    const activeAnalyser = analyser.value;
    if (!activeAnalyser || !isListening.value) return null;

    if (!timeDomainBuffer || timeDomainBuffer.length !== activeAnalyser.fftSize) {
      timeDomainBuffer = new Float32Array(activeAnalyser.fftSize) as Float32Array<ArrayBuffer>;
    }

    activeAnalyser.getFloatTimeDomainData(timeDomainBuffer);
    return {
      buffer: timeDomainBuffer,
      sampleRate: audioContext?.sampleRate ?? DEFAULT_SAMPLE_RATE,
    };
  }

  onMounted(() => {
    void refreshInputDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshInputDevices);
  });

  onUnmounted(() => {
    navigator.mediaDevices?.removeEventListener?.('devicechange', refreshInputDevices);
    stop();
  });

  return {
    analyser,
    clearError,
    error,
    inputDevices,
    isListening,
    isStarting,
    readFrame,
    refreshInputDevices,
    sampleRate,
    selectedInputDeviceId,
    setInputDevice,
    start,
    stop,
  };
}

function disposeAudioResources(
  stream: MediaStream | null,
  audioContext: AudioContext | null,
  source: MediaStreamAudioSourceNode | null,
) {
  if (source) {
    try {
      source.disconnect();
    } catch {
      // The source may already have been disconnected by the browser.
    }
  }
  if (audioContext) {
    audioContext.onstatechange = null;
    void audioContext.close().catch(() => {});
  }
  stream?.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      // Continue releasing the remaining tracks.
    }
  });
}
