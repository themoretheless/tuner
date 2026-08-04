import { CanvasSpectrogramRenderer } from '../../src/rendering/canvasSpectrogramRenderer';
import { SpectrogramMetrics } from '../../src/rendering/spectrogramMetrics';
import type { SpectrumFrame } from '../../src/types/frames';
import { createLegacyDrawable } from './legacyRenderer';

export type BenchmarkVariant = 'legacy' | 'optimized';

export interface BrowserBenchmarkConfig {
  canvasHeight: number;
  canvasWidth: number;
  durationMs: number;
  frameBinCount: number;
  runIndex: number;
  seed: number;
  updateRateHz: number;
  variant: BenchmarkVariant;
  warmupMs: number;
}

export interface BrowserBenchmarkResult {
  activeDraws: number;
  cpuDrawDispatchMs: Distribution;
  drawDispatchIntervalMs: Distribution;
  elapsedMs: number;
  expectedSubmissions: number;
  firstSequence: number;
  generatedFrames: number;
  lastSequence: number;
  longTasks: { count: number; maxMs: number; totalMs: number } | null;
  missedTargetSlots: number;
  missedTargetSlotRate: number;
  runtimeBuildToken: string;
  submittedFrames: number;
  targetDurationMs: number;
  runIndex: number;
  semanticPixels: {
    bottomHot: number;
    middleGreen: number;
    rightHot: number;
    topGreen: number;
  };
  updateRateHz: number;
  variant: BenchmarkVariant;
  visualChecksum: number;
  visiblePixelCount: number;
  warmupMs: number;
  warmupSubmissions: number;
}

declare const __SPECTROGRAM_BENCHMARK_BUILD__: string;

interface Distribution {
  max: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
}

interface Drawable {
  draw(frame: SpectrumFrame): void;
  reset(): void;
}

declare global {
  interface Window {
    runSpectrogramBenchmark?: (config: BrowserBenchmarkConfig) => Promise<BrowserBenchmarkResult>;
  }
}

window.runSpectrogramBenchmark = async (config) => {
  const canvas = document.querySelector<HTMLCanvasElement>('#benchmark-canvas');
  if (!canvas) throw new Error('benchmark canvas is missing');
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${config.canvasWidth}px`;
  canvas.style.height = `${config.canvasHeight}px`;
  canvas.width = Math.round(config.canvasWidth * dpr);
  canvas.height = Math.round(config.canvasHeight * dpr);
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas 2D is unavailable');
  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  const frames = createFixedFrames(config);
  const createDrawable = () => config.variant === 'legacy'
    ? createLegacyDrawable(context, config.canvasWidth, config.canvasHeight)
    : createOptimizedDrawable(canvas, context, config.canvasWidth, config.canvasHeight);
  const correctness = createDrawable();
  const probeFrames = createSemanticProbeFrames(config.frameBinCount);
  for (const frame of probeFrames) correctness.draw(frame);
  const visual = sampleVisualOutput(context, canvas.width, canvas.height);
  const semanticPixels = semanticProbe(context, canvas.width, canvas.height);
  correctness.reset();

  const drawable = createDrawable();
  const warmup = await runPhase(drawable, frames, config.updateRateHz, config.warmupMs, false);
  const longTasks = observeLongTasks();
  const measured = await runPhase(drawable, frames, config.updateRateHz, config.durationMs, true);
  const measuredUntil = performance.now();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  const finalizedLongTasks = collectLongTasks(longTasks, measuredUntil);
  longTasks?.observer.disconnect();
  drawable.reset();

  return {
    activeDraws: measured.drawDurations.length,
    cpuDrawDispatchMs: distribution(measured.drawDurations),
    drawDispatchIntervalMs: distribution(measured.intervals),
    elapsedMs: measured.elapsedMs,
    expectedSubmissions: measured.expectedSubmissions,
    firstSequence: measured.firstSequence,
    generatedFrames: frames.length,
    lastSequence: measured.lastSequence,
    longTasks: finalizedLongTasks,
    missedTargetSlots: measured.missedTargetSlots,
    missedTargetSlotRate: measured.drawDurations.length + measured.missedTargetSlots === 0
      ? 0
      : measured.missedTargetSlots / (measured.drawDurations.length + measured.missedTargetSlots),
    runIndex: config.runIndex,
    runtimeBuildToken: __SPECTROGRAM_BENCHMARK_BUILD__,
    semanticPixels,
    submittedFrames: measured.drawDurations.length,
    targetDurationMs: config.durationMs,
    updateRateHz: config.updateRateHz,
    variant: config.variant,
    visualChecksum: visual.checksum,
    visiblePixelCount: visual.visiblePixelCount,
    warmupMs: config.warmupMs,
    warmupSubmissions: warmup.expectedSubmissions,
  };
};

function createFixedFrames(config: BrowserBenchmarkConfig) {
  const count = Math.max(256, Math.ceil(
    ((config.warmupMs + config.durationMs) / 1000) * config.updateRateHz,
  ) + 16);
  let state = config.seed >>> 0;
  const frames: SpectrumFrame[] = [];
  for (let sequence = 1; sequence <= count; sequence += 1) {
    const bins = new Uint8Array(config.frameBinCount);
    for (let bin = 0; bin < bins.length; bin += 1) {
      state = ((state * 1664525) + 1013904223) >>> 0;
      const harmonic = Math.max(0, 180 - Math.abs((bin % 47) - (sequence % 47)) * 12);
      bins[bin] = Math.min(255, harmonic + (state >>> 28));
    }
    frames.push({ bins, sampleRate: 48_000, sequence });
  }
  return frames;
}

function createSemanticProbeFrames(binCount: number) {
  const frames: SpectrumFrame[] = [];
  for (let sequence = 1; sequence <= 150; sequence += 1) {
    const bins = new Uint8Array(binCount);
    for (let bin = 1; bin <= Math.min(12, binCount - 1); bin += 1) bins[bin] = 255;
    for (let bin = 60; bin <= Math.min(68, binCount - 1); bin += 1) {
      bins[bin] = sequence === 150 ? 255 : 100;
    }
    for (let bin = 116; bin <= Math.min(127, binCount - 1); bin += 1) bins[bin] = 100;
    frames.push({ bins, sampleRate: 48_000, sequence });
  }
  return frames;
}

function createOptimizedDrawable(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): Drawable {
  const renderer = CanvasSpectrogramRenderer.create(
    () => document.createElement('canvas'),
    new SpectrogramMetrics(false),
    () => '#11151b',
  );
  if (!renderer) throw new Error('optimized renderer initialization failed');
  const target = { canvas, ctx: context, h: height, w: width };
  return {
    draw: (frame) => renderer.draw(target, frame, true),
    reset: () => {
      renderer.draw(target, null, false);
      renderer.dispose();
    },
  };
}

async function runPhase(
  drawable: Drawable,
  frames: SpectrumFrame[],
  updateRateHz: number,
  durationMs: number,
  measure: boolean,
) {
  const cadenceMs = 1000 / updateRateHz;
  const drawDurations: number[] = [];
  const intervals: number[] = [];
  let frameIndex = 0;
  let lastDrawAt: number | null = null;
  let missedTargetSlots = 0;
  const startedAt = performance.now();
  let nextDrawAt = startedAt;
  const expectedSubmissions = Math.max(1, Math.round(durationMs / cadenceMs));

  await new Promise<void>((resolve) => {
    function tick(now: number) {
      if (frameIndex >= expectedSubmissions) {
        resolve();
        return;
      }
      if (now >= nextDrawAt) {
        const overdue = Math.floor((now - nextDrawAt) / cadenceMs);
        if (measure) missedTargetSlots += overdue;
        nextDrawAt += (overdue + 1) * cadenceMs;
        const dispatchStartedAt = performance.now();
        drawable.draw(frames[frameIndex % frames.length]);
        frameIndex += 1;
        const dispatchEndedAt = performance.now();
        if (measure) {
          drawDurations.push(dispatchEndedAt - dispatchStartedAt);
          if (lastDrawAt != null) intervals.push(dispatchStartedAt - lastDrawAt);
          lastDrawAt = dispatchStartedAt;
        }
        if (frameIndex >= expectedSubmissions) {
          resolve();
          return;
        }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
  const elapsedMs = performance.now() - startedAt;
  return {
    drawDurations,
    elapsedMs,
    expectedSubmissions,
    firstSequence: frames[0].sequence,
    intervals,
    lastSequence: frames[(expectedSubmissions - 1) % frames.length].sequence,
    missedTargetSlots,
  };
}

function observeLongTasks() {
  if (
    typeof PerformanceObserver === 'undefined'
    || !PerformanceObserver.supportedEntryTypes.includes('longtask')
  ) return null;
  const entries: PerformanceEntry[] = [];
  const startedAt = performance.now();
  const observer = new PerformanceObserver((list) => {
    entries.push(...list.getEntries());
  });
  observer.observe({ type: 'longtask' });
  return { entries, observer, startedAt };
}

function collectLongTasks(observation: ReturnType<typeof observeLongTasks>, measuredUntil: number) {
  if (!observation) return null;
  observation.entries.push(...observation.observer.takeRecords());
  const result = { count: 0, maxMs: 0, totalMs: 0 };
  for (const entry of observation.entries) {
    if (entry.startTime < observation.startedAt || entry.startTime >= measuredUntil) continue;
    result.count += 1;
    result.totalMs += entry.duration;
    result.maxMs = Math.max(result.maxMs, entry.duration);
  }
  return result;
}

function distribution(values: number[]): Distribution {
  if (!values.length) return { max: 0, mean: 0, p50: 0, p95: 0, p99: 0 };
  const sorted = [...values].sort((left, right) => left - right);
  const percentile = (fraction: number) => sorted[Math.min(
    sorted.length - 1,
    Math.ceil(sorted.length * fraction) - 1,
  )];
  return {
    max: sorted[sorted.length - 1],
    mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
    p50: percentile(0.5),
    p95: percentile(0.95),
    p99: percentile(0.99),
  };
}

function sampleVisualOutput(
  context: CanvasRenderingContext2D,
  physicalWidth: number,
  physicalHeight: number,
) {
  const pixels = context.getImageData(0, 0, physicalWidth, physicalHeight).data;
  let checksum = 2166136261;
  let visiblePixelCount = 0;
  let topNonBackground = 0;
  let bottomNonBackground = 0;
  for (let offset = 0; offset < pixels.length; offset += 4) {
    checksum ^= pixels[offset];
    checksum = Math.imul(checksum, 16777619);
    checksum ^= pixels[offset + 1];
    checksum = Math.imul(checksum, 16777619);
    checksum ^= pixels[offset + 2];
    checksum = Math.imul(checksum, 16777619);
    if (pixels[offset] !== 17 || pixels[offset + 1] !== 21 || pixels[offset + 2] !== 27) {
      visiblePixelCount += 1;
      const pixel = offset / 4;
      const y = Math.floor(pixel / physicalWidth);
      if (y < physicalHeight * 0.1) topNonBackground += 1;
      if (y >= physicalHeight * 0.9) bottomNonBackground += 1;
    }
  }
  return {
    checksum: checksum >>> 0,
    semanticPixels: { bottomNonBackground, topNonBackground },
    visiblePixelCount,
  };
}

function semanticProbe(
  context: CanvasRenderingContext2D,
  physicalWidth: number,
  physicalHeight: number,
) {
  const pixels = context.getImageData(0, 0, physicalWidth, physicalHeight).data;
  const count = (predicate: (x: number, y: number, r: number, g: number) => boolean) => {
    let matches = 0;
    for (let y = 0; y < physicalHeight; y += 1) {
      for (let x = 0; x < physicalWidth; x += 1) {
        const offset = ((y * physicalWidth) + x) * 4;
        if (predicate(x, y, pixels[offset], pixels[offset + 1])) matches += 1;
      }
    }
    return matches;
  };
  const hot = (r: number, g: number) => r > 200 && g < 80;
  const green = (r: number, g: number) => r < 80 && g > 180;
  return {
    bottomHot: count((_x, y, r, g) => y >= physicalHeight * 0.9 && hot(r, g)),
    middleGreen: count((x, y, r, g) => (
      x < physicalWidth * 0.9
      && y >= physicalHeight * 0.45
      && y < physicalHeight * 0.55
      && green(r, g)
    )),
    rightHot: count((x, y, r, g) => (
      x >= physicalWidth * 0.98
      && y >= physicalHeight * 0.45
      && y < physicalHeight * 0.55
      && hot(r, g)
    )),
    topGreen: count((_x, y, r, g) => y < physicalHeight * 0.1 && green(r, g)),
  };
}
