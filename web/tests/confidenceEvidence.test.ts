import { describe, expect, it } from 'vitest';
import {
  ConfidenceEvidenceEstimator,
  detectCompetingTarget,
  strongestCandidateFrequency,
} from '../src/domain/confidenceEvidence';

function observation(frequency: number) {
  return {
    decision: 'published' as const,
    noiseFloor: 0.003,
    outputConfidence: 0.92,
    rawFrequency: frequency,
    rms: 0.05,
    secondary: { confidence: 0.9, frequency: frequency + 0.02 },
    yin: { confidence: 0.94, frequency: frequency - 0.02 },
  };
}

describe('ConfidenceEvidenceEstimator', () => {
  it('raises stability for coherent overlapping windows', () => {
    const estimator = new ConfidenceEvidenceEstimator();
    const first = estimator.observe(observation(82.4));
    estimator.observe(observation(82.41));
    const settled = estimator.observe(observation(82.4));

    expect(first.calibrated).toBeGreaterThan(0.8);
    expect(settled.stability).toBeGreaterThan(first.stability);
    expect(settled.uncertaintyCents).toBeLessThan(first.uncertaintyCents);
  });

  it('reports sustained jitter and detector disagreement', () => {
    const estimator = new ConfidenceEvidenceEstimator();
    for (const frequency of [82.4, 82.5, 90, 74]) estimator.observe(observation(frequency));
    const conflicted = observation(96);
    conflicted.secondary = { confidence: 0.91, frequency: 110 };
    const evidence = estimator.observe(conflicted);

    expect(evidence.agreement).toBeLessThan(0.1);
    expect(evidence.stability).toBeLessThan(0.5);
    expect(evidence.uncertaintyCents).toBeGreaterThan(40);
  });

  it('resets overlapping-window evidence across a real signal gap', () => {
    const estimator = new ConfidenceEvidenceEstimator();
    estimator.observe(observation(82.4));
    estimator.observe(observation(110));
    estimator.observe({
      ...observation(110),
      decision: 'no-candidate',
      rawFrequency: null,
    });

    expect(estimator.observe(observation(146.8)).stability).toBeCloseTo(0.72);
  });

  it('marks a candidate that belongs to another selected-instrument string', () => {
    expect(detectCompetingTarget(110, 82.4069, [82.4069, 110, 146.832])).toMatchObject({
      candidateFrequency: 110,
      competingTargetFrequency: 110,
      selectedTargetFrequency: 82.4069,
    });
    expect(detectCompetingTarget(220, 82.4069, [82.4069, 110])).toMatchObject({
      competingTargetFrequency: 110,
    });
    expect(detectCompetingTarget(82.5, 82.4069, [82.4069, 110])).toBeNull();
    expect(detectCompetingTarget(164.8, 82.4069, [82.4069, 110])).toBeNull();
  });

  it('uses the strongest independent detector for interference diagnostics', () => {
    expect(strongestCandidateFrequency(
      { confidence: 0.7, frequency: 82.4 },
      { confidence: 0.92, frequency: 110 },
    )).toBe(110);
  });
});
