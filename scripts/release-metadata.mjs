#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const JSON_VERSION_FILES = ['web/package.json'];
const CARGO_VERSION_FILES = ['Cargo.toml'];

export function readAndValidateVersion(rootDirectory = process.cwd()) {
  const read = (file) => readFileSync(resolve(rootDirectory, file), 'utf8');
  const expected = JSON.parse(read('version.json')).version;

  for (const file of JSON_VERSION_FILES) {
    const actual = JSON.parse(read(file)).version;
    if (actual !== expected) {
      throw new Error(`${file}: expected ${expected}, got ${actual}`);
    }
  }

  for (const file of CARGO_VERSION_FILES) {
    const match = read(file).match(/^version = "([^"]+)"$/m);
    if (!match || match[1] !== expected) {
      throw new Error(`${file}: workspace version must be ${expected}`);
    }
  }

  if (!VERSION_PATTERN.test(expected)) {
    throw new Error(`invalid release version: ${expected}`);
  }

  return expected;
}

export function formatReleaseTimestamp(date) {
  const part = (value) => String(value).padStart(2, '0');
  return [
    date.getUTCFullYear(),
    part(date.getUTCMonth() + 1),
    part(date.getUTCDate()),
    part(date.getUTCHours()),
    part(date.getUTCMinutes()),
    part(date.getUTCSeconds()),
  ].join('');
}

export function createReleasePlan({
  version,
  prerelease = false,
  now = new Date(),
  stableTagExists = false,
}) {
  const isPrerelease = prerelease === true || prerelease === 'true';
  const tag = isPrerelease
    ? `v${version}-rc.${formatReleaseTimestamp(now)}`
    : `v${version}`;

  return {
    tag,
    is_pre: String(isPrerelease),
    skip: String(stableTagExists),
  };
}

export function writeGitHubOutput(outputPath, values) {
  if (!outputPath) {
    throw new Error('GITHUB_OUTPUT is not set; pass --github-output when running locally');
  }

  const lines = Object.entries(values).map(([name, value]) => `${name}=${value}`);
  appendFileSync(outputPath, `${lines.join('\n')}\n`);
}

export function stableReleaseExists(rootDirectory, version) {
  try {
    execFileSync('git', ['rev-parse', `v${version}`], {
      cwd: rootDirectory,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

export function runCli(argv = process.argv.slice(2), environment = process.env) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      'github-output': { type: 'string' },
      prerelease: { type: 'string', default: 'false' },
      root: { type: 'string', default: process.cwd() },
    },
    strict: true,
  });

  if (positionals.length !== 1 || !['validate', 'release'].includes(positionals[0])) {
    throw new Error('usage: release-metadata.mjs <validate|release> [--github-output PATH]');
  }

  const command = positionals[0];
  const rootDirectory = resolve(values.root);
  const outputPath = values['github-output'] ?? environment.GITHUB_OUTPUT;
  const version = readAndValidateVersion(rootDirectory);

  if (command === 'validate') {
    writeGitHubOutput(outputPath, { version });
    return;
  }

  const stableTagExists = stableReleaseExists(rootDirectory, version);
  const plan = createReleasePlan({
    version,
    prerelease: values.prerelease,
    stableTagExists,
  });
  writeGitHubOutput(outputPath, plan);

  if (stableTagExists) {
    console.log(`Version v${version} already released, skipping`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
