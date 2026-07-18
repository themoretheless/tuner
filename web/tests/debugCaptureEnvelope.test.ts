import { describe, expect, it } from 'vitest';
import { createUnresolvedDetectionFrame } from '../src/domain/detectionFrame';
import {
  createDebugCaptureEnvelope,
  createDebugFrameSnapshot,
  debugCaptureAudioExtension,
} from '../src/utils/debugCaptureEnvelope';

describe('debug capture envelope', () => {
  it('freezes frame evidence and records explicit replay limitations', () => {
    const frame = createUnresolvedDetectionFrame({
      confidence: 0.9,
      freq: 82.4,
      rawFreq: 82.5,
      pipeline: { decision: 'published' },
    });
    const snapshot = createDebugFrameSnapshot(3, 42, frame);
    frame.pipeline.decision = 'held';

    const envelope = createDebugCaptureEnvelope({
      audioFile: 'capture.webm',
      backend: 'wasm',
      capturedAt: '2026-07-18T10:00:00.000Z',
      completedAt: '2026-07-18T10:00:05.000Z',
      frames: [snapshot],
      isTunerListening: true,
      mimeType: 'audio/webm',
      trackSettings: { channelCount: 1, sampleRate: 48_000 },
    });

    expect(envelope.schemaVersion).toBe(1);
    expect(envelope.captureMode).toBe('parallel-media-recorder');
    expect(envelope.replayLimit).toContain('not sample-index aligned');
    expect(envelope.audio.trackSettings.sampleRate).toBe(48_000);
    expect(envelope.frames[0].frame.pipeline.decision).toBe('published');
  });

  it('uses an extension matching the recorder MIME type', () => {
    expect(debugCaptureAudioExtension('audio/webm;codecs=opus')).toBe('.webm');
    expect(debugCaptureAudioExtension('audio/mp4')).toBe('.m4a');
    expect(debugCaptureAudioExtension('audio/ogg; codecs=opus')).toBe('.ogg');
  });
});
