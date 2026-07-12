import { describe, expect, it } from 'vitest';
import type { SpectrumFrame } from '../src/types/frames';
import { spectralPeakFrequency } from '../src/utils/spectralPeak';

const SAMPLE_RATE = 48000;
const BIN_COUNT = 2048;
const NYQUIST = SAMPLE_RATE / 2;
const BIN_WIDTH = NYQUIST / BIN_COUNT;

function frameWithPeak(frequency: number, spread = 0): SpectrumFrame {
  const bins = new Uint8Array(BIN_COUNT);
  const center = frequency / BIN_WIDTH;
  const centerBin = Math.round(center);
  bins[centerBin] = 200;
  if (spread > 0) {
    // Asymmetric shoulders emulate a peak sitting off the bin center.
    const fraction = center - centerBin;
    bins[centerBin - 1] = Math.round(80 * (1 - fraction));
    bins[centerBin + 1] = Math.round(80 * (1 + fraction));
  }
  return { bins, sampleRate: SAMPLE_RATE, sequence: 1 };
}

describe('spectralPeakFrequency', () => {
  it('returns null without a frame or without energy', () => {
    expect(spectralPeakFrequency(null)).toBeNull();
    expect(
      spectralPeakFrequency({ bins: new Uint8Array(BIN_COUNT), sampleRate: SAMPLE_RATE, sequence: 1 }),
    ).toBeNull();
  });

  it('finds the tallest bin within the guitar range', () => {
    const frequency = 110;
    const peak = spectralPeakFrequency(frameWithPeak(frequency));
    expect(peak).not.toBeNull();
    expect(Math.abs(peak! - frequency)).toBeLessThan(BIN_WIDTH);
  });

  it('refines the estimate between bins with neighboring energy', () => {
    // A peak halfway between bins: interpolation should land closer to the
    // true frequency than the raw bin center does.
    const frequency = (Math.round(220 / BIN_WIDTH) + 0.4) * BIN_WIDTH;
    const peak = spectralPeakFrequency(frameWithPeak(frequency, 1));
    expect(peak).not.toBeNull();
    expect(Math.abs(peak! - frequency)).toBeLessThan(BIN_WIDTH / 2);
  });

  it('ignores energy outside the configured range', () => {
    const bins = new Uint8Array(BIN_COUNT);
    bins[1] = 255; // ~11.7 Hz, below the 50 Hz floor
    const inRangeBin = Math.round(110 / BIN_WIDTH);
    bins[inRangeBin] = 120;
    const peak = spectralPeakFrequency({ bins, sampleRate: SAMPLE_RATE, sequence: 1 });
    expect(peak).not.toBeNull();
    expect(Math.abs(peak! - inRangeBin * BIN_WIDTH)).toBeLessThan(BIN_WIDTH);
  });
});
