import { describe, expect, it } from 'vitest';

import manifest from '../../fixtures/smoothing-parity.json';
import { FrequencySmoother } from '../src/utils/pitch';

interface SmoothingTrace {
  id: string;
  inputs: Array<number | null>;
  outputs: Array<number | null>;
}

describe('smoothing parity', () => {
  it('matches the shared native and TypeScript traces', () => {
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.alpha).toBe(0.4);
    expect(manifest.historyCapacity).toBe(5);

    for (const trace of manifest.traces as SmoothingTrace[]) {
      const smoother = new FrequencySmoother();
      expect(trace.inputs.map((input) => smoother.add(input)), trace.id).toEqual(
        trace.outputs.map((output) => output == null ? null : expect.closeTo(output, 6)),
      );
    }
  });
});
