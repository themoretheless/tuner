import { describe, expect, it } from 'vitest';

import { createDefaultFrameContext } from '../src/domain/frameContext';
import { StreamingPitchTracker } from '../src/utils/pitchTracking';

const loud = { maxAbs: 0.08, rms: 0.02 };

describe('streaming pitch fallback', () => {
  it('waits for a coherent pitch instead of blending attack estimates', () => {
    const tracker = new StreamingPitchTracker();
    expect(tracker.update({ confidence: 0.82, frequency: 67 }, loud)).toBeNull();
    expect(tracker.update({ confidence: 0.86, frequency: 74 }, loud)).toBeNull();
    expect(tracker.update({ confidence: 0.9, frequency: 82.4 }, loud)).toBeNull();
    expect(tracker.update({ confidence: 0.92, frequency: 82.5 }, loud)?.frequency)
      .toBeCloseTo(82.45, 1);
  });

  it('does not publish stable low-level room hum', () => {
    const tracker = new StreamingPitchTracker();
    tracker.setContext(createDefaultFrameContext());
    const noise = { maxAbs: 0.016, rms: 0.004 };
    for (let frame = 0; frame < 12; frame += 1) {
      expect(tracker.update({ confidence: 0.78, frequency: 55 }, noise)).toBeNull();
    }
  });

  it('accepts a clean soft note without learning it as startup noise', () => {
    const tracker = new StreamingPitchTracker();
    const soft = { maxAbs: 0.024, rms: 0.006 };
    expect(tracker.update({ confidence: 0.95, frequency: 220 }, soft)).toBeNull();
    expect(tracker.update({ confidence: 0.95, frequency: 220.1 }, soft)?.frequency)
      .toBeCloseTo(220.05, 1);
  });

  it('folds an imprecise low-E harmonic near 160 Hz in string mode', () => {
    const tracker = new StreamingPitchTracker();
    tracker.setContext({
      ...createDefaultFrameContext(),
      tuningTargets: [
        { frequency: 82.4069, name: 'E', octave: 2 },
        { frequency: 110, name: 'A', octave: 2 },
        { frequency: 146.8324, name: 'D', octave: 3 },
      ],
    });
    expect(tracker.update({ confidence: 0.9, frequency: 160 }, loud)).toBeNull();
    expect(tracker.update({ confidence: 0.92, frequency: 160.2 }, loud)?.frequency)
      .toBeCloseTo(80.05, 1);
  });

  it('rejects a loud shared subharmonic outside the selected string', () => {
    const tracker = new StreamingPitchTracker();
    tracker.setContext({
      ...createDefaultFrameContext(),
      selectedTarget: { frequency: 82.4069, name: 'E', octave: 2 },
      tuningTargets: [{ frequency: 82.4069, name: 'E', octave: 2 }],
    });
    for (let frame = 0; frame < 5; frame += 1) {
      expect(tracker.update({ confidence: 0.96, frequency: 55 }, loud)).toBeNull();
    }
    for (let frame = 0; frame < 5; frame += 1) {
      expect(tracker.update({ confidence: 0.96, frequency: 110 }, loud)).toBeNull();
    }
  });
});
