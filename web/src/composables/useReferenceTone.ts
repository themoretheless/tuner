import { onUnmounted, ref, watch } from 'vue';
import type { Note } from '../utils/notes';
import { createAudioContext } from '../utils/audio';

export function useReferenceTone(getTargetNote: () => Note) {
  const referencePlaying = ref(false);

  let sharedAudio: AudioContext | null = null;
  let referenceTone: ActiveTone | null = null;
  let timedTone: ActiveTone | null = null;
  let timedToneTimeoutId: number | null = null;

  function getSharedAudio() {
    if (!sharedAudio) {
      sharedAudio = createAudioContext();
    }
    if (sharedAudio.state === 'suspended') {
      void sharedAudio.resume().catch(() => {});
    }
    return sharedAudio;
  }

  function createTone(frequency: number, gainValue: number) {
    const ctx = getSharedAudio();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const lp = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.value = gainValue;
    lp.type = 'lowpass';
    lp.frequency.value = 1600;

    osc.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);

    return { filter: lp, gain, oscillator: osc };
  }

  function stopReferenceTone() {
    stopTone(referenceTone);
    referenceTone = null;
    referencePlaying.value = false;
  }

  function stopTimedTone() {
    if (timedToneTimeoutId != null) {
      window.clearTimeout(timedToneTimeoutId);
      timedToneTimeoutId = null;
    }
    stopTone(timedTone);
    timedTone = null;
  }

  function stopAllTones() {
    stopReferenceTone();
    stopTimedTone();
  }

  function playReferenceTone() {
    stopAllTones();

    const freq = getTargetNote().frequency;
    if (!freq) return;

    const tone = createTone(freq, 0.18);
    referenceTone = tone;
    tone.oscillator.start();
    referencePlaying.value = true;
  }

  function toggleReferenceTone() {
    if (referencePlaying.value) {
      stopReferenceTone();
    } else {
      playReferenceTone();
    }
  }

  function playTimedTone(note: Note, durationMs = 1500) {
    stopAllTones();

    const tone = createTone(note.frequency, 0.15);
    timedTone = tone;
    tone.oscillator.start();
    timedToneTimeoutId = window.setTimeout(() => {
      if (timedTone === tone) {
        stopTimedTone();
      } else {
        stopTone(tone);
      }
    }, Math.max(0, durationMs));
  }

  function cleanupReferenceAudio() {
    stopAllTones();
    if (sharedAudio) {
      sharedAudio.close().catch(() => {});
      sharedAudio = null;
    }
  }

  watch(() => getTargetNote().frequency, (frequency, previousFrequency) => {
    if (referencePlaying.value && frequency !== previousFrequency) {
      playReferenceTone();
    }
  });

  onUnmounted(cleanupReferenceAudio);

  return {
    referencePlaying,
    toggleReferenceTone,
    playReferenceTone,
    stopReferenceTone,
    stopTimedTone,
    stopAllTones,
    playTimedTone,
    cleanupReferenceAudio,
  };
}

interface ActiveTone {
  filter: BiquadFilterNode;
  gain: GainNode;
  oscillator: OscillatorNode;
}

function stopTone(tone: ActiveTone | null) {
  if (!tone) return;
  try {
    tone.oscillator.stop();
  } catch {
    // Oscillator may already have ended naturally.
  }
  for (const node of [tone.oscillator, tone.filter, tone.gain]) {
    try {
      node.disconnect();
    } catch {
      // A node can already be disconnected after its context closes.
    }
  }
}
