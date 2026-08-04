import type { CanvasFrame } from '../composables/useHiDpiCanvas';
import type { SpectrumFrame } from '../types/frames';
import { canvasPalette } from '../utils/canvasPalette';
import {
  createSpectrogramColorLut,
  SPECTROGRAM_DUPLICATE_SEQUENCE,
  SpectrogramHistory,
} from './spectrogramModel';
import { SpectrogramMetrics } from './spectrogramMetrics';

type BackgroundColor = (target: CanvasFrame) => string;
type CanvasFactory = () => HTMLCanvasElement | null;

export class CanvasSpectrogramRenderer {
  private readonly backgroundColor: BackgroundColor;
  private readonly bitmapCanvas: HTMLCanvasElement;
  private readonly bitmapContext: CanvasRenderingContext2D;
  private readonly colorLut = createSpectrogramColorLut();
  private readonly history = new SpectrogramHistory();
  private readonly columnImage: ImageData;
  private readonly metrics: SpectrogramMetrics;
  private visibleBins = 0;

  private constructor(
    bitmapCanvas: HTMLCanvasElement,
    bitmapContext: CanvasRenderingContext2D,
    metrics: SpectrogramMetrics,
    backgroundColor: BackgroundColor,
  ) {
    this.backgroundColor = backgroundColor;
    this.bitmapCanvas = bitmapCanvas;
    this.bitmapContext = bitmapContext;
    this.metrics = metrics;
    this.bitmapCanvas.width = this.history.capacity;
    this.bitmapCanvas.height = this.history.bins;
    this.columnImage = bitmapContext.createImageData(1, this.history.bins);
  }

  static create(
    createCanvas: CanvasFactory = defaultCanvasFactory,
    metrics = new SpectrogramMetrics(),
    backgroundColor: BackgroundColor = (target) => canvasPalette(target).background,
  ): CanvasSpectrogramRenderer | null {
    const canvas = createCanvas();
    if (!canvas) return null;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return null;
    return new CanvasSpectrogramRenderer(canvas, context, metrics, backgroundColor);
  }

  dispose() {
    this.metrics.dispose();
  }

  draw(target: CanvasFrame, source: SpectrumFrame | null, isListening: boolean) {
    const active = isListening && source != null;
    const startedAt = this.metrics.beginDraw(active, source?.sequence ?? null);
    if (!active || !source) {
      this.clear(target);
      this.metrics.endDraw(startedAt);
      return;
    }

    const nextVisibleBins = Math.min(this.history.bins, source.bins.length);
    if (this.history.count > 0 && nextVisibleBins !== this.visibleBins) this.resetHistory();
    this.visibleBins = nextVisibleBins;

    const column = this.history.push(source.sequence, source.bins);
    if (column !== SPECTROGRAM_DUPLICATE_SEQUENCE) {
      this.updateBitmapColumn(column);
      this.metrics.columnUpdated();
    }

    const count = this.history.count;
    if (count < 2 || this.visibleBins === 0) {
      this.fillBackground(target);
    } else {
      this.drawHistory(target, count);
    }
    this.metrics.endDraw(startedAt);
  }

  private clear(target: CanvasFrame) {
    if (this.history.count > 0 || this.visibleBins > 0) this.resetHistory();
    this.fillBackground(target);
    this.metrics.clearRun();
  }

  private resetHistory() {
    this.history.reset();
    this.visibleBins = 0;
    this.metrics.historyReset();
  }

  private fillBackground(target: CanvasFrame) {
    target.ctx.fillStyle = this.backgroundColor(target);
    target.ctx.fillRect(0, 0, target.w, target.h);
  }

  private drawHistory(target: CanvasFrame, count: number) {
    const { ctx, w, h } = target;
    ctx.imageSmoothingEnabled = false;
    const oldest = this.history.oldestIndex;
    if (oldest === 0) {
      ctx.drawImage(this.bitmapCanvas, 0, 0, count, this.history.bins, 0, 0, w, h);
      return;
    }

    const tailLength = this.history.capacity - oldest;
    const tailWidth = (tailLength / count) * w;
    ctx.drawImage(
      this.bitmapCanvas,
      oldest, 0, tailLength, this.history.bins,
      0, 0, tailWidth, h,
    );
    ctx.drawImage(
      this.bitmapCanvas,
      0, 0, oldest, this.history.bins,
      tailWidth, 0, w - tailWidth, h,
    );
  }

  private updateBitmapColumn(column: number) {
    const sourceOffset = column * this.history.bins;
    const pixels = this.columnImage.data;
    // Available bins always scale over the full height; low frequency is at
    // the bottom and the highest available bin is at the top.
    for (let y = 0; y < this.history.bins; y += 1) {
      const frequency = this.visibleBins === 0
        ? 0
        : Math.floor(((this.history.bins - 1 - y) * this.visibleBins) / this.history.bins);
      const intensity = this.visibleBins === 0
        ? 0
        : this.history.values[sourceOffset + frequency];
      const colorOffset = intensity * 4;
      const pixelOffset = y * 4;
      pixels[pixelOffset] = this.colorLut[colorOffset];
      pixels[pixelOffset + 1] = this.colorLut[colorOffset + 1];
      pixels[pixelOffset + 2] = this.colorLut[colorOffset + 2];
      pixels[pixelOffset + 3] = 255;
    }
    this.bitmapContext.putImageData(this.columnImage, column, 0);
  }
}

function defaultCanvasFactory() {
  return typeof document === 'undefined' ? null : document.createElement('canvas');
}
