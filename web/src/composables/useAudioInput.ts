import { computed, onMounted, onUnmounted, ref, type Ref } from 'vue';
import { SampleTimeline } from '../audio/sampleTimeline';
import type {
  AudioFrame,
  DeviceSelectableAudioInputPort,
  ExactPcmCapture,
  ExactPcmCaptureInputPort,
} from '../ports/audioInput';
import { createAudioContext, errorMessage } from '../utils/audio';
import {
  createAudioInputDiagnostics,
  REQUESTED_AUDIO_PROCESSING,
  type AudioInputDiagnostics,
} from '../domain/audioInputDiagnostics';

const DEFAULT_SAMPLE_RATE = 44100;

export type { AudioFrame } from '../ports/audioInput';

export interface WebAudioInputAdapter
  extends ExactPcmCaptureInputPort, DeviceSelectableAudioInputPort {
  analyser: Ref<AnalyserNode | null>;
  inputDevices: Ref<MediaDeviceInfo[]>;
  inputDiagnostics: Ref<AudioInputDiagnostics | null>;
  refreshInputDevices(): Promise<void>;
  sampleRate: Ref<number>;
  selectedInputDeviceId: Ref<string>;
}

// 8192 samples ≈ 186ms at 44.1kHz: ~15 periods of low E instead of ~7 with
// 4096. Real-world tuners (e.g. tuneo uses a 204ms window) pay this small
// extra latency for a dramatically more stable difference function on low
// strings; the readout still updates every frame, only the analysis window
// looking back in time grows.
const DEFAULT_ANALYSIS_FFT_SIZE = 8192;

export function useAudioInput(
  selectedInputDeviceId: Ref<string>,
  fftSize = DEFAULT_ANALYSIS_FFT_SIZE,
): WebAudioInputAdapter {
  const isListening = ref(false);
  const error = ref<string | null>(null);
  const analyser = ref<AnalyserNode | null>(null);
  const inputDevices = ref<MediaDeviceInfo[]>([]);
  const inputDiagnostics = ref<AudioInputDiagnostics | null>(null);
  const sampleRate = ref(DEFAULT_SAMPLE_RATE);
  const exactPcmCaptureAvailable = ref(false);
  const available = computed(() => (
    typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
  ));

  let audioContext: AudioContext | null = null;
  let stream: MediaStream | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let completedPcmCapture: ExactPcmCapture | null = null;
  let pcmCaptureNode: AudioWorkletNode | null = null;
  let pcmTimeline: SampleTimeline | null = null;
  let silentGain: GainNode | null = null;
  let timeDomainBuffer: Float32Array<ArrayBuffer> | null = null;

  async function refreshInputDevices() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return;
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
    if (isListening.value) return true;
    inputDiagnostics.value = null;
    if (!available.value) {
      error.value = 'Microphone API unavailable';
      return false;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(selectedInputDeviceId.value ? { deviceId: { exact: selectedInputDeviceId.value } } : {}),
          ...REQUESTED_AUDIO_PROCESSING,
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
      const trackSettings = stream.getAudioTracks()[0]?.getSettings?.() ?? {};
      inputDiagnostics.value = createAudioInputDiagnostics(
        trackSettings as Partial<MediaTrackSettings>,
        audioContext.sampleRate,
      );
      const nextAnalyser = audioContext.createAnalyser();
      nextAnalyser.fftSize = fftSize;
      nextAnalyser.smoothingTimeConstant = 0.55;

      source = audioContext.createMediaStreamSource(stream);
      source.connect(nextAnalyser);
      await setupExactPcmPath(audioContext, source);
      analyser.value = nextAnalyser;
      isListening.value = true;
      void refreshInputDevices();
      return true;
    } catch (e: unknown) {
      error.value = errorMessage(e, 'Microphone access denied or unavailable');
      cleanup();
      return false;
    }
  }

  function handleTrackEnded() {
    error.value = 'Microphone disconnected';
    void stop();
  }

  async function setupExactPcmPath(
    context: AudioContext,
    activeSource: MediaStreamAudioSourceNode,
  ) {
    exactPcmCaptureAvailable.value = false;
    if (!context.audioWorklet || typeof AudioWorkletNode === 'undefined') return;

    let node: AudioWorkletNode | null = null;
    let gain: GainNode | null = null;
    try {
      await context.audioWorklet.addModule(
        new URL(
          `${import.meta.env.BASE_URL}worklets/pcmCaptureProcessor.js`,
          document.baseURI,
        ).href,
      );
      const timeline = new SampleTimeline(fftSize, context.sampleRate);
      node = new AudioWorkletNode(context, 'tuner-pcm-capture', {
        channelCount: 1,
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      });
      node.port.onmessage = (event: MessageEvent<{
        samples?: Float32Array<ArrayBuffer>;
        startSample?: number;
      }>) => {
        const { samples, startSample } = event.data;
        if (
          !(samples instanceof Float32Array)
          || typeof startSample !== 'number'
          || !Number.isSafeInteger(startSample)
        ) return;
        timeline.append(startSample, samples);
      };
      gain = context.createGain();
      gain.gain.value = 0;
      activeSource.connect(node);
      node.connect(gain);
      gain.connect(context.destination);
      pcmCaptureNode = node;
      pcmTimeline = timeline;
      silentGain = gain;
      exactPcmCaptureAvailable.value = true;
    } catch {
      node?.disconnect();
      if (node) node.port.onmessage = null;
      gain?.disconnect();
    }
  }

  function cleanup() {
    exactPcmCaptureAvailable.value = false;
    completedPcmCapture = pcmTimeline?.finishCapture() ?? completedPcmCapture;
    if (pcmCaptureNode) {
      pcmCaptureNode.port.onmessage = null;
      pcmCaptureNode.disconnect();
      pcmCaptureNode = null;
    }
    if (silentGain) {
      silentGain.disconnect();
      silentGain = null;
    }
    pcmTimeline?.reset();
    pcmTimeline = null;
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

  async function stop() {
    cleanup();
    isListening.value = false;
  }

  function clearError() {
    error.value = null;
  }

  function selectInputDevice(deviceId: string) {
    selectedInputDeviceId.value = deviceId;
  }

  function readFrame(): AudioFrame | null {
    const activeAnalyser = analyser.value;
    if (!activeAnalyser || !isListening.value) return null;

    if (pcmTimeline) return pcmTimeline.latestFrame();

    if (!timeDomainBuffer || timeDomainBuffer.length !== activeAnalyser.fftSize) {
      timeDomainBuffer = new Float32Array(activeAnalyser.fftSize) as Float32Array<ArrayBuffer>;
    }

    activeAnalyser.getFloatTimeDomainData(timeDomainBuffer);
    return {
      buffer: timeDomainBuffer,
      sampleRate: audioContext?.sampleRate ?? DEFAULT_SAMPLE_RATE,
      timebase: null,
    };
  }

  function beginExactPcmCapture() {
    const started = Boolean(
      isListening.value
      && exactPcmCaptureAvailable.value
      && pcmTimeline?.beginCapture(),
    );
    if (started) completedPcmCapture = null;
    return started;
  }

  function finishExactPcmCapture(): ExactPcmCapture | null {
    const capture = pcmTimeline?.finishCapture() ?? completedPcmCapture;
    completedPcmCapture = null;
    return capture;
  }

  onMounted(() => {
    void refreshInputDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshInputDevices);
  });

  onUnmounted(() => {
    navigator.mediaDevices?.removeEventListener?.('devicechange', refreshInputDevices);
    void stop();
  });

  return {
    analyser,
    available,
    beginExactPcmCapture,
    clearError,
    error,
    exactPcmCaptureAvailable,
    finishExactPcmCapture,
    id: 'web',
    inputDevices,
    inputDiagnostics,
    isListening,
    output: 'audio-frame',
    readFrame,
    refreshInputDevices,
    sampleRate,
    selectedInputDeviceId,
    selectInputDevice,
    start,
    stop,
  };
}
