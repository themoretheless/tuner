import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from '@playwright/test';
import { decodePcmWav } from './pcmWav';

export interface ReplayTarget {
  frequency: number;
  midi: number;
  name: string;
  octave: number;
}
interface ReplayCase {
  capture: string;
  id: string;
  target: ReplayTarget;
}
export interface ReplayRange {
  maxFrequency: number;
  minFrequency: number;
}
interface ReplayTolerances {
  cents: number;
  confidence: number;
  frequencyCents: number;
  rawFrequencyCents: number;
  rms: number;
}

interface ReplayContract {
  cases: ReplayCase[];
  configRevision: string;
  hopSeconds: number;
  maximumFrames: number;
  range: ReplayRange;
  schemaVersion: number;
  tolerances: ReplayTolerances;
  windowSamples: number;
}

export interface ReplayFrame {
  adaptiveGateOpen: boolean;
  arbitration: string;
  cents: number;
  confidence: number;
  decision: string;
  fixedGateOpen: boolean;
  held: boolean;
  inTune: boolean;
  isPower: boolean;
  note: string;
  publishedFrequency: number | null;
  rawFrequency: number | null;
  rms: number;
  sampleIndex: number;
  targetFrequency: number | null;
  tracked: boolean;
  windowEndSample: number;
}

export interface PreparedReplayCase {
  hopSamples: number;
  id: string;
  nativeFrames: ReplayFrame[];
  sampleRate: number;
  samples: number[];
  target: ReplayTarget;
}

interface NativeReplay {
  capture: {
    sampleRate: number;
  };
  configuration: {
    hopSamples: number;
    windowSamples: number;
  };
  frames: ReplayFrame[];
  schemaVersion: number;
}

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const fixturesRoot = join(repositoryRoot, 'fixtures');

export const sessionReplayContract = JSON.parse(readFileSync(
  join(fixturesRoot, 'session-replay.json'),
  'utf8',
)) as ReplayContract;

export function prepareSessionReplayCases(): PreparedReplayCase[] {
  return sessionReplayContract.cases.map((replayCase) => {
    const capturePath = join(fixturesRoot, replayCase.capture);
    const native = runNativeReplay(capturePath, replayCase.target.frequency);
    expect(native.schemaVersion).toBe(2);
    expect(native.configuration.windowSamples).toBe(sessionReplayContract.windowSamples);
    expect(native.configuration.hopSamples).toBe(
      Math.round(native.capture.sampleRate * sessionReplayContract.hopSeconds),
    );
    const requiredSamples = sessionReplayContract.windowSamples
      + (sessionReplayContract.maximumFrames - 1) * native.configuration.hopSamples;
    const wav = decodePcmWav(capturePath, requiredSamples);
    expect(wav.sampleRate).toBe(native.capture.sampleRate);
    return {
      id: replayCase.id,
      nativeFrames: native.frames.slice(0, sessionReplayContract.maximumFrames),
      sampleRate: wav.sampleRate,
      samples: wav.samples,
      target: replayCase.target,
      hopSamples: native.configuration.hopSamples,
    };
  });
}

export function compareReplayFrames(
  id: string,
  index: number,
  native: ReplayFrame,
  browser: ReplayFrame,
) {
  const label = `${id} frame ${index}`;
  expect(browser.sampleIndex, `${label} sample index`).toBe(native.sampleIndex);
  expect(browser.windowEndSample, `${label} window end`).toBe(native.windowEndSample);
  expectOptionalFrequency(
    browser.rawFrequency,
    native.rawFrequency,
    sessionReplayContract.tolerances.rawFrequencyCents,
    `${label} raw frequency`,
  );
  expectOptionalFrequency(
    browser.publishedFrequency,
    native.publishedFrequency,
    sessionReplayContract.tolerances.frequencyCents,
    `${label} published frequency`,
  );
  expectOptionalFrequency(
    browser.targetFrequency,
    native.targetFrequency,
    sessionReplayContract.tolerances.frequencyCents,
    `${label} target frequency`,
  );
  expect(Math.abs(browser.cents - native.cents), `${label} cents`).toBeLessThanOrEqual(
    sessionReplayContract.tolerances.cents,
  );
  expect(
    Math.abs(browser.confidence - native.confidence),
    `${label} confidence`,
  ).toBeLessThanOrEqual(sessionReplayContract.tolerances.confidence);
  expect(Math.abs(browser.rms - native.rms), `${label} RMS`).toBeLessThanOrEqual(
    sessionReplayContract.tolerances.rms,
  );
  expect(browser.note, `${label} note`).toBe(native.note);
  expect(browser.inTune, `${label} in-tune state`).toBe(native.inTune);
  expect(browser.isPower, `${label} power state`).toBe(native.isPower);
  expect(browser.fixedGateOpen, `${label} fixed gate`).toBe(native.fixedGateOpen);
  expect(browser.adaptiveGateOpen, `${label} adaptive gate`).toBe(native.adaptiveGateOpen);
  expect(browser.arbitration, `${label} arbitration`).toBe(native.arbitration);
  expect(browser.decision, `${label} decision`).toBe(native.decision);
  expect(browser.held, `${label} held state`).toBe(native.held);
  expect(browser.tracked, `${label} tracked state`).toBe(native.tracked);
}

function runNativeReplay(capturePath: string, targetFrequency: number): NativeReplay {
  return JSON.parse(execFileSync('cargo', [
    'run',
    '--quiet',
    '-p',
    'pitch-core',
    '--example',
    'trace',
    '--',
    capturePath,
    '--range',
    String(sessionReplayContract.range.minFrequency),
    String(sessionReplayContract.range.maxFrequency),
    '--target',
    String(targetFrequency),
    '--max-frames',
    String(sessionReplayContract.maximumFrames),
    '--json',
  ], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })) as NativeReplay;
}

function expectOptionalFrequency(
  actual: number | null,
  expected: number | null,
  toleranceCents: number,
  label: string,
) {
  expect(actual === null, `${label} presence`).toBe(expected === null);
  if (actual === null || expected === null) return;
  expect(centsError(actual, expected), label).toBeLessThanOrEqual(toleranceCents);
}

function centsError(actual: number, expected: number) {
  return Math.abs(1_200 * Math.log2(actual / expected));
}
