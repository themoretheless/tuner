import { describe, expect, it } from 'vitest';

import {
  createPipelineTelemetry,
  normalizePipelineTelemetry,
} from '../src/domain/pipelineTelemetry';

describe('pipeline telemetry', () => {
  it('normalizes candidates and keeps known decisions', () => {
    expect(normalizePipelineTelemetry({
      adaptiveGateOpen: true,
      arbitration: 'fused',
      decision: 'published',
      fixedGateOpen: true,
      gateThreshold: 0.0045,
      noiseFloor: 0.0025,
      processingMs: 2.5,
      sampleRate: 48_000,
      secondary: { confidence: 2, frequency: 82.5 },
      selected: { confidence: 0.9, frequency: 82.4 },
      spectral: {
        activeOctave: 0,
        baseFrequency: 82.4,
        harmonics: [2, 0.5, -1, 0.25, 0.1],
        octaveScores: [0.2, 2, -1],
        pendingOctave: -1,
      },
      tracked: true,
      windowSamples: 4_096.8,
      yin: { confidence: -1, frequency: 82.3 },
    })).toEqual(createPipelineTelemetry({
      adaptiveGateOpen: true,
      arbitration: 'fused',
      decision: 'published',
      fixedGateOpen: true,
      gateThreshold: 0.0045,
      noiseFloor: 0.0025,
      processingMs: 2.5,
      sampleRate: 48_000,
      secondary: { confidence: 1, frequency: 82.5 },
      selected: { confidence: 0.9, frequency: 82.4 },
      spectral: {
        activeOctave: 0,
        baseFrequency: 82.4,
        harmonics: [1, 0.5, 0, 0.25, 0.1],
        octaveScores: [0.2, 1, 0],
        pendingOctave: -1,
      },
      tracked: true,
      windowSamples: 4_096,
      yin: { confidence: 0, frequency: 82.3 },
    }));
  });

  it('contains malformed wire values', () => {
    expect(normalizePipelineTelemetry({
      arbitration: 'invented',
      decision: 'invented',
      selected: { confidence: 1, frequency: -1 },
      yin: 'not-a-candidate',
    })).toEqual(createPipelineTelemetry());
  });
});
