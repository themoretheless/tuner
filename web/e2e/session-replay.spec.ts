import { expect, test } from '@playwright/test';

import { runBrowserSessionReplay } from './support/browserSessionReplay';
import {
  compareReplayFrames,
  prepareSessionReplayCases,
  sessionReplayContract,
} from './support/sessionReplayContract';

test('licensed PCM sessions match between native Rust and browser WASM', async ({ page }) => {
  test.setTimeout(120_000);
  expect(sessionReplayContract.schemaVersion).toBe(1);
  expect(sessionReplayContract.configRevision).toBe('session-replay-v1');
  const cases = prepareSessionReplayCases();

  await page.goto('/');
  const browserResults = await runBrowserSessionReplay(
    page,
    cases,
    sessionReplayContract.range,
    sessionReplayContract.windowSamples,
  );

  for (const replayCase of cases) {
    const browser = browserResults.find((candidate) => candidate.id === replayCase.id);
    expect(browser, `${replayCase.id} browser replay`).toBeDefined();
    expect(browser!.frames).toHaveLength(replayCase.nativeFrames.length);
    expect(
      browser!.frames.some((frame) => frame.publishedFrequency !== null),
      `${replayCase.id} should acquire a pitch`,
    ).toBe(true);

    for (let index = 0; index < replayCase.nativeFrames.length; index += 1) {
      compareReplayFrames(
        replayCase.id,
        index,
        replayCase.nativeFrames[index]!,
        browser!.frames[index]!,
      );
    }
  }
});
