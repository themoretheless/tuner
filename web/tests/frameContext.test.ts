import { describe, expect, it } from 'vitest';

import { createFrameContext } from '../src/domain/frameContext';
import { TEMPERAMENTS, noteWithA4 } from '../src/utils/notes';

describe('FrameContext', () => {
  it('serializes resolved A4, tuning and selected-string targets', () => {
    const lowA = noteWithA4({ name: 'A', octave: 2 }, 442);
    const highA = noteWithA4({ name: 'A', octave: 3 }, 442);
    const context = createFrameContext({
      a4: 442,
      isChromaticMode: false,
      selectedString: highA,
      strings: [lowA, highA],
      temperament: 'equal',
      temperamentOptions: TEMPERAMENTS,
      temperamentRoot: 'A',
      transpose: 0,
    });

    expect(context.a4).toBe(442);
    expect(context.tuningTargets).toEqual([lowA, highA]);
    expect(context.selectedTarget).toEqual(highA);
    expect(context.idleTarget).toEqual(highA);
    expect(context.displayTargets.find((note) => note.name === 'A' && note.octave === 4)?.frequency)
      .toBeCloseTo(442, 6);
  });

  it('uses a stable transposed idle target in chromatic mode', () => {
    const context = createFrameContext({
      a4: 440,
      isChromaticMode: true,
      selectedString: null,
      strings: [],
      temperament: 'equal',
      temperamentOptions: TEMPERAMENTS,
      temperamentRoot: 'C',
      transpose: 2,
    });

    expect(context.tuningTargets).toEqual([]);
    expect(context.idleTarget).toMatchObject({ name: 'D', octave: 4 });
  });
});
