import { describe, expect, it } from 'vitest';
import type { CanvasFrame } from '../src/composables/useHiDpiCanvas';
import { CanvasSpectrogramRenderer } from '../src/rendering/canvasSpectrogramRenderer';
import { SpectrogramMetrics } from '../src/rendering/spectrogramMetrics';
import type { SpectrumFrame } from '../src/types/frames';

interface FakeBitmapContext {
  columns: Array<{ data: Uint8ClampedArray; x: number }>;
  context: CanvasRenderingContext2D;
}

function bitmapBackend(contextAvailable = true) {
  const columns: FakeBitmapContext['columns'] = [];
  const context = {
    createImageData: (width: number, height: number) => ({
      colorSpace: 'srgb',
      data: new Uint8ClampedArray(width * height * 4),
      height,
      width,
    } as ImageData),
    putImageData: (image: ImageData, x: number) => {
      columns.push({ data: new Uint8ClampedArray(image.data), x });
    },
  } as unknown as CanvasRenderingContext2D;
  const canvas = {
    getContext: () => contextAvailable ? context : null,
    height: 0,
    width: 0,
  } as unknown as HTMLCanvasElement;
  return { canvas, columns, context };
}

function targetFrame() {
  const drawCalls: unknown[][] = [];
  const fillCalls: unknown[][] = [];
  const context = {
    drawImage: (...args: unknown[]) => { drawCalls.push(args); },
    fillRect: (...args: unknown[]) => { fillCalls.push(args); },
    fillStyle: '',
    imageSmoothingEnabled: true,
  } as unknown as CanvasRenderingContext2D;
  return {
    drawCalls,
    fillCalls,
    frame: { canvas: {} as HTMLCanvasElement, ctx: context, h: 120, w: 400 } satisfies CanvasFrame,
  };
}

function spectrum(sequence: number, bins = Uint8Array.from([10, 200])): SpectrumFrame {
  return { bins, sampleRate: 48_000, sequence };
}

function rendererFixture(metricsEnabled = false) {
  const bitmap = bitmapBackend();
  const metrics = new SpectrogramMetrics(metricsEnabled);
  const renderer = CanvasSpectrogramRenderer.create(
    () => bitmap.canvas,
    metrics,
    () => '#11151b',
  );
  if (!renderer) throw new Error('expected renderer');
  return { bitmap, metrics, renderer };
}

describe('CanvasSpectrogramRenderer', () => {
  it('fails gracefully when a detached 2D context is unavailable', () => {
    const bitmap = bitmapBackend(false);
    expect(CanvasSpectrogramRenderer.create(() => bitmap.canvas)).toBeNull();
    expect(CanvasSpectrogramRenderer.create(() => null)).toBeNull();
  });

  it('fills only the partial baseline, then covers the target with one draw', () => {
    const { renderer } = rendererFixture();
    const target = targetFrame();
    renderer.draw(target.frame, spectrum(1), true);
    expect(target.fillCalls).toHaveLength(1);
    renderer.draw(target.frame, spectrum(2), true);
    expect(target.fillCalls).toHaveLength(1);
    expect(target.drawCalls).toHaveLength(1);
    expect(target.drawCalls[0].slice(1)).toEqual([0, 0, 2, 128, 0, 0, 400, 120]);
  });

  it('draws a wrapped full ring as two direct numeric spans', () => {
    const { renderer } = rendererFixture();
    const target = targetFrame();
    for (let sequence = 1; sequence <= 151; sequence += 1) {
      renderer.draw(target.frame, spectrum(sequence), true);
    }
    const calls = target.drawCalls.slice(-2);
    expect(calls).toHaveLength(2);
    expect(calls[0].slice(1, 5)).toEqual([1, 0, 149, 128]);
    expect(calls[1].slice(1, 5)).toEqual([0, 0, 1, 128]);
  });

  it('resets explicitly and accepts the same sequence in a new run', () => {
    const { bitmap, metrics, renderer } = rendererFixture(true);
    const target = targetFrame();
    renderer.draw(target.frame, spectrum(7), true);
    renderer.draw(target.frame, null, false);
    renderer.draw(target.frame, spectrum(7), true);
    expect(bitmap.columns).toHaveLength(2);
    expect(metrics.snapshot.clearRuns).toBe(1);
    expect(metrics.snapshot.historyResets).toBe(1);
  });

  it('scales short input over full height with high bins at the top', () => {
    const { bitmap, renderer } = rendererFixture();
    const target = targetFrame();
    renderer.draw(target.frame, spectrum(1, Uint8Array.from([10, 200])), true);
    const pixels = bitmap.columns[0].data;
    const top = [...pixels.slice(0, 4)];
    const bottom = [...pixels.slice((127 * 4), (128 * 4))];
    expect(top).toEqual([255, 183, 0, 255]);
    expect(bottom).toEqual([0, 8, 0, 255]);
    expect(bitmap.columns[0].x).toBe(0);
  });
});
