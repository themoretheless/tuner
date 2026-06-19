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
import { detectPitch, FrequencySmoother, computeRmsVolume, normalizeLevel, isLikelyPowerChord, downsampleForPitch } from '../utils/pitch';
import { useSettings } from './useSettings';

const PREFERRED_SAMPLE_RATE = 48000;
const FFT_SIZE = 2048;

// Magic numbers extracted for clarity and maintainability
const SMOOTHING_TIME = 0.55;
const LP_FREQ = 1600;
const REF_GAIN = 0.18;
const RANDOM_GAIN = 0.15;
const RANDOM_DURATION = 1500;

// Simple hysteresis to avoid flickering IN TUNE label
const IN_TUNE_THRESHOLD = 5;
const OUT_OF_TUNE_THRESHOLD = 7;

export function useTuner() {
  const isListening = ref(false);
  const currentFrequency = ref<number | null>(null);
  const smoothedFrequency = ref<number | null>(null);
  const confidence = ref(0);
  const volume = ref(0);
  const isPowerChord = ref(false);
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
      try {
        sharedAudio = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: PREFERRED_SAMPLE_RATE,
        });
      } catch {
        sharedAudio = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
    }
    return sharedAudio;
  }

  // Separate playback context + nodes (reused) - now using shared
  let refOsc: OscillatorNode | null = null;
  let refGain: GainNode | null = null;

  // Hysteresis state
  let _inTuneStable = false;
  let chordCheckCounter = 0;

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

  const stringsWithCents = computed(() => {
    const f = smoothedFrequency.value;
    if (!f) return currentTuning.value.strings.map(s => ({ ...s, cents: null as number | null }));
    return currentTuning.value.strings.map(s => {
      const c = getCents(f, s.frequency);
      return { ...s, cents: c };
    });
  });

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
          sampleRate: { ideal: PREFERRED_SAMPLE_RATE },
        },
      });

      // Try to create AudioContext at 48 kHz for better resolution
      try {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: PREFERRED_SAMPLE_RATE,
        });
      } catch {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      analyser = audioContext.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = SMOOTHING_TIME;
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
    confidence.value = 0;
    isPowerChord.value = false;
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

    // Downsample for expensive pitch (perf fix)
    const pitchBuffer = timeDomainBuffer.length > 1024 ? downsampleForPitch(timeDomainBuffer, 2) : timeDomainBuffer;
    const pitchSr = (audioContext?.sampleRate ?? PREFERRED_SAMPLE_RATE) / (pitchBuffer.length < timeDomainBuffer.length ? 2 : 1);

    const result = detectPitch(pitchBuffer, pitchSr);
    const freq = result ? result.freq : null;
    currentFrequency.value = freq;
    confidence.value = result ? result.confidence : 0;

    // Simple power chord detection (root + fifth) - not every frame for perf
    if (++chordCheckCounter % 5 === 0) {
      isPowerChord.value = !!freq && isLikelyPowerChord(timeDomainBuffer, audioContext?.sampleRate ?? PREFERRED_SAMPLE_RATE, freq);
    }

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
    refGain.gain.value = REF_GAIN;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = LP_FREQ;

    refOsc.connect(lp);
    lp.connect(refGain);
    refGain.connect(ctx.destination);

    refOsc.start();
    referencePlaying.value = true;
  }

  function playTone(freq: number, gainVal: number = RANDOM_GAIN, durationMs: number = 0) {
    const ctx = getSharedAudio();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.value = gainVal;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = LP_FREQ;

    osc.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    if (durationMs > 0) {
      setTimeout(() => {
        try { osc.stop(); } catch {}
      }, durationMs);
    }
    return osc;
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
    playTone(random.frequency, RANDOM_GAIN, RANDOM_DURATION);
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
    confidence,
    isPowerChord,
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
    stringsWithCents,

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