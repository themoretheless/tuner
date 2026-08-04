import type { PracticeSummary } from '../../domain/practice';
import type { Note } from '../../utils/notes';
import type { PracticeHistoryEntry } from '../../utils/settingsStorage';

export interface PracticePort {
  clearPracticeHistory(): void;
  earTrainingAccuracy: number;
  earTrainingAttempts: number;
  earTrainingCanMark: boolean;
  earTrainingCorrect: number;
  earTrainingRevealed: boolean;
  earTrainingStreak: number;
  earTrainingTarget: Note | null;
  exportPracticeStats(): string;
  getNoteDisplay(note: Pick<Note, 'name' | 'octave'>): string;
  markEarTraining(isCorrect: boolean): void;
  metronomeBeat: number;
  metronomeBeats: number;
  metronomeBpm: number;
  metronomeRunning: boolean;
  metronomeSubdivision: number;
  metronomeSubdivisionStep: number;
  nextEarTraining(): void;
  playEarTraining(durationMs?: number): void;
  practiceHistory: PracticeHistoryEntry[];
  practiceSummary: PracticeSummary;
  resetEarTraining(): void;
  revealEarTraining(): void;
  setMetronomeBeats(value: number): void;
  setMetronomeBpm(value: number): void;
  setMetronomeSubdivision(value: number): void;
  tapMetronome(): void;
  toggleMetronome(): Promise<boolean>;
}
