import { computed, watch, type Ref } from 'vue';
import { useDetectionFramePresentation } from '../../../composables/useDetectionFramePresentation';
import { createFrameContext } from '../../../domain/frameContext';
import type { PitchDetectionRange } from '../../../utils/pitch';
import type {
  Note,
  NoteName,
  Temperament,
  TemperamentId,
} from '../../../utils/notes';
import type { DetectionFrame, FrameContext } from '../../../types/frames';

export interface DetectionSessionPort {
  detectionFrame: Readonly<Ref<DetectionFrame>>;
  detectionFrameResolved: Readonly<Ref<boolean>>;
  setDetectionRange(range: PitchDetectionRange): void;
  setFrameContext(context: FrameContext): void;
}

export interface DetectionTuningPort {
  a4: Readonly<Ref<number>>;
  cents: Readonly<Ref<number>>;
  currentNoteDisplay: Readonly<Ref<string | null>>;
  detectedNote: Readonly<Ref<unknown | null>>;
  detectionRange: Readonly<Ref<PitchDetectionRange>>;
  isChromaticMode: Readonly<Ref<boolean>>;
  isInTune: Readonly<Ref<boolean>>;
  selectedString: Readonly<Ref<Note | null>>;
  strings: Readonly<Ref<Note[]>>;
  targetNote: Readonly<Ref<Note>>;
  temperament: Readonly<Ref<TemperamentId>>;
  temperamentOptions: Readonly<Ref<Temperament[]>>;
  temperamentRoot: Readonly<Ref<NoteName>>;
  transpose: Readonly<Ref<number>>;
}

export function useDetectionController(
  session: DetectionSessionPort,
  tuning: DetectionTuningPort,
) {
  const frameContext = computed(() => createFrameContext({
    a4: tuning.a4.value,
    isChromaticMode: tuning.isChromaticMode.value,
    selectedString: tuning.selectedString.value,
    strings: tuning.strings.value,
    temperament: tuning.temperament.value,
    temperamentOptions: tuning.temperamentOptions.value,
    temperamentRoot: tuning.temperamentRoot.value,
    transpose: tuning.transpose.value,
  }));
  const frame = computed<DetectionFrame>(() => {
    const source = session.detectionFrame.value;
    if (session.detectionFrameResolved.value) return source;
    return {
      ...source,
      cents: tuning.detectedNote.value ? tuning.cents.value : 0,
      note: tuning.currentNoteDisplay.value ?? source.note,
      target: tuning.targetNote.value,
      inTune: tuning.isInTune.value,
    };
  });
  const presentationFrame = useDetectionFramePresentation(frame);
  const targetNote = computed(() => frame.value.target ?? tuning.targetNote.value);
  const cents = computed(() => frame.value.cents);
  const hasDetection = computed(() => frame.value.freq != null);

  watch(tuning.detectionRange, session.setDetectionRange, { immediate: true });
  watch(frameContext, session.setFrameContext, { immediate: true });

  return {
    cents,
    currentNoteDisplay: computed(() => hasDetection.value ? frame.value.note : null),
    frame,
    hasDetection,
    isInTune: computed(() => frame.value.inTune),
    presentationFrame,
    smoothedFrequency: computed(() => presentationFrame.value.freq),
    targetNote,
    volume: computed(() => presentationFrame.value.level),
  };
}
