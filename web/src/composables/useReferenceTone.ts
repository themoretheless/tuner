import { onUnmounted, ref } from 'vue';
import type { Note } from '../utils/notes';
import { createAudioContext } from '../utils/audio';

export function useReferenceTone(getTargetNote: () => Note) {
  const referencePlaying = ref(false);

  let sharedAudio: AudioContext | null = null;
  let refOsc: OscillatorNode | null = null;
  let randomTimeoutId: number | null = null;

  function getSharedAudio() {
    if (!sharedAudio) {
      sharedAudio = createAudioContext();
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

    return { osc, gain };
  }

  function stopReferenceTone() {
    if (refOsc) {
      try { refOsc.stop(); } catch {}
      refOsc = null;
    }
    referencePlaying.value = false;
  }

  function playReferenceTone() {
    stopReferenceTone();

    const freq = getTargetNote().frequency;
    if (!freq) return;

    const tone = createTone(freq, 0.18);
    refOsc = tone.osc;
    refOsc.start();
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
    stopReferenceTone();
    if (randomTimeoutId != null) {
      window.clearTimeout(randomTimeoutId);
      randomTimeoutId = null;
    }

    const { osc } = createTone(note.frequency, 0.15);
    osc.start();
    randomTimeoutId = window.setTimeout(() => {
      try { osc.stop(); } catch {}
      randomTimeoutId = null;
    }, durationMs);
  }

  function cleanupReferenceAudio() {
    stopReferenceTone();
    if (randomTimeoutId != null) {
      window.clearTimeout(randomTimeoutId);
      randomTimeoutId = null;
    }
    if (sharedAudio) {
      sharedAudio.close().catch(() => {});
      sharedAudio = null;
    }
  }

  onUnmounted(cleanupReferenceAudio);

  return {
    referencePlaying,
    toggleReferenceTone,
    stopReferenceTone,
    playTimedTone,
    cleanupReferenceAudio,
  };
}
