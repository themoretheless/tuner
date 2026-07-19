import type { Ref } from 'vue';
import type { CentsHistoryPoint } from '../../../domain/centsHistory';
import type { DetectionFrame, SpectrumFrame, WaveformFrame } from '../../../types/frames';
import type { Note } from '../../../utils/notes';

export interface DetectionCapability {
  cents: Readonly<Ref<number>>;
  currentNoteDisplay: Readonly<Ref<string | null>>;
  frame: Readonly<Ref<DetectionFrame>>;
  hasDetection: Readonly<Ref<boolean>>;
  isInTune: Readonly<Ref<boolean>>;
  presentationFrame: Readonly<Ref<DetectionFrame>>;
  smoothedFrequency: Readonly<Ref<number | null>>;
  targetNote: Readonly<Ref<Note>>;
  volume: Readonly<Ref<number>>;
}

export interface HistoryCapability {
  clear(): void;
  history: Readonly<Ref<CentsHistoryPoint[]>>;
}

export interface VisualizationCapability {
  activate(): void;
  deactivate(): void;
  spectrumFrame: Readonly<Ref<SpectrumFrame | null>>;
  waveformFrame: Readonly<Ref<WaveformFrame | null>>;
}
