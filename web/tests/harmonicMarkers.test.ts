import { describe, expect, it } from 'vitest';
import {
  HARMONIC_MARKER_MAX,
  harmonicMarkers,
} from '../src/utils/harmonicMarkers';
import { SPECTRAL_PEAK_MAX_FREQ, SPECTRAL_PEAK_MIN_FREQ } from '../src/utils/spectralPeak';

describe('harmonicMarkers', () => {
  it('returns nothing without a usable fundamental', () => {
    expect(harmonicMarkers(null)).toEqual([]);
    expect(harmonicMarkers(undefined)).toEqual([]);
    expect(harmonicMarkers(Number.NaN)).toEqual([]);
    expect(harmonicMarkers(0)).toEqual([]);
    expect(harmonicMarkers(-110)).toEqual([]);
    expect(harmonicMarkers(5)).toEqual([]);
  });

  it('includes the fundamental as the first marker', () => {
    const markers = harmonicMarkers(110);
    expect(markers[0].harmonic).toBe(1);
    expect(markers[0].frequency).toBeCloseTo(110, 6);
  });

  it('places partials at integer multiples up to the cap', () => {
    const markers = harmonicMarkers(200);
    expect(markers.map((marker) => marker.harmonic)).toEqual([1, 2, 3, 4, 5]);
    expect(markers.map((marker) => marker.frequency)).toEqual([200, 400, 600, 800, 1000]);
    expect(markers).toHaveLength(HARMONIC_MARKER_MAX);
  });

  it('drops partials above the axis instead of clamping them to the edge', () => {
    // 1500 Hz: only x1..x4 fit under the 6 kHz ceiling.
    const markers = harmonicMarkers(1500);
    expect(markers.map((marker) => marker.harmonic)).toEqual([1, 2, 3, 4]);
    expect(markers.every((marker) => marker.position <= 1)).toBe(true);
  });

  it('keeps in-range overtones of a fundamental below the axis floor', () => {
    // 41 Hz (drop-E low string) sits under the 50 Hz display floor, but its
    // octave and above are visible.
    const markers = harmonicMarkers(41);
    expect(markers.map((marker) => marker.harmonic)).toEqual([2, 3, 4, 5]);
    expect(markers.every((marker) => marker.position >= 0)).toBe(true);
  });

  it('maps frequencies logarithmically across the axis', () => {
    const [fundamental, octave] = harmonicMarkers(SPECTRAL_PEAK_MIN_FREQ);
    expect(fundamental.position).toBeCloseTo(0, 6);
    // An octave up is a fixed fraction of the total log span, wherever it sits.
    const octaveSpan = Math.log(2) / Math.log(SPECTRAL_PEAK_MAX_FREQ / SPECTRAL_PEAK_MIN_FREQ);
    expect(octave.position).toBeCloseTo(octaveSpan, 6);

    const higher = harmonicMarkers(400);
    expect(higher[1].position - higher[0].position).toBeCloseTo(octaveSpan, 6);
  });

  it('honors a custom axis and harmonic cap', () => {
    const markers = harmonicMarkers(100, 100, 400, 3);
    expect(markers.map((marker) => marker.harmonic)).toEqual([1, 2, 3]);
    expect(markers[0].position).toBeCloseTo(0, 6);
    expect(markers[2].position).toBeCloseTo(Math.log(3) / Math.log(4), 6);
    // An inverted axis has no sane mapping.
    expect(harmonicMarkers(100, 400, 100)).toEqual([]);
  });
});
