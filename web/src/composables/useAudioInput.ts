import { onMounted, onUnmounted, ref, type Ref } from 'vue';
import { createAudioContext, errorMessage } from '../utils/audio';

const DEFAULT_SAMPLE_RATE = 44100;

export interface AudioFrame {
  buffer: Float32Array<ArrayBuffer>;
  sampleRate: number;
}

export function useAudioInput(selectedInputDeviceId: Ref<string>, fftSize = 4096) {
  const isListening = ref(false);
  const error = ref<string | null>(null);
  const analyser = ref<AnalyserNode | null>(null);
  const inputDevices = ref<MediaDeviceInfo[]>([]);
  const sampleRate = ref(DEFAULT_SAMPLE_RATE);

  let audioContext: AudioContext | null = null;
  let stream: MediaStream | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let timeDomainBuffer: Float32Array<ArrayBuffer> | null = null;

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

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(selectedInputDeviceId.value ? { deviceId: { exact: selectedInputDeviceId.value } } : {}),
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      });

      // If the mic track ends involuntarily (unplugged / OS revoked), stop
      // cleanly instead of leaving isListening true and reading stale zeros.
      stream.getAudioTracks().forEach((track) => {
        track.addEventListener('ended', handleTrackEnded);
      });

      audioContext = createAudioContext();
      // Browsers can hand back a suspended context (autoplay policy / iOS);
      // resume it now and keep it resumed, otherwise the analyser silently
      // reads zeros and detection produces nothing.
      if (audioContext.state === 'suspended') {
        await audioContext.resume().catch(() => {});
      }
      audioContext.onstatechange = () => {
        if (audioContext?.state === 'suspended' && isListening.value) {
          void audioContext.resume().catch(() => {});
        }
      };
      sampleRate.value = audioContext.sampleRate;
      const nextAnalyser = audioContext.createAnalyser();
      nextAnalyser.fftSize = fftSize;
      nextAnalyser.smoothingTimeConstant = 0.55;

      source = audioContext.createMediaStreamSource(stream);
      source.connect(nextAnalyser);
      analyser.value = nextAnalyser;
      isListening.value = true;
      void refreshInputDevices();
    } catch (e: unknown) {
      error.value = errorMessage(e, 'Microphone access denied or unavailable');
      cleanup();
    }
  }

  function handleTrackEnded() {
    error.value = 'Microphone disconnected';
    stop();
  }

  function cleanup() {
    if (source) {
      source.disconnect();
      source = null;
    }
    analyser.value = null;
    if (audioContext) {
      audioContext.onstatechange = null;
      audioContext.close().catch(() => {});
      audioContext = null;
    }
    sampleRate.value = DEFAULT_SAMPLE_RATE;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
    timeDomainBuffer = null;
  }

  function stop() {
    cleanup();
    isListening.value = false;
  }

  function clearError() {
    error.value = null;
  }

  async function setInputDevice(deviceId: string) {
    selectedInputDeviceId.value = deviceId;
    if (!isListening.value) return;
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
    readFrame,
    refreshInputDevices,
    sampleRate,
    selectedInputDeviceId,
    setInputDevice,
    start,
    stop,
  };
}
