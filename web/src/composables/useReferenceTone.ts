import { onScopeDispose, ref } from 'vue';
import type { AudioOutputPort } from '../ports/audioOutput';
import type { Note } from '../utils/notes';

export function useReferenceTone(getTargetNote: () => Note, output: AudioOutputPort) {
  const referencePlaying = ref(false);
  const playback = output.createScope();
  let requestRevision = 0;

  function stopReferenceTone() {
    requestRevision += 1;
    playback.stopAll();
    referencePlaying.value = false;
  }

  async function playReferenceTone() {
    stopReferenceTone();
    const revision = requestRevision;
    const freq = getTargetNote().frequency;
    if (!freq) return;
    try {
      await playback.resume();
    } catch {
      return;
    }
    if (revision !== requestRevision) return;
    try {
      playback.playTone({ frequency: freq, gain: 0.18, lowpassHz: 1600 });
      referencePlaying.value = true;
    } catch {
      referencePlaying.value = false;
    }
  }

  async function toggleReferenceTone() {
    if (referencePlaying.value) {
      stopReferenceTone();
    } else {
      await playReferenceTone();
    }
  }

  async function playTimedTone(note: Note, durationMs = 1500) {
    stopReferenceTone();
    const revision = requestRevision;
    try {
      await playback.resume();
    } catch {
      return;
    }
    if (revision !== requestRevision) return;
    const durationSeconds = Number.isFinite(durationMs)
      ? Math.max(0.05, durationMs / 1000)
      : 1.5;
    try {
      playback.playTone({
        attackSeconds: 0.005,
        durationSeconds,
        frequency: note.frequency,
        gain: 0.15,
        lowpassHz: 1600,
        releaseSeconds: 0.025,
      });
    } catch {
      playback.stopAll();
    }
  }

  function cleanupReferenceAudio() {
    stopReferenceTone();
    playback.dispose();
  }

  onScopeDispose(cleanupReferenceAudio);

  return {
    referencePlaying,
    toggleReferenceTone,
    stopReferenceTone,
    playTimedTone,
    cleanupReferenceAudio,
  };
}
