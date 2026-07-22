import { describe, expect, it } from 'vitest';

import { normalizePersistedNote } from './useSettings';

describe('persisted note normalization', () => {
  it('recomputes missing, zero, and non-finite frequencies from note identity', () => {
    for (const frequency of [undefined, 0, Number.NaN]) {
      const note = normalizePersistedNote({ name: 'A', octave: 4, frequency });
      expect(note?.frequency).toBeCloseTo(440, 6);
    }
  });

  it('rejects unknown note names', () => {
    expect(normalizePersistedNote({ name: 'H', octave: 4, frequency: 440 })).toBeNull();
  });
});
