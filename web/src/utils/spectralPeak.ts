import type { SpectrumFrame } from '../types/frames';

// Frequency window the peak search covers: guitar fundamentals plus early
// harmonics, matching the range the Spectrum visualizer displays.
export const SPECTRAL_PEAK_MIN_FREQ = 50;
export const SPECTRAL_PEAK_MAX_FREQ = 6000;

/**
 * Frequency (Hz) of the tallest FFT bin in `frame`, refined with parabolic
 * interpolation over the neighboring bins so the estimate is not quantized
 * to the raw bin width (~11.7 Hz at fftSize 4096 / 48 kHz).
 *
 * This is a purely spectral reading: no periodicity analysis, no smoothing
 * beyond what the AnalyserNode itself applies. On low strings the tallest
 * peak is often a harmonic rather than the fundamental, so this is a raw
 * "what the spectrum shows" value, not a pitch estimate.
 */
export function spectralPeakFrequency(
  frame: SpectrumFrame | null,
  minFreq = SPECTRAL_PEAK_MIN_FREQ,
  maxFreq = SPECTRAL_PEAK_MAX_FREQ,
): number | null {
  if (!frame) return null;
  const data = frame.bins;
  const binCount = data.length;
  const sampleRate = frame.sampleRate || 48000;
  const nyquist = sampleRate / 2;
  if (!binCount || nyquist <= 0) return null;

  const minBin = Math.max(0, Math.floor((minFreq / nyquist) * binCount));
  const maxBin = Math.min(binCount - 1, Math.ceil((maxFreq / nyquist) * binCount));
  let peakBin = -1;
  let peakValue = 0;
  for (let bin = minBin; bin <= maxBin; bin += 1) {
    if (data[bin] > peakValue) {
      peakValue = data[bin];
      peakBin = bin;
    }
  }
  if (peakBin < 0 || peakValue <= 0) return null;

  // Parabolic interpolation over the peak and its neighbors. Byte-quantized
  // magnitudes limit how much this helps, but it still beats snapping to
  // the bin center.
  let offset = 0;
  if (peakBin > 0 && peakBin < binCount - 1) {
    const left = data[peakBin - 1];
    const center = data[peakBin];
    const right = data[peakBin + 1];
    const denominator = 2 * center - left - right;
    if (denominator > 0) {
      offset = Math.max(-0.5, Math.min(0.5, (right - left) / (2 * denominator)));
    }
  }

  return ((peakBin + offset) / binCount) * nyquist;
}
