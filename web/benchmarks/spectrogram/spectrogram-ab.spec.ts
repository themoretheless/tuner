import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { platform, release } from 'node:os';
import { dirname, resolve } from 'node:path';
import type {
  BenchmarkVariant,
  BrowserBenchmarkConfig,
  BrowserBenchmarkResult,
} from './harness';

interface BenchmarkReport {
  metadata: {
    browser: string;
    browserVersion: string;
    backingStore: { height: number; width: number };
    buildMode: 'production';
    canvas: { height: number; width: number };
    deviceScaleFactor: number;
    durationMs: number;
    decisionEligible: boolean;
    frameBinCount: number;
    generatedAt: string;
    gitCommit: string;
    gitDirty: boolean;
    gpu: string;
    headless: true;
    legacyFixtureSha256: string;
    os: { platform: string; release: string };
    order: BenchmarkVariant[][];
    profile: 'smoke' | 'strict';
    ringCapacity: 150;
    runtimeBuildToken: string;
    runs: number;
    seed: number;
    updateRateHz: number;
    viewport: { height: number; width: number };
    warmupMs: number;
  };
  results: BrowserBenchmarkResult[];
  summary: null | {
    absolutePairedDispatchDeltaMs: {
      bootstrapMedian95Ci: [number, number];
      medianPairedDelta: number;
      pairedDeltas: number[];
    };
    relativePairedDispatchDelta: {
      bootstrapMedian95Ci: [number, number];
      medianPairedDelta: number;
      pairedDeltas: number[];
    };
  };
  summaryStatus: 'eligible' | 'insufficient-strict-profile';
  schemaVersion: 1;
}

test('legacy vs optimized Canvas spectrogram benchmark', async ({ browser, browserName }) => {
  const viewport = {
    width: envInteger('SPECTROGRAM_BENCHMARK_VIEWPORT_WIDTH', 1280),
    height: envInteger('SPECTROGRAM_BENCHMARK_VIEWPORT_HEIGHT', 720),
  };
  const deviceScaleFactor = envNumber('SPECTROGRAM_BENCHMARK_DPR', 1);
  const runs = envInteger('SPECTROGRAM_BENCHMARK_RUNS', 10);
  const warmupMs = envInteger('SPECTROGRAM_BENCHMARK_WARMUP_MS', 15_000);
  const durationMs = envInteger('SPECTROGRAM_BENCHMARK_DURATION_MS', 60_000);
  const updateRateHz = envNumber('SPECTROGRAM_BENCHMARK_RATE_HZ', 60);
  const frameBinCount = envInteger('SPECTROGRAM_BENCHMARK_BINS', 4096);
  const seed = envInteger('SPECTROGRAM_BENCHMARK_SEED', 0x5eed1234);
  const canvas = {
    width: envInteger('SPECTROGRAM_BENCHMARK_CANVAS_WIDTH', 800),
    height: envInteger('SPECTROGRAM_BENCHMARK_CANVAS_HEIGHT', 120),
  };
  test.setTimeout((runs * 2 * (warmupMs + durationMs + 10_000)) + 30_000);
  const context = await browser.newContext({ deviceScaleFactor, viewport });
  const browserVersion = browser.version();
  const results: BrowserBenchmarkResult[] = [];
  const order: BenchmarkVariant[][] = [];
  let gpu = 'unavailable';

  try {
    for (let runIndex = 0; runIndex < runs; runIndex += 1) {
      const variants: BenchmarkVariant[] = (runIndex + (seed & 1)) % 2 === 0
        ? ['legacy', 'optimized']
        : ['optimized', 'legacy'];
      order.push(variants);
      for (const variant of variants) {
        const page = await context.newPage();
        await page.goto('/benchmarks/spectrogram/fixture.html');
        await page.waitForFunction(() => typeof window.runSpectrogramBenchmark === 'function');
        if (gpu === 'unavailable') {
          gpu = await page.evaluate(() => {
            const probe = document.createElement('canvas').getContext('webgl');
            const extension = probe?.getExtension('WEBGL_debug_renderer_info');
            return extension && probe
              ? String(probe.getParameter(extension.UNMASKED_RENDERER_WEBGL))
              : 'unavailable';
          });
        }
        const config: BrowserBenchmarkConfig = {
          canvasHeight: canvas.height,
          canvasWidth: canvas.width,
          durationMs,
          frameBinCount,
          runIndex,
          seed,
          updateRateHz,
          variant,
          warmupMs,
        };
        const result = await page.evaluate(async (browserConfig) => {
          if (!window.runSpectrogramBenchmark) throw new Error('benchmark harness unavailable');
          return window.runSpectrogramBenchmark(browserConfig);
        }, config);
        results.push(result);
        await page.close();
      }
    }
  } finally {
    await context.close();
  }

  for (let runIndex = 0; runIndex < runs; runIndex += 1) {
    const pair = results.filter((result) => result.runIndex === runIndex);
    expect(pair).toHaveLength(2);
    expect(pair[0].submittedFrames).toBe(pair[1].submittedFrames);
    expect(pair[0].expectedSubmissions).toBe(pair[1].expectedSubmissions);
    expect(pair[0].firstSequence).toBe(pair[1].firstSequence);
    expect(pair[0].lastSequence).toBe(pair[1].lastSequence);
  }
  const paired = pairedMeanDeltas(results, runs);
  const fullRing = results.every((result) => result.warmupSubmissions >= 150);
  const decisionEligible = runs >= 10 && warmupMs >= 15_000 && durationMs >= 60_000 && fullRing;
  const profile = decisionEligible ? 'strict' : 'smoke';
  const fixtureSource = await readFile(new URL('./legacyRenderer.ts', import.meta.url));

  const report: BenchmarkReport = {
    metadata: {
      browser: browserName,
      browserVersion,
      backingStore: {
        width: Math.round(canvas.width * deviceScaleFactor),
        height: Math.round(canvas.height * deviceScaleFactor),
      },
      buildMode: 'production',
      canvas,
      deviceScaleFactor,
      durationMs,
      decisionEligible,
      frameBinCount,
      generatedAt: new Date().toISOString(),
      gitCommit: git('rev-parse', 'HEAD'),
      gitDirty: git('status', '--porcelain').length > 0,
      gpu,
      headless: true,
      legacyFixtureSha256: createHash('sha256').update(fixtureSource).digest('hex'),
      os: { platform: platform(), release: release() },
      order,
      profile,
      ringCapacity: 150,
      runtimeBuildToken: results[0]?.runtimeBuildToken ?? 'missing',
      runs,
      seed,
      updateRateHz,
      viewport,
      warmupMs,
    },
    results,
    schemaVersion: 1,
    summary: decisionEligible ? {
      absolutePairedDispatchDeltaMs: {
        bootstrapMedian95Ci: bootstrapMedianCi(paired.absolute, seed),
        medianPairedDelta: median(paired.absolute),
        pairedDeltas: paired.absolute,
      },
      relativePairedDispatchDelta: {
        bootstrapMedian95Ci: bootstrapMedianCi(paired.relative, seed ^ 0xa5a5a5a5),
        medianPairedDelta: median(paired.relative),
        pairedDeltas: paired.relative,
      },
    } : null,
    summaryStatus: decisionEligible ? 'eligible' : 'insufficient-strict-profile',
  };
  const output = resolve(
    process.cwd(),
    process.env.SPECTROGRAM_BENCHMARK_OUTPUT ?? 'benchmark-results/spectrogram-ab.json',
  );
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  expect(results).toHaveLength(runs * 2);
  expect(results.every((result) => result.activeDraws > 0)).toBe(true);
  expect(results.every((result) => result.cpuDrawDispatchMs.max > 0)).toBe(true);
  expect(results.every((result) => result.drawDispatchIntervalMs.max > 0)).toBe(true);
  expect(results.every((result) => result.visiblePixelCount > 0)).toBe(true);
  expect(results.every((result) => result.semanticPixels.topGreen > 0)).toBe(true);
  expect(results.every((result) => result.semanticPixels.bottomHot > 0)).toBe(true);
  expect(results.every((result) => result.semanticPixels.middleGreen > 0)).toBe(true);
  expect(results.every((result) => result.semanticPixels.rightHot > 0)).toBe(true);
  expect(results.every((result) => result.visualChecksum !== 0)).toBe(true);
});

function pairedMeanDeltas(results: BrowserBenchmarkResult[], runs: number) {
  const pairs = Array.from({ length: runs }, (_, runIndex) => {
    const legacy = results.find((result) => result.runIndex === runIndex && result.variant === 'legacy');
    const optimized = results.find((result) => result.runIndex === runIndex && result.variant === 'optimized');
    if (!legacy || !optimized) throw new Error(`missing A/B pair for run ${runIndex}`);
    const absolute = optimized.cpuDrawDispatchMs.mean - legacy.cpuDrawDispatchMs.mean;
    return { absolute, relative: absolute / legacy.cpuDrawDispatchMs.mean };
  });
  return {
    absolute: pairs.map((pair) => pair.absolute),
    relative: pairs.map((pair) => pair.relative),
  };
}

function bootstrapMedianCi(values: number[], seed: number): [number, number] {
  let state = seed >>> 0;
  const samples: number[] = [];
  for (let iteration = 0; iteration < 10_000; iteration += 1) {
    const resample: number[] = [];
    for (let index = 0; index < values.length; index += 1) {
      state = ((state * 1664525) + 1013904223) >>> 0;
      resample.push(values[state % values.length]);
    }
    samples.push(median(resample));
  }
  samples.sort((left, right) => left - right);
  return [samples[249], samples[9749]];
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function git(...args: string[]) {
  return execFileSync('git', args, { cwd: resolve(process.cwd(), '..'), encoding: 'utf8' }).trim();
}

function envInteger(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be positive`);
  return value;
}
