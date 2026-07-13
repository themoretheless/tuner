import {
  clampConfidence,
  finiteOr,
  positiveFiniteOrNull,
} from '../domain/detectionFrame';
import {
  noteNameFromMidi,
  noteToMidi,
  octaveFromMidi,
} from '../generated/noteMath';
import type { DetectionFrame, FrameContext } from '../types/frames';

interface WasmTunerFrame {
  readonly cents: number;
  readonly confidence: number;
  readonly freq: number;
  readonly raw_freq: number;
  readonly has_frequency: boolean;
  readonly has_raw_frequency: boolean;
  readonly has_target: boolean;
  readonly in_tune: boolean;
  readonly is_power: boolean;
  readonly level: number;
  readonly note: string;
  readonly rms: number;
  readonly target_frequency: number;
  readonly target_midi: number;
  free(): void;
}

export interface StatefulWasmTunerProcessor {
  clear_frame_context(): void;
  free(): void;
  process(buffer: Float32Array, sampleRate: number): WasmTunerFrame;
  reset(): void;
  set_frame_context(
    a4: number,
    displayMidis: Int32Array,
    displayFrequencies: Float32Array,
    tuningMidis: Int32Array,
    tuningFrequencies: Float32Array,
    selectedMidi: number,
    selectedFrequency: number,
    idleMidi: number,
    idleFrequency: number,
    inTuneEnterCents: number,
    inTuneExitCents: number,
  ): void;
  set_frequency_range(minFrequency: number, maxFrequency: number): void;
}

export function applyFrameContext(
  processor: StatefulWasmTunerProcessor,
  context: FrameContext,
) {
  const displayMidis = Int32Array.from(context.displayTargets, toMidi);
  const displayFrequencies = Float32Array.from(context.displayTargets, (note) => note.frequency);
  const tuningMidis = Int32Array.from(context.tuningTargets, toMidi);
  const tuningFrequencies = Float32Array.from(context.tuningTargets, (note) => note.frequency);
  const selected = noteParts(context.selectedTarget);
  const idle = noteParts(context.idleTarget);
  processor.set_frame_context(
    context.a4,
    displayMidis,
    displayFrequencies,
    tuningMidis,
    tuningFrequencies,
    selected.midi,
    selected.frequency,
    idle.midi,
    idle.frequency,
    context.inTuneEnterCents,
    context.inTuneExitCents,
  );
}

export function readWasmFrame(frame: WasmTunerFrame): DetectionFrame {
  const freq = frame.has_frequency ? positiveFiniteOrNull(frame.freq) : null;
  const targetFrequency = positiveFiniteOrNull(frame.target_frequency);
  const targetMidi = Math.trunc(finiteOr(frame.target_midi, -1));
  const target = frame.has_target && targetFrequency != null && targetMidi >= 0
    ? {
        frequency: targetFrequency,
        name: noteNameFromMidi(targetMidi),
        octave: octaveFromMidi(targetMidi),
      }
    : null;
  return {
    freq,
    rawFreq: frame.has_raw_frequency ? positiveFiniteOrNull(frame.raw_freq) : null,
    confidence: freq == null ? 0 : clampConfidence(frame.confidence),
    rms: Math.max(0, finiteOr(frame.rms)),
    level: Math.max(0, Math.min(1, finiteOr(frame.level))),
    cents: finiteOr(frame.cents),
    note: typeof frame.note === 'string' && frame.note ? frame.note : '\u2014',
    target,
    inTune: freq != null && Boolean(frame.in_tune),
    isPower: freq != null && Boolean(frame.is_power),
  };
}

function toMidi(note: FrameContext['displayTargets'][number]) {
  return noteToMidi(note.name, note.octave);
}

function noteParts(note: FrameContext['selectedTarget']) {
  return note
    ? { frequency: note.frequency, midi: toMidi(note) }
    : { frequency: 0, midi: -1 };
}
