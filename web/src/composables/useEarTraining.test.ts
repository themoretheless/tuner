import { describe, expect, it, vi } from 'vitest';

import { useEarTraining } from './useEarTraining';

const note = { name: 'A' as const, octave: 4, frequency: 440 };

describe('useEarTraining', () => {
  it('records at most one answer for an existing challenge', () => {
    const play = vi.fn();
    const training = useEarTraining(() => note, play);

    expect(training.mark(true)).toBe(false);
    expect(training.attempts.value).toBe(0);

    training.nextChallenge();
    expect(training.canMark.value).toBe(true);
    expect(training.mark(true)).toBe(true);
    expect(training.mark(false)).toBe(false);
    expect(training.attempts.value).toBe(1);
    expect(training.correct.value).toBe(1);
    expect(training.answered.value).toBe(true);
  });

  it('treats revealing as answering without adding a scored attempt', () => {
    const training = useEarTraining(() => note, vi.fn());
    training.nextChallenge();
    training.reveal();
    expect(training.canMark.value).toBe(false);
    expect(training.mark(true)).toBe(false);
    expect(training.attempts.value).toBe(0);
  });
});
