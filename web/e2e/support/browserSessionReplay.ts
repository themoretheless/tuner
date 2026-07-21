import type { Page } from '@playwright/test';

import type {
  PreparedReplayCase,
  ReplayFrame,
  ReplayRange,
} from './sessionReplayContract';

export interface BrowserReplayResult {
  frames: ReplayFrame[];
  id: string;
}

interface WasmFrame {
  adaptive_gate_open: boolean;
  arbitration: string;
  cents: number;
  confidence: number;
  decision: string;
  fixed_gate_open: boolean;
  free(): void;
  freq: number;
  has_frequency: boolean;
  has_raw_frequency: boolean;
  has_target: boolean;
  held: boolean;
  in_tune: boolean;
  is_power: boolean;
  note: string;
  raw_freq: number;
  rms: number;
  target_frequency: number;
  tracked: boolean;
}

interface WasmProcessor {
  free(): void;
  process(buffer: Float32Array, sampleRate: number): WasmFrame;
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
    enterCents: number,
    exitCents: number,
  ): void;
  set_frequency_range(minFrequency: number, maxFrequency: number): void;
}

export function runBrowserSessionReplay(
  page: Page,
  cases: PreparedReplayCase[],
  range: ReplayRange,
  windowSamples: number,
) {
  return page.evaluate(async ({ cases, range, windowSamples }) => {
    const moduleUrl = new URL('wasm/pitch_core.js', document.baseURI).href;
    const pitchCore = await import(/* @vite-ignore */ moduleUrl) as {
      default(): Promise<unknown>;
      TunerProcessor: new () => WasmProcessor;
    };
    await pitchCore.default();

    return cases.map((replayCase) => {
      const processor = new pitchCore.TunerProcessor();
      const frames: ReplayFrame[] = [];
      try {
        processor.set_frequency_range(range.minFrequency, range.maxFrequency);
        const midis = new Int32Array([replayCase.target.midi]);
        const frequencies = new Float32Array([replayCase.target.frequency]);
        processor.set_frame_context(
          440,
          midis,
          frequencies,
          midis,
          frequencies,
          replayCase.target.midi,
          replayCase.target.frequency,
          -1,
          0,
          5,
          7,
        );

        for (let index = 0; index < replayCase.nativeFrames.length; index += 1) {
          const sampleIndex = index * replayCase.hopSamples;
          const samples = new Float32Array(
            replayCase.samples.slice(sampleIndex, sampleIndex + windowSamples),
          );
          const frame = processor.process(samples, replayCase.sampleRate);
          try {
            frames.push({
              adaptiveGateOpen: frame.adaptive_gate_open,
              arbitration: frame.arbitration,
              cents: frame.cents,
              confidence: frame.confidence,
              decision: frame.decision,
              fixedGateOpen: frame.fixed_gate_open,
              held: frame.held,
              inTune: frame.in_tune,
              isPower: frame.is_power,
              note: frame.note,
              publishedFrequency: frame.has_frequency ? frame.freq : null,
              rawFrequency: frame.has_raw_frequency ? frame.raw_freq : null,
              rms: frame.rms,
              sampleIndex,
              targetFrequency: frame.has_target ? frame.target_frequency : null,
              tracked: frame.tracked,
              windowEndSample: sampleIndex + windowSamples,
            });
          } finally {
            frame.free();
          }
        }
      } finally {
        processor.free();
      }
      return { frames, id: replayCase.id };
    });
  }, { cases, range, windowSamples }) as Promise<BrowserReplayResult[]>;
}
