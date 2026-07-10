import { describe, expect, it } from 'vitest';

import { calculateDailyStreak, summarizePractice } from '../src/domain/practice';
import type { PracticeHistoryEntry } from '../src/utils/settingsStorage';

function entry(daysAgo: number, correct: boolean, now: Date): PracticeHistoryEntry {
  return {
    at: new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - daysAgo,
      12,
    ).getTime(),
    correct,
    note: 'A4',
  };
}

describe('practice summary', () => {
  it('computes total and today accuracy independently', () => {
    const now = new Date(2026, 6, 10, 18);
    const history = [
      entry(0, true, now),
      entry(0, false, now),
      entry(1, true, now),
      entry(2, true, now),
    ];

    expect(summarizePractice(history, now.getTime())).toEqual({
      dailyStreak: 3,
      todayAccuracy: 50,
      todayAttempts: 2,
      totalAccuracy: 75,
      totalAttempts: 4,
    });
  });

  it('keeps a streak alive when the latest practice was yesterday', () => {
    const now = new Date(2026, 6, 10, 9);
    const history = [entry(1, true, now), entry(2, true, now), entry(3, false, now)];

    expect(calculateDailyStreak(history, now.getTime())).toBe(3);
  });

  it('returns zero for an empty history', () => {
    expect(summarizePractice([], new Date(2026, 6, 10).getTime())).toEqual({
      dailyStreak: 0,
      todayAccuracy: 0,
      todayAttempts: 0,
      totalAccuracy: 0,
      totalAttempts: 0,
    });
  });
});
