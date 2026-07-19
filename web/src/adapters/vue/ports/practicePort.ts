import { reactive } from 'vue';
import type { PracticePort } from '../../../app/ports/practice';
import type { PracticeCapability } from '../capabilities/practice';
import type { TuningCapability } from '../capabilities/tuning';

interface Dependencies {
  practice: PracticeCapability;
  tuning: Pick<TuningCapability, 'getNoteDisplay'>;
}

export function createPracticePort({ practice, tuning }: Dependencies): PracticePort {
  return reactive({
    earTrainingAccuracy: practice.accuracy,
    earTrainingAttempts: practice.attempts,
    earTrainingCorrect: practice.correct,
    earTrainingRevealed: practice.revealed,
    earTrainingStreak: practice.streak,
    earTrainingTarget: practice.target,
    getNoteDisplay: tuning.getNoteDisplay,
    metronomeBeat: practice.beat,
    metronomeBeats: practice.beats,
    metronomeBpm: practice.bpm,
    metronomeRunning: practice.isMetronomeRunning,
    metronomeSubdivision: practice.subdivision,
    metronomeSubdivisionStep: practice.subdivisionStep,
    practiceHistory: practice.history,
    practiceSummary: practice.summary,
    clearPracticeHistory: practice.clearHistory,
    exportPracticeStats: practice.exportStats,
    markEarTraining: practice.markEarTraining,
    nextEarTraining: practice.nextChallenge,
    playEarTraining: practice.playTarget,
    resetEarTraining: practice.reset,
    revealEarTraining: practice.reveal,
    setMetronomeBeats: practice.setBeats,
    setMetronomeBpm: practice.setBpm,
    setMetronomeSubdivision: practice.setSubdivision,
    tapMetronome: practice.tapTempo,
    toggleMetronome: practice.toggleMetronome,
  });
}
