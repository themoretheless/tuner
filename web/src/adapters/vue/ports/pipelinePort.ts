import { computed, reactive } from 'vue';
import type { PipelinePort } from '../../../app/ports/pipeline';
import type { DetectionCapability } from '../capabilities/detection';
import type { PipelineCapability } from '../capabilities/pipeline';
import type { ListeningCapability, SessionCapability } from '../capabilities/session';
import type { TuningCapability } from '../capabilities/tuning';

interface Dependencies {
  detection: Pick<DetectionCapability, 'frame' | 'hasDetection' | 'presentationFrame' | 'targetNote'>;
  listening: ListeningCapability;
  pipeline: PipelineCapability;
  session: Pick<SessionCapability, 'detectorBackend' | 'error' | 'inputDiagnostics' | 'isListening' | 'status'>;
  tuning: Pick<TuningCapability, 'formatFreq' | 'getNoteDisplay'>;
}

export function createPipelinePort(
  { detection, listening, pipeline, session, tuning }: Dependencies,
): PipelinePort {
  return reactive({
    config: pipeline.config,
    detectionFrame: detection.frame,
    detectorBackend: session.detectorBackend,
    error: session.error,
    formatFreq: tuning.formatFreq,
    getNoteDisplay: tuning.getNoteDisplay,
    hasDetection: detection.hasDetection,
    inputDiagnostics: session.inputDiagnostics,
    isListening: session.isListening,
    presentationFrame: detection.presentationFrame,
    presentationHasDetection: computed(() => detection.presentationFrame.value.freq != null),
    preset: pipeline.preset,
    sessionStatus: session.status,
    targetNote: detection.targetNote,
    applyPreset: pipeline.applyPreset,
    clearError: listening.clearError,
    setBlock: pipeline.setBlock,
    start: listening.start,
    stop: listening.stop,
    toggle: listening.toggle,
  });
}
