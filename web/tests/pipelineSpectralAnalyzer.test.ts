import { describe, expect, it } from 'vitest';

import { PipelineSpectralAnalyzer } from '../src/utils/pipelineSpectralAnalyzer';

describe('PipelineSpectralAnalyzer', () => {
  it('returns fixed-size normalized evidence for the fallback backend', () => {
    const sampleRate = 48_000;
    const buffer = Float32Array.from({ length: 4_096 }, (_, index) => (
      Math.sin((Math.PI * 2 * 220 * index) / sampleRate)
      + 0.4 * Math.sin((Math.PI * 2 * 440 * index) / sampleRate)
    ));
    const evidence = new PipelineSpectralAnalyzer().analyze(buffer, sampleRate, 220);

    expect(evidence).not.toBeNull();
    expect(evidence?.harmonics).toHaveLength(5);
    expect(evidence?.octaveScores).toHaveLength(3);
    expect(Math.max(...(evidence?.harmonics ?? []))).toBeCloseTo(1);
    expect(evidence?.harmonics.every((value) => value >= 0 && value <= 1)).toBe(true);
    expect(evidence!.octaveScores[1]).toBeGreaterThan(evidence!.octaveScores[0]);
  });

  it('rejects invalid inputs instead of producing misleading bars', () => {
    expect(new PipelineSpectralAnalyzer().analyze(new Float32Array(4), 0, 220)).toBeNull();
  });

  it('does not score octave hypotheses outside the configured range', () => {
    const sampleRate = 48_000;
    const buffer = Float32Array.from({ length: 4_096 }, (_, index) => (
      Math.sin((Math.PI * 2 * 220 * index) / sampleRate)
    ));
    const evidence = new PipelineSpectralAnalyzer().analyze(buffer, sampleRate, 220, {
      minFrequency: 150,
      maxFrequency: 300,
    });

    expect(evidence?.octaveScores[0]).toBe(0);
    expect(evidence?.octaveScores[2]).toBe(0);
    expect(evidence?.octaveScores[1]).toBe(1);
  });
});
