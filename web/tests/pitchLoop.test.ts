import { afterEach, describe, expect, it, vi } from 'vitest';

import { usePitchLoop } from '../src/composables/usePitchLoop';

describe('usePitchLoop worker degradation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps detecting when the Worker constructor throws', () => {
    const clock = installAnimationClock();
    const WorkerConstructor = vi.fn(function BrokenWorker() {
      throw new Error('worker blocked');
    });
    vi.stubGlobal('Worker', WorkerConstructor);
    const loop = usePitchLoop(createFrameReader());

    loop.start();
    clock.step(34);
    clock.step(34);

    expect(WorkerConstructor).toHaveBeenCalledOnce();
    expect(loop.detectorBackend.value).toBe('typescript');
    expect(loop.frameSemantics.value).toBe('unresolved');
    expect(loop.detectionFrame.value.freq).toBeCloseTo(82.4069, 0);
    expect(clock.pending()).toBeGreaterThan(0);
    loop.stop();
  });

  it('disables a Worker after an asynchronous runtime error', () => {
    const clock = installAnimationClock();
    const workers: SilentWorker[] = [];
    const WorkerConstructor = vi.fn(function WorkerFactory() {
      const worker = new SilentWorker();
      workers.push(worker);
      return worker;
    });
    vi.stubGlobal('Worker', WorkerConstructor);
    const loop = usePitchLoop(createFrameReader());

    loop.start();
    clock.step(34);
    workers[0]?.onerror?.(new Event('error'));
    clock.step(34);
    clock.step(34);

    expect(WorkerConstructor).toHaveBeenCalledOnce();
    expect(workers[0]?.terminate).toHaveBeenCalledOnce();
    expect(loop.detectorBackend.value).toBe('typescript');
    expect(loop.detectionFrame.value.freq).toBeCloseTo(82.4069, 0);
    loop.stop();
  });

  it('falls back after an in-flight Worker request times out', () => {
    const clock = installAnimationClock();
    const workers: SilentWorker[] = [];
    vi.stubGlobal('Worker', function WorkerFactory() {
      const worker = new SilentWorker();
      workers.push(worker);
      return worker;
    });
    const loop = usePitchLoop(createFrameReader());

    loop.start();
    clock.step(34);
    expect(workers[0]?.postMessage).toHaveBeenCalledOnce();
    clock.step(1_501);
    clock.step(34);

    expect(workers[0]?.terminate).toHaveBeenCalledOnce();
    expect(loop.detectorBackend.value).toBe('typescript');
    expect(loop.detectionFrame.value.freq).toBeCloseTo(82.4069, 0);
    loop.stop();
  });
});

class SilentWorker {
  onerror: ((event: Event) => unknown) | null = null;
  onmessage: ((event: MessageEvent) => unknown) | null = null;
  onmessageerror: ((event: MessageEvent) => unknown) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
}

function createFrameReader() {
  const sampleRate = 44_100;
  const buffer = Float32Array.from({ length: 8192 }, (_, index) => (
    Math.sin(2 * Math.PI * 82.4069 * index / sampleRate) * 0.4
  ));
  return () => ({
    buffer,
    sampleRate,
    timebase: null,
  });
}

function installAnimationClock() {
  let now = 0;
  let nextId = 1;
  const callbacks = new Map<number, FrameRequestCallback>();
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = nextId;
    nextId += 1;
    callbacks.set(id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
  return {
    pending: () => callbacks.size,
    step(milliseconds: number) {
      now += milliseconds;
      const next = callbacks.entries().next().value as [number, FrameRequestCallback] | undefined;
      if (!next) throw new Error('No animation frame is pending');
      callbacks.delete(next[0]);
      next[1](now);
    },
  };
}
