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
import type { PipelineConfig } from '../domain/pipelineConfig';
import { normalizePipelineTelemetry } from '../domain/pipelineTelemetry';

interface WasmTunerFrame {
  readonly adaptive_gate_open: boolean;
  readonly arbitration: string;
  readonly cents: number;
  readonly confidence: number;
  readonly confidence_agreement: number;
  readonly confidence_calibrated: number;
  readonly confidence_periodicity: number;
  readonly confidence_signal: number;
  readonly confidence_stability: number;
  readonly confidence_uncertainty_cents: number;
  readonly config_fingerprint: number;
  readonly decision: string;
  readonly freq: number;
  readonly fixed_gate_open: boolean;
  readonly gate_threshold: number;
  readonly harmonic_1: number;
  readonly harmonic_2: number;
  readonly harmonic_3: number;
  readonly harmonic_4: number;
  readonly harmonic_5: number;
  readonly held: boolean;
  readonly raw_freq: number;
  readonly has_frequency: boolean;
  readonly has_interference: boolean;
  readonly has_raw_frequency: boolean;
  readonly has_secondary_candidate: boolean;
  readonly has_selected_candidate: boolean;
  readonly has_spectral_evidence: boolean;
  readonly has_target: boolean;
  readonly has_yin_candidate: boolean;
  readonly in_tune: boolean;
  readonly interference_candidate_frequency: number;
  readonly interference_competing_target_frequency: number;
  readonly interference_distance_cents: number;
  readonly interference_selected_target_frequency: number;
  readonly is_power: boolean;
  readonly level: number;
  readonly noise_floor: number;
  readonly note: string;
  readonly octave_active: number;
  readonly octave_base_frequency: number;
  readonly octave_center_score: number;
  readonly octave_down_score: number;
  readonly octave_pending: number;
  readonly octave_up_score: number;
  readonly rms: number;
  readonly sample_rate: number;
  readonly secondary_confidence: number;
  readonly secondary_frequency: number;
  readonly selected_confidence: number;
  readonly selected_frequency: number;
  readonly target_frequency: number;
  readonly target_midi: number;
  readonly tracked: boolean;
  readonly window_samples: number;
  readonly yin_confidence: number;
  readonly yin_frequency: number;
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
  set_pipeline_config(
    adaptiveGateEnabled: boolean,
    dcRemovalEnabled: boolean,
    fixedGateEnabled: boolean,
    harmonicEnabled: boolean,
    holdEnabled: boolean,
    octaveEnabled: boolean,
    powerChordEnabled: boolean,
    secondaryDetectorEnabled: boolean,
    trackingEnabled: boolean,
    yinEnabled: boolean,
  ): void;
}

export function applyPipelineConfig(
  processor: StatefulWasmTunerProcessor,
  config: PipelineConfig,
) {
  processor.set_pipeline_config(
    config.adaptiveGateEnabled,
    config.dcRemovalEnabled,
    config.fixedGateEnabled,
    config.harmonicEnabled,
    config.holdEnabled,
    config.octaveEnabled,
    config.powerChordEnabled,
    config.secondaryDetectorEnabled,
    config.trackingEnabled,
    config.yinEnabled,
  );
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
    pipeline: normalizePipelineTelemetry({
      adaptiveGateOpen: frame.adaptive_gate_open,
      arbitration: frame.arbitration,
      confidence: {
        agreement: frame.confidence_agreement,
        calibrated: frame.confidence_calibrated,
        periodicity: frame.confidence_periodicity,
        signal: frame.confidence_signal,
        stability: frame.confidence_stability,
        uncertaintyCents: frame.confidence_uncertainty_cents,
      },
      configFingerprint: frame.config_fingerprint,
      decision: frame.decision,
      fixedGateOpen: frame.fixed_gate_open,
      gateThreshold: frame.gate_threshold,
      held: frame.held,
      interference: frame.has_interference ? {
        candidateFrequency: frame.interference_candidate_frequency,
        competingTargetFrequency: frame.interference_competing_target_frequency,
        distanceCents: frame.interference_distance_cents,
        selectedTargetFrequency: frame.interference_selected_target_frequency,
      } : null,
      noiseFloor: frame.noise_floor,
      sampleRate: frame.sample_rate,
      secondary: frame.has_secondary_candidate ? {
        confidence: frame.secondary_confidence,
        frequency: frame.secondary_frequency,
      } : null,
      selected: frame.has_selected_candidate ? {
        confidence: frame.selected_confidence,
        frequency: frame.selected_frequency,
      } : null,
      spectral: frame.has_spectral_evidence ? {
        activeOctave: frame.octave_active,
        baseFrequency: frame.octave_base_frequency,
        harmonics: [
          frame.harmonic_1,
          frame.harmonic_2,
          frame.harmonic_3,
          frame.harmonic_4,
          frame.harmonic_5,
        ],
        octaveScores: [
          frame.octave_down_score,
          frame.octave_center_score,
          frame.octave_up_score,
        ],
        pendingOctave: frame.octave_pending,
      } : null,
      tracked: frame.tracked,
      windowSamples: frame.window_samples,
      yin: frame.has_yin_candidate ? {
        confidence: frame.yin_confidence,
        frequency: frame.yin_frequency,
      } : null,
    }),
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
