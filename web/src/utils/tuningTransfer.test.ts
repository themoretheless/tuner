import { describe, expect, it } from 'vitest';

import {
  TUNING_TRANSFER_VERSION,
  createTuningTransferDocument,
  parseTuningTransfer,
} from './tuningTransfer';

const validTuning = {
  id: 'my tuning',
  name: 'My Tuning',
  strings: [
    { name: 'E', octave: 2, frequency: 1 },
    { name: 'A', octave: 2, frequency: 1 },
  ],
};

describe('tuning transfer validation', () => {
  it('accepts versioned and legacy documents and recomputes note frequencies', () => {
    const versioned = parseTuningTransfer({
      version: TUNING_TRANSFER_VERSION,
      tunings: [validTuning],
    }, 'guitar', 'fallback');
    expect(versioned.rejected).toBe(0);
    expect(versioned.tunings[0].id).toBe('my-tuning');
    expect(versioned.tunings[0].strings[0].frequency).toBeGreaterThan(80);

    const legacy = parseTuningTransfer([validTuning], 'guitar', 'legacy');
    expect(legacy.tunings).toHaveLength(1);
  });

  it('rejects unknown versions and malformed nested strings', () => {
    expect(() => parseTuningTransfer({ version: 999, tunings: [] }, 'guitar')).toThrow(
      'Unsupported tuning file version',
    );

    const result = parseTuningTransfer({
      version: TUNING_TRANSFER_VERSION,
      tunings: [
        { ...validTuning, strings: [{ name: 'H', octave: 2 }] },
        { ...validTuning, strings: [{ name: 'E', octave: 9 }] },
        { ...validTuning, strings: 'E2 A2' },
      ],
    }, 'guitar');
    expect(result.tunings).toHaveLength(0);
    expect(result.rejected).toBe(3);
  });

  it('replaces non-string IDs and enforces tuning and string limits', () => {
    const manyTunings = Array.from({ length: 257 }, (_, index) => ({
      ...validTuning,
      id: index === 0 ? 42 : `valid-${index}`,
    }));
    const result = parseTuningTransfer(manyTunings, 'guitar', 'generated');
    expect(result.tunings).toHaveLength(256);
    expect(result.tunings[0].id).toBe('generated-0');
    expect(result.rejected).toBe(1);

    const tooManyStrings = parseTuningTransfer([{
      ...validTuning,
      strings: Array.from({ length: 25 }, () => ({ name: 'E', octave: 2 })),
    }], 'guitar');
    expect(tooManyStrings.tunings).toHaveLength(0);
    expect(tooManyStrings.rejected).toBe(1);
  });

  it('creates an isolated versioned export document', () => {
    const source = parseTuningTransfer([validTuning], 'guitar').tunings;
    const document = createTuningTransferDocument(source);
    expect(document.version).toBe(TUNING_TRANSFER_VERSION);
    expect(document.tunings).toEqual(source);
    expect(document.tunings).not.toBe(source);
    expect(document.tunings[0].strings).not.toBe(source[0].strings);
  });
});
