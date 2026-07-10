import type { PracticeHistoryEntry } from '../utils/settingsStorage';

export interface PracticeSummary {
  dailyStreak: number;
  todayAccuracy: number;
  todayAttempts: number;
  totalAccuracy: number;
  totalAttempts: number;
}

export function summarizePractice(
  history: PracticeHistoryEntry[],
  now = Date.now(),
): PracticeSummary {
  const todayKey = localDateKey(now);
  const todayEntries = history.filter((entry) => localDateKey(entry.at) === todayKey);
  const totalCorrect = history.filter((entry) => entry.correct).length;
  const todayCorrect = todayEntries.filter((entry) => entry.correct).length;

  return {
    totalAttempts: history.length,
    totalAccuracy: percentage(totalCorrect, history.length),
    todayAttempts: todayEntries.length,
    todayAccuracy: percentage(todayCorrect, todayEntries.length),
    dailyStreak: calculateDailyStreak(history, now),
  };
}

export function calculateDailyStreak(history: PracticeHistoryEntry[], now = Date.now()) {
  const days = new Set(history.map((entry) => localDayNumber(entry.at)));
  if (!days.size) return 0;

  const today = localDayNumber(now);
  let cursor = today;
  if (!days.has(cursor) && days.has(cursor - 1)) cursor -= 1;

  let streak = 0;
  while (days.has(cursor - streak)) streak += 1;
  return streak;
}

function percentage(correct: number, total: number) {
  return total ? Math.round((correct / total) * 100) : 0;
}

function localDayNumber(timestamp: number) {
  const date = new Date(timestamp);
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

function localDateKey(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
