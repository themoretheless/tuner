import { effectScope, ref } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePitchLoop } from '../src/composables/usePitchLoop';
import { createUnresolvedDetectionFrame } from '../src/domain/detectionFrame';
import { pipelinePresetConfig, type PipelineConfig } from '../src/domain/pipelineConfig';
import type { AudioFrame } from '../src/ports/audioInput';
import type { PitchWorkerResponse } from '../src/workers/pitchWorkerProtocol';

// Regression coverage for the "note gluing" fix: the worker-side processor
// (smoother/tracker) must reset after ~3 quiet ticks, while the UI keeps
// holding the last reading until the 8th quiet tick. Before the fix the
// worker reset only happened together with the UI clear, so a pause shorter
// than 8 ticks followed by a new note left stale smoother state and the
// readout showed transitional garbage between the notes.

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: { data: PitchWorkerResponse }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onmessageerror: ((event: unknown) => void) | null = null;
  posted: Array<Record<string, unknown>> = [];
  constructor() {
    FakeWorker.instances.push(this);
  }
  postMessage(message: Record<string, unknown>) {
    this.posted.push(message);
  }
  terminate() {}
}

let nowMs = 100_000;
let rafCallback: FrameRequestCallback | null = null;

function stepAnimationFrame(advanceMs = 17) {
  nowMs += advanceMs;
  const callback = rafCallback;
  rafCallback = null;
  callback?.(nowMs);
}

function loudFrame(): AudioFrame {
  const buffer = new Float32Array(128);
  for (let index = 0; index < buffer.length; index += 1) {
    buffer[index] = index % 2 === 0 ? 0.25 : -0.25;
  }
  return { buffer, sampleRate: 48_000, timebase: null };
}

function quietFrame(): AudioFrame {
  return { buffer: new Float32Array(128), sampleRate: 48_000, timebase: null };
}

function stubEnvironment() {
  nowMs = 100_000;
  vi.stubGlobal('Worker', FakeWorker);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    rafCallback = callback;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
}

function startLoop(pipelineConfig?: PipelineConfig) {
  let loud = true;
  const scope = effectScope();
  const loop = scope.run(() => usePitchLoop(
    () => (loud ? loudFrame() : quietFrame()),
    undefined,
    undefined,
    pipelineConfig ? ref(pipelineConfig) : undefined,
  ))!;
  loop.start();
  return {
    loop,
    scope,
    setLoud(value: boolean) {
      loud = value;
    },
  };
}

function messagesOfType(worker: FakeWorker, type: string) {
  return worker.posted.filter((message) => message.type === type);
}

function respondWithFrequency(worker: FakeWorker, freq: number) {
  const processMessages = messagesOfType(worker, 'process');
  const id = processMessages[processMessages.length - 1].id as number;
  worker.onmessage?.({
    data: {
      backend: 'wasm',
      buffer: new ArrayBuffer(4),
      frame: createUnresolvedDetectionFrame({ confidence: 0.9, freq }),
      id,
      semantics: 'resolved',
      timebase: null,
    },
  });
}

describe('usePitchLoop quiet-tick worker reset', () => {
  afterEach(() => {
    FakeWorker.instances.length = 0;
    rafCallback = null;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('resets the worker processor after 3 quiet ticks while the UI holds until tick 8', () => {
    stubEnvironment();
    const { loop, scope, setLoud } = startLoop();

    stepAnimationFrame();
    const worker = FakeWorker.instances[0];
    expect(messagesOfType(worker, 'process')).toHaveLength(1);
    respondWithFrequency(worker, 220);
    expect(loop.detectionFrame.value.freq).toBe(220);

    setLoud(false);
    stepAnimationFrame(); // quiet tick 1
    stepAnimationFrame(); // quiet tick 2
    expect(messagesOfType(worker, 'reset')).toHaveLength(0);
    expect(loop.detectionFrame.value.freq).toBe(220);

    stepAnimationFrame(); // quiet tick 3: early processor reset fires
    expect(messagesOfType(worker, 'reset')).toHaveLength(1);
    // UI hold is a separate concern: the reading must survive the reset.
    expect(loop.detectionFrame.value.freq).toBe(220);

    for (let tick = 4; tick <= 7; tick += 1) {
      stepAnimationFrame();
      expect(loop.detectionFrame.value.freq).toBe(220);
    }
    // The reset is a one-time edge per quiet streak, not a per-tick flood.
    expect(messagesOfType(worker, 'reset')).toHaveLength(1);

    stepAnimationFrame(); // quiet tick 8: sustained quiet clears the UI
    expect(loop.detectionFrame.value.freq).toBeNull();
    expect(messagesOfType(worker, 'reset')).toHaveLength(1);

    scope.stop();
  });

  it('starts the next note from a clean worker state after a pause shorter than the UI clear threshold', () => {
    stubEnvironment();
    const { loop, scope, setLoud } = startLoop();

    stepAnimationFrame();
    const worker = FakeWorker.instances[0];
    respondWithFrequency(worker, 82.41); // low E ringing

    // A short inter-note pause: 4 quiet ticks, well below the 8-tick UI
    // clear threshold. Before the fix no worker reset happened here, so the
    // smoother/tracker blended the next note with this one ("note gluing").
    setLoud(false);
    for (let tick = 1; tick <= 4; tick += 1) stepAnimationFrame();
    expect(messagesOfType(worker, 'reset')).toHaveLength(1);
    // The display still holds the old note: no transitional readout change.
    expect(loop.detectionFrame.value.freq).toBe(82.41);

    setLoud(true);
    stepAnimationFrame();
    const processMessages = messagesOfType(worker, 'process');
    expect(processMessages).toHaveLength(2);

    // Ordering guarantee: the reset reached the worker strictly between the
    // two notes' process messages, so the second note starts from a clean
    // smoother instead of blending with the first.
    const postedTypes = worker.posted.map((message) => message.type);
    expect(postedTypes.indexOf('reset')).toBeGreaterThan(postedTypes.indexOf('process'));
    expect(postedTypes.lastIndexOf('reset')).toBeLessThan(postedTypes.lastIndexOf('process'));

    respondWithFrequency(worker, 110); // new note (A2) reads cleanly
    expect(loop.detectionFrame.value.freq).toBe(110);

    scope.stop();
  });

  it('keeps resetting on the first quiet tick when hold is disabled', () => {
    stubEnvironment();
    const { loop, scope, setLoud } = startLoop(pipelinePresetConfig('fast'));

    stepAnimationFrame();
    const worker = FakeWorker.instances[0];
    respondWithFrequency(worker, 220);
    expect(loop.detectionFrame.value.freq).toBe(220);

    setLoud(false);
    stepAnimationFrame(); // quiet tick 1: reset + immediate clear, as before
    expect(messagesOfType(worker, 'reset')).toHaveLength(1);
    expect(loop.detectionFrame.value.freq).toBeNull();

    scope.stop();
  });
});
