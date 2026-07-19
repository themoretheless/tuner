import { createPipelineTelemetry } from '../domain/pipelineTelemetry';
import type {
  AudioFrameTimebase,
  ExactPcmCapture,
} from '../ports/audioInput';
import type { DetectionFrame } from '../types/frames';

export const DEBUG_CAPTURE_SCHEMA_VERSION = 2;
export const DEBUG_CAPTURE_CONFIG_REVISION = 'web-shared-pcm-v2';

export interface DebugFrameSnapshot {
  frame: DetectionFrame;
  sequence: number;
  timebase: AudioFrameTimebase | null;
}

interface DebugCaptureEnvelopeInput {
  audioFile: string;
  audioSha256: string | null;
  backend: string;
  capture: ExactPcmCapture;
  capturedAt: string;
  completedAt: string;
  frames: DebugFrameSnapshot[];
  isTunerListening: boolean;
  selectedInputDeviceId?: string;
}

export function createDebugFrameSnapshot(
  sequence: number,
  frame: DetectionFrame,
  timebase: AudioFrameTimebase | null,
): DebugFrameSnapshot {
  return {
    sequence,
    timebase: timebase ? { ...timebase } : null,
    frame: {
      ...frame,
      pipeline: createPipelineTelemetry(frame.pipeline),
      target: frame.target ? { ...frame.target } : null,
    },
  };
}

export function createDebugCaptureEnvelope(input: DebugCaptureEnvelopeInput) {
  const captureDurationMs = input.capture.samples.length / input.capture.sampleRate * 1000;
  const frames = input.frames
    .filter((snapshot) => snapshot.timebase
      && snapshot.timebase.startSample >= input.capture.startSample
      && snapshot.timebase.endSample <= input.capture.endSample)
    .map((snapshot) => ({
      ...createDebugFrameSnapshot(snapshot.sequence, snapshot.frame, snapshot.timebase),
      elapsedMs: snapshot.timebase
        ? (snapshot.timebase.endSample - input.capture.startSample)
          / input.capture.sampleRate * 1000
        : null,
    }));

  return {
    schemaVersion: DEBUG_CAPTURE_SCHEMA_VERSION,
    configRevision: DEBUG_CAPTURE_CONFIG_REVISION,
    capturedAt: input.capturedAt,
    completedAt: input.completedAt,
    captureMode: 'shared-pcm-sample-timebase',
    replayLimit: input.capture.droppedSamples > 0
      ? `${input.capture.droppedSamples} missing source samples were replaced with silence.`
      : null,
    audio: {
      channels: 1,
      durationMs: captureDurationMs,
      droppedSamples: input.capture.droppedSamples,
      encoding: 'pcm-s16le',
      endSample: input.capture.endSample,
      file: input.audioFile,
      mimeType: 'audio/wav',
      sampleCount: input.capture.samples.length,
      sampleRate: input.capture.sampleRate,
      sha256: input.audioSha256,
      startSample: input.capture.startSample,
    },
    session: {
      backend: input.backend,
      isTunerListening: input.isTunerListening,
      selectedInputDeviceId: input.selectedInputDeviceId ?? '',
    },
    frameTimebase: 'source-sample-index',
    frames,
  };
}

export async function sha256Hex(buffer: ArrayBuffer): Promise<string | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null;
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}
