import { createPipelineTelemetry } from '../domain/pipelineTelemetry';
import type { DetectionFrame } from '../types/frames';

export const DEBUG_CAPTURE_SCHEMA_VERSION = 1;
export const DEBUG_CAPTURE_CONFIG_REVISION = 'web-debug-media-recorder-v1';

export function debugCaptureAudioExtension(mimeType: string): string {
  switch (mimeType.toLowerCase().split(';', 1)[0]) {
    case 'audio/mp4':
    case 'audio/aac':
      return '.m4a';
    case 'audio/ogg':
      return '.ogg';
    case 'audio/wav':
    case 'audio/wave':
      return '.wav';
    default:
      return '.webm';
  }
}

export interface DebugFrameSnapshot {
  sequence: number;
  elapsedMs: number;
  frame: DetectionFrame;
}

interface DebugCaptureEnvelopeInput {
  audioFile: string;
  backend: string;
  capturedAt: string;
  completedAt: string;
  frames: DebugFrameSnapshot[];
  isTunerListening: boolean;
  mimeType: string;
  selectedInputDeviceId?: string;
  trackSettings: MediaTrackSettings;
}

export function createDebugFrameSnapshot(
  sequence: number,
  elapsedMs: number,
  frame: DetectionFrame,
): DebugFrameSnapshot {
  return {
    sequence,
    elapsedMs: Math.max(0, elapsedMs),
    frame: {
      ...frame,
      pipeline: createPipelineTelemetry(frame.pipeline),
      target: frame.target ? { ...frame.target } : null,
    },
  };
}

export function createDebugCaptureEnvelope(input: DebugCaptureEnvelopeInput) {
  return {
    schemaVersion: DEBUG_CAPTURE_SCHEMA_VERSION,
    configRevision: DEBUG_CAPTURE_CONFIG_REVISION,
    capturedAt: input.capturedAt,
    completedAt: input.completedAt,
    captureMode: 'parallel-media-recorder',
    replayLimit: 'Compressed WebM and frame clock are not sample-index aligned.',
    audio: {
      file: input.audioFile,
      mimeType: input.mimeType,
      trackSettings: { ...input.trackSettings },
    },
    session: {
      backend: input.backend,
      isTunerListening: input.isTunerListening,
      selectedInputDeviceId: input.selectedInputDeviceId ?? '',
    },
    frameTimebase: 'performance-now-ms-from-record-start',
    frames: input.frames.map((frame) => ({
      ...frame,
      frame: createDebugFrameSnapshot(frame.sequence, frame.elapsedMs, frame.frame).frame,
    })),
  };
}
