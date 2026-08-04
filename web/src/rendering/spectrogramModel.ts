export const SPECTROGRAM_FREQUENCY_BINS = 128;
export const SPECTROGRAM_HISTORY_STEPS = 150;

export const SPECTROGRAM_DUPLICATE_SEQUENCE = -1;

/**
 * Fixed-size, allocation-free history used by every spectrogram renderer.
 * Only the bins that can actually be displayed are retained.
 */
export class SpectrogramHistory {
  readonly bins: number;
  readonly capacity: number;
  readonly values: Uint8Array;

  private countValue = 0;
  private lastSequence: number | null = null;
  private writeIndexValue = 0;

  constructor(
    bins = SPECTROGRAM_FREQUENCY_BINS,
    capacity = SPECTROGRAM_HISTORY_STEPS,
  ) {
    if (!Number.isInteger(bins) || bins <= 0) throw new RangeError('bins must be positive');
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError('capacity must be positive');
    }
    this.bins = bins;
    this.capacity = capacity;
    this.values = new Uint8Array(bins * capacity);
  }

  get count() {
    return this.countValue;
  }

  get writeIndex() {
    return this.writeIndexValue;
  }

  /** Returns the updated column, or -1 when the sequence is a duplicate. */
  push(sequence: number, source: Uint8Array): number {
    if (sequence === this.lastSequence) return SPECTROGRAM_DUPLICATE_SEQUENCE;

    const column = this.writeIndexValue;
    const offset = column * this.bins;
    const copied = Math.min(this.bins, source.length);
    for (let index = 0; index < copied; index += 1) {
      this.values[offset + index] = source[index];
    }
    if (copied < this.bins) this.values.fill(0, offset + copied, offset + this.bins);

    this.lastSequence = sequence;
    this.writeIndexValue = (column + 1) % this.capacity;
    this.countValue = Math.min(this.capacity, this.countValue + 1);
    return column;
  }

  reset() {
    this.countValue = 0;
    this.lastSequence = null;
    this.writeIndexValue = 0;
  }

  get oldestIndex() {
    return this.countValue === this.capacity ? this.writeIndexValue : 0;
  }
}

/** Matches the original Canvas implementation's intensity thresholds. */
export function spectrogramRgb(intensity: number): readonly [number, number, number] {
  const value = Math.max(0, Math.min(255, Math.round(intensity))) / 255;
  if (value > 0.7) {
    return [255, Math.max(0, Math.round(255 * (1 - ((value - 0.7) / 0.3)))), 0];
  }
  if (value > 0.3) return [0, 255, 0];
  return [0, Math.round(value * 255 * 0.8), 0];
}

export function createSpectrogramColorLut() {
  const lut = new Uint8ClampedArray(256 * 4);
  for (let intensity = 0; intensity < 256; intensity += 1) {
    const [r, g, b] = spectrogramRgb(intensity);
    const offset = intensity * 4;
    lut[offset] = r;
    lut[offset + 1] = g;
    lut[offset + 2] = b;
    lut[offset + 3] = 255;
  }
  return lut;
}
