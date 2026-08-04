import type { Ref } from 'vue';
import type { PracticeSummary } from '../../../domain/practice';
import type { Note } from '../../../utils/notes';
import type { PracticeHistoryEntry } from '../../../utils/settingsStorage';

export interface PracticeCapability {
  accuracy: Readonly<Ref<number>>;
  attempts: Readonly<Ref<number>>;
  beat: Readonly<Ref<number>>;
  beats: Ref<number>;
  bpm: Ref<number>;
  canMark: Readonly<Ref<boolean>>;
  clearHistory(): void;
  correct: Readonly<Ref<number>>;
  exportStats(): string;
  history: Ref<PracticeHistoryEntry[]>;
  isMetronomeRunning: Readonly<Ref<boolean>>;
  markEarTraining(isCorrect: boolean): void;
  nextChallenge(): void;
  playTarget(durationMs?: number): void;
  reset(): void;
  reveal(): void;
  revealed: Readonly<Ref<boolean>>;
  setBeats(value: number): void;
  setBpm(value: number): void;
  setSubdivision(value: number): void;
  streak: Readonly<Ref<number>>;
  subdivision: Ref<number>;
  subdivisionStep: Readonly<Ref<number>>;
  summary: Readonly<Ref<PracticeSummary>>;
  tapTempo(): void;
  target: Readonly<Ref<Note | null>>;
  toggleMetronome(): Promise<boolean>;
}
