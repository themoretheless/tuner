import { computed, type Ref } from 'vue';
import { useEarTraining } from '../../../composables/useEarTraining';
import { useMetronome } from '../../../composables/useMetronome';
import { summarizePractice } from '../../../domain/practice';
import type { AudioOutputPort } from '../../../ports/audioOutput';
import type { Note } from '../../../utils/notes';
import type { PracticeHistoryEntry } from '../../../utils/settingsStorage';

export interface PracticeControllerDependencies {
  beats: Ref<number>;
  bpm: Ref<number>;
  formatNote(note: Note): string;
  history: Ref<PracticeHistoryEntry[]>;
  now?(): number;
  output: AudioOutputPort;
  pickNote(): Note;
  playNote(note: Note, durationMs?: number): void;
  subdivision: Ref<number>;
}

export function usePracticeController(dependencies: PracticeControllerDependencies) {
  const earTraining = useEarTraining(dependencies.pickNote, dependencies.playNote);
  const metronome = useMetronome(
    dependencies.bpm,
    dependencies.beats,
    dependencies.subdivision,
    dependencies.output,
  );
  const summary = computed(() => summarizePractice(dependencies.history.value));

  function markEarTraining(isCorrect: boolean) {
    if (!earTraining.mark(isCorrect)) return;
    const target = earTraining.target.value;
    const nextEntry: PracticeHistoryEntry = {
      at: dependencies.now?.() ?? Date.now(),
      correct: isCorrect,
      note: target ? dependencies.formatNote(target) : '',
    };
    dependencies.history.value = [
      ...dependencies.history.value.slice(-499),
      nextEntry,
    ];
  }

  function clearHistory() {
    dependencies.history.value = [];
  }

  function exportStats() {
    return JSON.stringify({
      summary: summary.value,
      history: dependencies.history.value,
    }, null, 2);
  }

  return {
    accuracy: earTraining.accuracy,
    attempts: earTraining.attempts,
    beat: metronome.beat,
    beats: dependencies.beats,
    bpm: dependencies.bpm,
    canMark: earTraining.canMark,
    clearHistory,
    correct: earTraining.correct,
    exportStats,
    history: dependencies.history,
    isMetronomeRunning: metronome.isRunning,
    markEarTraining,
    nextChallenge: earTraining.nextChallenge,
    playTarget: earTraining.playTarget,
    reset: earTraining.reset,
    reveal: earTraining.reveal,
    revealed: earTraining.revealed,
    setBeats: metronome.setBeats,
    setBpm: metronome.setBpm,
    setSubdivision: metronome.setSubdivision,
    streak: earTraining.streak,
    subdivision: dependencies.subdivision,
    subdivisionStep: metronome.subdivisionStep,
    summary,
    tapTempo: metronome.tapTempo,
    target: earTraining.target,
    toggleMetronome: metronome.toggle,
  };
}
