import { computed, ref } from 'vue';
import type { Note } from '../utils/notes';

export function useEarTraining(
  pickNote: () => Note,
  playNote: (note: Note, durationMs?: number) => void,
) {
  const target = ref<Note | null>(null);
  const revealed = ref(false);
  const answered = ref(false);
  const attempts = ref(0);
  const correct = ref(0);
  const streak = ref(0);

  const accuracy = computed(() => (
    attempts.value ? Math.round((correct.value / attempts.value) * 100) : 0
  ));
  const canMark = computed(() => target.value != null && !answered.value);

  function ensureTarget() {
    if (!target.value) {
      target.value = pickNote();
    }
    return target.value;
  }

  function playTarget(durationMs = 1200) {
    playNote(ensureTarget(), durationMs);
  }

  function nextChallenge() {
    target.value = pickNote();
    revealed.value = false;
    answered.value = false;
    playTarget();
  }

  function reveal() {
    ensureTarget();
    revealed.value = true;
    answered.value = true;
  }

  function mark(isCorrect: boolean) {
    if (!target.value || answered.value) return false;
    attempts.value += 1;
    if (isCorrect) {
      correct.value += 1;
      streak.value += 1;
    } else {
      streak.value = 0;
    }
    revealed.value = true;
    answered.value = true;
    return true;
  }

  function reset() {
    target.value = null;
    revealed.value = false;
    answered.value = false;
    attempts.value = 0;
    correct.value = 0;
    streak.value = 0;
  }

  return {
    accuracy,
    answered,
    attempts,
    canMark,
    correct,
    mark,
    nextChallenge,
    playTarget,
    reset,
    reveal,
    revealed,
    streak,
    target,
  };
}
