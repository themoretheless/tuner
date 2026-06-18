import { ref, computed, onUnmounted } from 'vue';
import type { Note, DetectedNote } from '../utils/notes';
import {
  TUNINGS,
  frequencyToNote,
  getCents,
  findClosestString,
  getNoteDisplay,
  formatFreq,
  type Tuning,
} from '../utils/notes';
import { detectPitch, FrequencySmoother, computeRmsVolume, normalizeLevel } from '../utils/pitch';
import { useSettings } from './useSettings';

const TARGET_SAMPLE_RATE = 44100;
const FFT_SIZE = 2048;

// Simple hysteresis to avoid flickering IN TUNE label
const IN_TUNE_THRESHOLD = 5;
const OUT_OF_TUNE_THRESHOLD = 7;

export function useTuner() {
  const isListening = ref(false);
  const currentFrequency = ref<number | null>(null);
  const smoothedFrequency = ref<number | null>(null);
  const volume = ref(0);
  const error = ref<string | null>(null);

  const selectedString = ref<Note | null>(null);
  const referencePlaying = ref(false);

  // Tunable A4 + current tuning
  // TODO (architecture): extract to useTuningState + useAudioInput + useReferenceTone for better separation
  const settings = useSettings();
  const a4 = settings.a4;
  const currentTuning = ref<Tuning>(TUNINGS.find(t => t.id === settings.lastTuningId.value) || TUNINGS[0]);

  let audioContext: AudioContext | null = null;
  let stream: MediaStream | null = null;
  let analyser: AnalyserNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let rafId: number | null = null;
  const smoother = new FrequencySmoother();
  const analyserRef = ref<AnalyserNode | null>(null); // for visualizers

  // Preallocated buffer to avoid GC pressure every frame (perf)
  let timeDomainBuffer: Float32Array | null = null;

  // Reusable audio context for all tones (perf + avoid multiple contexts)
  let sharedAudio: AudioContext | null = null;
  function getSharedAudio() {
    if (!sharedAudio) {
      sharedAudio = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return sharedAudio;
  }

  // Separate playback context + nodes (reused) - now using shared
  let refOsc: OscillatorNode | null = null;
  let refGain: GainNode | null = null;

  // Hysteresis state
  let _inTuneStable = false;

  const detectedNote = computed<DetectedNote | null>(() => {
    const f = smoothedFrequency.value;
    if (!f) return null;

    const target = selectedString.value ?? findClosestString(f, strings.value, a4.value);
    const cents = getCents(f, target.frequency);
    const note = frequencyToNote(f, a4.value);

    return { note, cents, frequency: f };
  });

  const strings = computed(() => currentTuning.value.strings);

  const targetNote = computed<Note>(() => {
    const f = smoothedFrequency.value;
    if (selectedString.value) return selectedString.value;
    return f ? findClosestString(f, strings.value, a4.value) : strings.value[0];
  });

  const cents = computed(() => detectedNote.value?.cents ?? 0);

  const isInTune = computed(() => {
    const c = Math.abs(cents.value);
    if (c < IN_TUNE_THRESHOLD) _inTuneStable = true;
    else if (c > OUT_OF_TUNE_THRESHOLD) _inTuneStable = false;
    return _inTuneStable;
  });

  const currentNoteDisplay = computed(() => {
    const det = detectedNote.value;
    return det ? getNoteDisplay(det.note) : null;
  });

  // Expose A4 for UI control
  function setA4(newA4: number) {
    a4.value = Math.max(420, Math.min(460, Math.round(newA4)));
    settings.a4.value = a4.value; // sync
    smoother.reset();
  }

  function setTuning(tuning: Tuning) {
    currentTuning.value = tuning;
    settings.lastTuningId.value = tuning.id;
    selectedString.value = null; // reset manual selection on tuning change
    smoother.reset();
  }

  async function start() {
    error.value = null;
    if (isListening.value) return;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      });

      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.55;
      analyserRef.value = analyser;

      source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      isListening.value = true;
      smoother.reset();
      tick();
    } catch (e: any) {
      error.value = e?.message || 'Microphone access denied or unavailable';
      cleanup();
    }
  }

  function stop() {
    cleanup();
    isListening.value = false;
    currentFrequency.value = null;
    smoothedFrequency.value = null;
    volume.value = 0;
    smoother.reset();
    stopReferenceTone();
  }

  function cleanup() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (source) {
      source.disconnect();
      source = null;
    }
    if (analyser) {
      analyser = null;
      analyserRef.value = null;
    }
    if (audioContext) {
      audioContext.close().catch(() => {});
      audioContext = null;
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
  }

  function tick() {
    if (!analyser || !isListening.value) return;

    if (!timeDomainBuffer || timeDomainBuffer.length !== analyser.fftSize) {
      timeDomainBuffer = new Float32Array(analyser.fftSize) as Float32Array<ArrayBuffer>;
    }
    analyser.getFloatTimeDomainData(timeDomainBuffer as Float32Array<ArrayBuffer>);

    const rms = computeRmsVolume(timeDomainBuffer);
    volume.value = normalizeLevel(rms);

    const freq = detectPitch(timeDomainBuffer, audioContext?.sampleRate ?? TARGET_SAMPLE_RATE);
    currentFrequency.value = freq;

    const smoothed = smoother.add(freq);
    smoothedFrequency.value = smoothed;

    rafId = requestAnimationFrame(tick);
  }

  function toggleString(note: Note) {
    const current = selectedString.value;
    if (current && Math.abs(current.frequency - note.frequency) < 0.01) {
      selectedString.value = null;
    } else {
      selectedString.value = note;
    }
  }

  // === Reference tone (reused context) ===
  function playReferenceTone() {
    stopReferenceTone();

    const freq = targetNote.value.frequency;
    if (!freq) return;

    const ctx = getSharedAudio();
    refOsc = ctx.createOscillator();
    refGain = ctx.createGain();

    refOsc.type = 'sine';
    refOsc.frequency.value = freq;
    refGain.gain.value = 0.18;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1600;

    refOsc.connect(lp);
    lp.connect(refGain);
    refGain.connect(ctx.destination);

    refOsc.start();
    referencePlaying.value = true;
  }

  function stopReferenceTone() {
    if (refOsc) {
      try { refOsc.stop(); } catch {}
      refOsc = null;
    }
    refGain = null;
    referencePlaying.value = false;
  }

  function toggleReferenceTone() {
    if (referencePlaying.value) {
      stopReferenceTone();
    } else {
      playReferenceTone();
    }
  }

  // Basic practice: play random string note for ear training
  function playRandomString() {
    const random = strings.value[Math.floor(Math.random() * strings.value.length)];
    stopReferenceTone();
    const ctx = getSharedAudio();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = random.frequency;
    gain.gain.value = 0.15;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1600;
    osc.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      try { osc.stop(); } catch {}
    }, 1500);
  }

  function clearError() {
    error.value = null;
  }

  onUnmounted(() => {
    stop();
    stopReferenceTone();
    if (sharedAudio) {
      sharedAudio.close().catch(() => {});
      sharedAudio = null;
    }
  });

  return {
    // state (refs)
    isListening,
    currentFrequency,
    smoothedFrequency,
    volume,
    error,
    selectedString,
    referencePlaying,
    a4,
    currentTuning,

    // computed
    detectedNote,
    targetNote,
    cents,
    isInTune,
    currentNoteDisplay,
    strings,

    // for visualizers
    analyser: analyserRef,
    showWaveform: settings.showWaveform,
    showSpectrum: settings.showSpectrum,

    // actions
    start,
    stop,
    toggleString,
    toggleReferenceTone,
    clearError,
    setA4,
    setTuning,
    playRandomString,

    // data
    allTunings: TUNINGS,
    formatFreq,
    getNoteDisplay,
  };
}