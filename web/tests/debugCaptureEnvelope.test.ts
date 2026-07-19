import { describe, expect, it } from 'vitest';
import { createUnresolvedDetectionFrame } from '../src/domain/detectionFrame';
import {
  createDebugCaptureEnvelope,
  createDebugFrameSnapshot,
} from '../src/utils/debugCaptureEnvelope';

describe('debug capture envelope', () => {
  it('freezes frame evidence on the shared PCM sample clock', () => {
    const frame = createUnresolvedDetectionFrame({
      confidence: 0.9,
      freq: 82.4,
      rawFreq: 82.5,
      pipeline: { decision: 'published' },
    });
    const snapshot = createDebugFrameSnapshot(3, frame, {
      endSample: 10_000,
      source: 'worklet',
      startSample: 1_808,
    });
    frame.pipeline.decision = 'held';

    const envelope = createDebugCaptureEnvelope({
      audioFile: 'capture.wav',
      audioSha256: 'abc123',
      backend: 'wasm',
      capture: {
        droppedSamples: 0,
        endSample: 12_000,
        sampleRate: 48_000,
        samples: new Float32Array(12_000),
        startSample: 0,
      },
      capturedAt: '2026-07-18T10:00:00.000Z',
      completedAt: '2026-07-18T10:00:05.000Z',
      frames: [snapshot],
      isTunerListening: true,
    });

    expect(envelope.schemaVersion).toBe(2);
    expect(envelope.captureMode).toBe('shared-pcm-sample-timebase');
    expect(envelope.replayLimit).toBeNull();
    expect(envelope.audio.sampleRate).toBe(48_000);
    expect(envelope.audio.sha256).toBe('abc123');
    expect(envelope.frames[0].elapsedMs).toBeCloseTo(208.333, 2);
    expect(envelope.frames[0].frame.pipeline.decision).toBe('published');
  });

  it('excludes frame windows outside the captured PCM interval', () => {
    const frame = createUnresolvedDetectionFrame();
    const envelope = createDebugCaptureEnvelope({
      audioFile: 'capture.wav',
      audioSha256: null,
      backend: 'typescript',
      capture: {
        droppedSamples: 2,
        endSample: 1_000,
        sampleRate: 1_000,
        samples: new Float32Array(500),
        startSample: 500,
      },
      capturedAt: '',
      completedAt: '',
      frames: [createDebugFrameSnapshot(0, frame, {
        endSample: 800,
        source: 'worklet',
        startSample: 400,
      })],
      isTunerListening: true,
    });

    expect(envelope.frames).toHaveLength(0);
    expect(envelope.replayLimit).toContain('2 missing source samples');
  });
});
