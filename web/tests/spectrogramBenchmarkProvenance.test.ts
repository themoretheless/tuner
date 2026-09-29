import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SOURCE_COMMIT = '57e71dcf6cd37d097e82b8110b504549d0b7fea8';
const SOURCE_PATH = 'web/src/components/Spectrogram.vue';
const ORIGINAL_SHA256 = '6a6e94acdfcb535408a403a30ea22d27575c1753f766344a4fc6551e4c620633';
// Update only when deliberately replacing the benchmark fixture after review.
const FIXTURE_SHA256 = '3b3a045a398e4e4a59926250cc36cada36955c3ca354543df08cb76e8b96951a';

const repository = fileURLToPath(new URL('../..', import.meta.url));

// The pinned original lives in git history. Mirrors, shallow clones and
// squashed checkouts do not carry commit 57e71dc…, so the provenance half of
// the gate is skipped there instead of failing on a git error. CI checks out
// the full history (fetch-depth: 0 in build-web.yml), so the gate stays
// blocking where it matters.
const hasPinnedCommit = (() => {
  try {
    execFileSync('git', ['cat-file', '-e', `${SOURCE_COMMIT}^{commit}`], {
      cwd: repository,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
})();

describe('spectrogram benchmark legacy provenance', () => {
  it.skipIf(!hasPinnedCommit)('matches the pinned original source', () => {
    const original = execFileSync(
      'git',
      ['show', `${SOURCE_COMMIT}:${SOURCE_PATH}`],
      { cwd: repository },
    );
    expect(sha256(original)).toBe(ORIGINAL_SHA256);
  });

  it('matches the frozen benchmark fixture', () => {
    const fixture = readFileSync(new URL('../benchmarks/spectrogram/legacyRenderer.ts', import.meta.url));
    expect(sha256(fixture)).toBe(FIXTURE_SHA256);
  });
});

function sha256(value: Buffer) {
  return createHash('sha256').update(value).digest('hex');
}
