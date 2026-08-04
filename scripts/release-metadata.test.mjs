import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  createReleasePlan,
  readAndValidateVersion,
  runCli,
} from './release-metadata.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('validates the repository version metadata', () => {
  const expected = JSON.parse(readFileSync(join(repositoryRoot, 'version.json'), 'utf8')).version;
  assert.equal(readAndValidateVersion(repositoryRoot), expected);
});

test('rejects mismatched package metadata', (context) => {
  const fixture = mkdtempSync(join(tmpdir(), 'tuner-release-metadata-'));
  context.after(() => rmSync(fixture, { recursive: true, force: true }));
  mkdirSync(join(fixture, 'web'));
  writeFileSync(join(fixture, 'version.json'), '{"version":"1.2.3"}\n');
  writeFileSync(join(fixture, 'web/package.json'), '{"version":"1.2.4"}\n');
  writeFileSync(join(fixture, 'Cargo.toml'), '[workspace.package]\nversion = "1.2.3"\n');

  assert.throws(
    () => readAndValidateVersion(fixture),
    /web\/package\.json: expected 1\.2\.3, got 1\.2\.4/,
  );
});

test('creates stable and deterministic prerelease plans', () => {
  assert.deepEqual(
    createReleasePlan({ version: '1.2.3' }),
    { tag: 'v1.2.3', is_pre: 'false', skip: 'false' },
  );
  assert.deepEqual(
    createReleasePlan({
      version: '1.2.3',
      prerelease: 'true',
      now: new Date('2026-08-04T07:08:09Z'),
      stableTagExists: true,
    }),
    { tag: 'v1.2.3-rc.20260804070809', is_pre: 'true', skip: 'true' },
  );
});

test('validate CLI appends the version to GitHub outputs', (context) => {
  const fixture = mkdtempSync(join(tmpdir(), 'tuner-release-output-'));
  context.after(() => rmSync(fixture, { recursive: true, force: true }));
  const output = join(fixture, 'github-output');
  writeFileSync(output, '');

  runCli([
    'validate',
    '--root', repositoryRoot,
    '--github-output', output,
  ], {});

  const version = JSON.parse(readFileSync(join(repositoryRoot, 'version.json'), 'utf8')).version;
  assert.equal(readFileSync(output, 'utf8'), `version=${version}\n`);
});
