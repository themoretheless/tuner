import { describe, expect, it } from 'vitest';
import {
  createInTuneLatch,
  createStickyTargetSelector,
  shouldKeepPreviousTarget,
} from '../src/domain/tuningTracking';

describe('tuning tracking', () => {
  it('keeps the previous target until the candidate wins by the switch margin', () => {
    const e2 = { frequency: 82.4069 };
    const a2 = { frequency: 110 };

    expect(shouldKeepPreviousTarget(95.5, e2, a2, 15)).toBe(true);
    expect(shouldKeepPreviousTarget(104, e2, a2, 15)).toBe(false);
  });

  it('forgets a sticky target when it is no longer reusable', () => {
    const selector = createStickyTargetSelector<{ frequency: number; id: string }>();
    const first = selector.select(95, { frequency: 82.4069, id: 'e2' });
    const next = selector.select(95.5, { frequency: 110, id: 'a2' }, () => false);

    expect(first.id).toBe('e2');
    expect(next.id).toBe('a2');
  });

  it('uses separate enter and exit thresholds for in-tune stability', () => {
    const latch = createInTuneLatch(5, 7);

    expect(latch.update(true, 4.9)).toBe(true);
    expect(latch.update(true, 6.5)).toBe(true);
    expect(latch.update(true, 7.1)).toBe(false);
    expect(latch.update(false, 0)).toBe(false);
  });
});
