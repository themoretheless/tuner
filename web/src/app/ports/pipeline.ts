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
  readonly config: PipelineConfig;
  readonly detectionFrame: DetectionFrame;
  readonly detectorBackend: DetectorBackend;
  readonly error: string | null;
  formatFreq(frequency: number): string;
  getNoteDisplay(note: Pick<Note, 'name' | 'octave'>): string;
  readonly hasDetection: boolean;
  readonly inputDiagnostics: AudioInputDiagnostics | null;
  readonly isListening: boolean;
  readonly presentationFrame: DetectionFrame;
  readonly presentationHasDetection: boolean;
  readonly preset: ResolvedPipelinePresetId;
  readonly sessionStatus: SessionStatus;
  setBlock(block: PipelineBlockId, enabled: boolean): void;
  start(): Promise<void>;
  stop(): Promise<void>;
  toggle(): Promise<void>;
  readonly targetNote: Note;
}
