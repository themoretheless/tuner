import { describe, expect, it } from 'vitest';

import { useSyntheticAudioInput } from '../src/composables/useSyntheticAudioInput';
import { resolveSyntheticAudioFixture } from '../src/utils/syntheticAudio';

describe('synthetic audio input timeline', () => {
  it('is idempotent between audio ticks regardless of polling rate', async () => {
    let now = 0;
    const input = useSyntheticAudioInput(
      resolveSyntheticAudioFixture('E2'),
      8192,
      () => now,
    );
    await input.start();

    const first = input.readFrame();
    const repeated = input.readFrame();
    now = 32;
    const beforeTick = input.readFrame();
    now = 33;
    const afterTick = input.readFrame();

    expect(first?.timebase).toEqual({
      endSample: 8192,
      source: 'synthetic',
      startSample: 0,
    });
    expect(repeated?.timebase).toEqual(first?.timebase);
    expect(beforeTick?.timebase).toEqual(first?.timebase);
    expect(afterTick?.timebase).toEqual({
      endSample: 8192 + 1455,
      source: 'synthetic',
      startSample: 1455,
    });
  });

  it('catches up by sample-indexed hops instead of number of reads', async () => {
    let now = 0;
    const input = useSyntheticAudioInput(
      resolveSyntheticAudioFixture('E2'),
      8192,
      () => now,
    );
    await input.start();
    input.readFrame();
    now = 99;

    expect(input.readFrame()?.timebase?.startSample).toBe(4366);
  });
});
