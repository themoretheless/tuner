import { SPECTRAL_PEAK_MAX_FREQ, SPECTRAL_PEAK_MIN_FREQ } from './spectralPeak';

// Overtones drawn on top of the spectrum. Beyond the fifth the lines crowd
// together on the log axis and stop being readable.
export const HARMONIC_MARKER_MAX = 5;

// Below this a "fundamental" is detector noise rather than a played note, and
// its multiples would smear meaningless lines across the display.
export const HARMONIC_MARKER_MIN_FUNDAMENTAL = 20;

export interface HarmonicMarker {
  /** 1 is the fundamental itself, 2 the octave above it, and so on. */
  harmonic: number;
  frequency: number;
  /** Horizontal placement in 0..1 along the logarithmic frequency axis. */
  position: number;
}

/**
 * Where the fundamental and its overtones fall on a logarithmic spectrum axis
 * spanning [minFreq, maxFreq].
 *
 * Partials outside the axis are dropped rather than clamped: a fundamental
 * below the display floor (drop tunings reach ~41 Hz against a 50 Hz floor)
 * still has overtones inside the window, and pinning out-of-range partials to
 * an edge would draw lines where no harmonic exists.
 */
export function harmonicMarkers(
  fundamental: number | null | undefined,
  minFreq = SPECTRAL_PEAK_MIN_FREQ,
  maxFreq = SPECTRAL_PEAK_MAX_FREQ,
  maxHarmonic = HARMONIC_MARKER_MAX,
): HarmonicMarker[] {
  if (fundamental == null || !Number.isFinite(fundamental)) return [];
  if (fundamental < HARMONIC_MARKER_MIN_FUNDAMENTAL) return [];
  if (!(minFreq > 0) || !(maxFreq > minFreq)) return [];

  const span = Math.log(maxFreq / minFreq);
  const markers: HarmonicMarker[] = [];
  for (let harmonic = 1; harmonic <= maxHarmonic; harmonic += 1) {
    const frequency = fundamental * harmonic;
    if (frequency > maxFreq) break;
    if (frequency < minFreq) continue;
    markers.push({
      harmonic,
      frequency,
      position: Math.log(frequency / minFreq) / span,
    });
  }
  return markers;
}
