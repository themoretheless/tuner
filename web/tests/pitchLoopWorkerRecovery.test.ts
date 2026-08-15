import { effectScope } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePitchLoop } from '../src/composables/usePitchLoop';
import { createUnresolvedDetectionFrame } from '../src/domain/detectionFrame';
import type { AudioFrame } from '../src/ports/audioInput';

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
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

function stepAnimationFrame() {
  const callback = rafCallback;
  rafCallback = null;
  callback?.(nowMs);
}

function audioFrame(): AudioFrame {
  const buffer = new Float32Array(128);
  for (let index = 0; index < buffer.length; index += 1) {
    buffer[index] = index % 2 === 0 ? 0.25 : -0.25;
  }
  return { buffer, sampleRate: 48_000, timebase: null };
}

function startLoop() {
  const scope = effectScope();
  const loop = scope.run(() => usePitchLoop(audioFrame))!;
  loop.start();
  return { loop, scope };
}

function processMessages(worker: FakeWorker) {
  return worker.posted.filter((message) => message.type === 'process');
}

describe('usePitchLoop worker recovery', () => {
  afterEach(() => {
    FakeWorker.instances.length = 0;
    rafCallback = null;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

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

  it('recovers from a lost worker response after reset instead of starving forever', () => {
    stubEnvironment();
    const { loop, scope } = startLoop();

    stepAnimationFrame();
    const worker = FakeWorker.instances[0];
    expect(processMessages(worker)).toHaveLength(1);

    // The response never arrives: without an onmessage or onerror the
    // pending request id used to dangle and block every future request.
    nowMs += 50;
    stepAnimationFrame();
    expect(processMessages(worker)).toHaveLength(1);

    loop.reset();
    nowMs += 50;
    stepAnimationFrame();
    expect(processMessages(worker)).toHaveLength(2);

    scope.stop();
  });

  it('discards a stale response that arrives after reset and applies the next one', () => {
    stubEnvironment();
    const { loop, scope } = startLoop();

    stepAnimationFrame();
    const worker = FakeWorker.instances[0];
    const staleId = processMessages(worker)[0].id as number;
    loop.reset();

    worker.onmessage?.({
      data: {
        backend: 'wasm',
        buffer: new ArrayBuffer(4),
        frame: createUnresolvedDetectionFrame({ confidence: 0.9, freq: 220 }),
        id: staleId,
        semantics: 'resolved',
        timebase: null,
      },
    });
    expect(loop.detectionFrame.value.freq).toBeNull();
    expect(loop.detectorBackend.value).toBe('typescript');

    nowMs += 50;
    stepAnimationFrame();
    const freshId = processMessages(worker)[1].id as number;
    expect(freshId).not.toBe(staleId);
    worker.onmessage?.({
      data: {
        backend: 'wasm',
        buffer: new ArrayBuffer(4),
        frame: createUnresolvedDetectionFrame({ confidence: 0.9, freq: 220 }),
        id: freshId,
        semantics: 'resolved',
        timebase: null,
      },
    });
    expect(loop.detectionFrame.value.freq).toBe(220);
    expect(loop.detectorBackend.value).toBe('wasm');

    scope.stop();
  });
});
