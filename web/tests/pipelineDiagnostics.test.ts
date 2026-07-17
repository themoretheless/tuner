import { describe, expect, it } from 'vitest';

import {
  compareDiagnosticSamples,
  createPipelineDiagnosticSample,
  octaveHypotheses,
  simulatePipelineBypass,
} from '../src/domain/pipelineDiagnostics';
import { createUnresolvedDetectionFrame } from '../src/domain/detectionFrame';
import { pipelinePresetConfig } from '../src/domain/pipelineConfig';

function sample(id: number, frequency = 82.4) {
  return createPipelineDiagnosticSample({
    backend: 'wasm',
    config: pipelinePresetConfig('stable'),
    frame: createUnresolvedDetectionFrame({
      confidence: 0.9,
      freq: frequency,
      rawFreq: frequency + 0.1,
      pipeline: {
        adaptiveGateOpen: true,
        arbitration: 'fused',
        decision: 'published',
        fixedGateOpen: true,
        selected: { confidence: 0.9, frequency },
        spectral: {
          activeOctave: 0,
          baseFrequency: frequency,
          harmonics: [1, 0.7, 0.4, 0.2, 0.1],
          octaveScores: [0.3, 1, 0.2],
          pendingOctave: 0,
        },
        yin: { confidence: 0.92, frequency: frequency - 0.1 },
        secondary: { confidence: 0.88, frequency: frequency + 0.2 },
      },
    }),
    id,
    now: id * 33,
    preset: 'stable',
    previousAt: (id - 1) * 33,
    targetFrequency: 82.4069,
  });
}

describe('pipeline diagnostics', () => {
  it('creates bounded derived samples and octave hypotheses', () => {
    const current = sample(4);

    expect(current.cadenceMs).toBe(33);
    expect(current.uncertaintyCents).toBeGreaterThan(2);
    expect(octaveHypotheses(current)).toEqual([
      expect.objectContaining({ shift: -1, state: 'candidate' }),
      expect.objectContaining({ shift: 0, state: 'active' }),
      expect.objectContaining({ shift: 1, state: 'candidate' }),
    ]);
  });

  it('compares a captured baseline without sharing mutable frame state', () => {
    const baseline = sample(1, 82.4);
    const current = sample(2, 83.4);
    current.config.trackingEnabled = false;

    expect(compareDiagnosticSamples(current, baseline)).toMatchObject({
      configChanges: ['trackingEnabled'],
      decisionChanged: false,
      frequencyDelta: 1,
    });
  });

  it('models only bypasses supported by the captured summary', () => {
    const current = sample(1);

    expect(simulatePipelineBypass(current, 'trackingEnabled')).toMatchObject({
      decision: 'published',
      frequency: 82.4,
      kind: 'changed',
    });
    expect(simulatePipelineBypass(current, 'harmonicEnabled')).toMatchObject({
      kind: 'same',
      reason: 'harmonic-unused',
    });
    expect(simulatePipelineBypass(current, 'secondaryDetectorEnabled')).toEqual({
      decision: null,
      frequency: null,
      kind: 'unavailable',
      reason: 'downstream-replay-required',
    });
  });

  it('does not present stateful downstream guesses as exact counterfactuals', () => {
    const current = sample(1);
    current.frame.pipeline.adaptiveGateOpen = false;

    expect(simulatePipelineBypass(current, 'adaptiveGateEnabled')).toMatchObject({
      decision: null,
      kind: 'unavailable',
      reason: 'downstream-replay-required',
    });
    expect(simulatePipelineBypass(current, 'trackingEnabled')).toMatchObject({
      kind: 'same',
      reason: 'blocked-by-adaptive-gate',
    });
  });
});
