import type { AudioInputDiagnostics } from '../../domain/audioInputDiagnostics';
import type {
  PipelineBlockId,
  PipelineConfig,
  PipelinePresetId,
  ResolvedPipelinePresetId,
} from '../../domain/pipelineConfig';
import type { SessionStatus } from '../../session/sessionLifecycle';
import type { DetectionFrame } from '../../types/frames';
import type { DetectorBackend } from '../../types/detectorBackend';
import type { Note } from '../../utils/notes';

export interface PipelinePort {
  applyPreset(preset: PipelinePresetId): void;
  clearError(): void;
  config: PipelineConfig;
  detectionFrame: DetectionFrame;
  detectorBackend: DetectorBackend;
  error: string | null;
  formatFreq(frequency: number): string;
  getNoteDisplay(note: Pick<Note, 'name' | 'octave'>): string;
  hasDetection: boolean;
  inputDiagnostics: AudioInputDiagnostics | null;
  isListening: boolean;
  presentationFrame: DetectionFrame;
  presentationHasDetection: boolean;
  preset: ResolvedPipelinePresetId;
  sessionStatus: SessionStatus;
  setBlock(block: PipelineBlockId, enabled: boolean): void;
  start(): Promise<void>;
  stop(): Promise<void>;
  targetNote: Note;
}
