import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import { usePitchLoop } from './usePitchLoop';
import type { PitchWorkerRequest, PitchWorkerResponse } from '../types/pitchWorker';

class FakeWorker {
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessage: ((event: MessageEvent<PitchWorkerResponse>) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  readonly messages: PitchWorkerRequest[] = [];
  readonly terminate = vi.fn();

  postMessage(message: PitchWorkerRequest) {
    this.messages.push(message);
  }

  emit(response: PitchWorkerResponse) {
    this.onmessage?.({ data: response } as MessageEvent<PitchWorkerResponse>);
  }
}

describe('usePitchLoop worker backpressure', () => {
  let now = 0;
  let nextRafId = 1;
  let callbacks: Map<number, FrameRequestCallback>;
  let workers: FakeWorker[];

  beforeEach(() => {
    callbacks = new Map();
    workers = [];
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const id = nextRafId++;
      callbacks.set(id, callback);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
    vi.stubGlobal('Worker', class {
      constructor() {
        const worker = new FakeWorker();
        workers.push(worker);
        return worker;
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function runFrame(timestamp: number) {
    now = timestamp;
    const entry = callbacks.entries().next().value as [number, FrameRequestCallback] | undefined;
    if (!entry) throw new Error('No animation frame scheduled');
    callbacks.delete(entry[0]);
    entry[1](timestamp);
  }

  function createFrame(frequency = 110) {
    const sampleRate = 44100;
    const buffer = new Float32Array(4096) as Float32Array<ArrayBuffer>;
    for (let i = 0; i < buffer.length; i += 1) {
      buffer[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * 0.4;
    }
    return { buffer, sampleRate };
  }

  it('keeps one in-flight and one latest queued request and ignores stale replies', () => {
    const loop = usePitchLoop(() => createFrame(), ref({ minFrequency: 60, maxFrequency: 300 }));
    loop.start();
    runFrame(34);
    runFrame(68);

    const worker = workers[0];
    expect(worker.messages).toHaveLength(1);
    const firstId = worker.messages[0].id;
    worker.emit({ id: firstId, detection: { frequency: 110, confidence: 0.95 } });
    expect(worker.messages).toHaveLength(2);

    const secondId = worker.messages[1].id;
    worker.emit({ id: firstId, detection: { frequency: 999, confidence: 1 } });
    expect(loop.currentFrequency.value).toBe(110);

    worker.emit({ id: secondId, detection: { frequency: 220, confidence: 0.9 } });
    expect(loop.currentFrequency.value).toBe(220);
    expect(loop.confidence.value).toBe(0.9);
    loop.stop();
  });

  it('falls back to main-thread detection when the worker reports an error', () => {
    const frame = createFrame(110);
    const loop = usePitchLoop(() => frame, ref({ minFrequency: 60, maxFrequency: 160 }));
    loop.start();
    runFrame(34);

    const worker = workers[0];
    worker.emit({ id: worker.messages[0].id, detection: null, error: 'worker failure' });
    expect(loop.currentFrequency.value).not.toBeNull();
    expect(Math.abs(loop.currentFrequency.value! - 110)).toBeLessThan(1.5);
    loop.stop();
  });
});
