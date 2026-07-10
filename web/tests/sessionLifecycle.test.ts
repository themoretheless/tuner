import { describe, expect, it } from 'vitest';

import {
  SessionLifecycle,
  type SessionBackend,
  type SessionLifecycleSnapshot,
} from '../src/session/sessionLifecycle';

describe('SessionLifecycle', () => {
  it('serializes backend switches and stops the previous adapter', async () => {
    const calls: string[] = [];
    const states: SessionLifecycleSnapshot[] = [];
    const lifecycle = new SessionLifecycle({
      async start(backend) {
        calls.push(`start:${backend}`);
        return true;
      },
      async stop(backend) {
        calls.push(`stop:${backend}`);
      },
    }, {
      onChange: (snapshot) => states.push(snapshot),
    });

    await lifecycle.start('web');
    await lifecycle.start('native');

    expect(calls).toEqual(['start:web', 'stop:web', 'start:native']);
    expect(lifecycle.snapshot()).toEqual({ activeBackend: 'native', status: 'listening' });
    expect(states.map((state) => state.status)).toEqual([
      'starting',
      'listening',
      'stopping',
      'starting',
      'listening',
    ]);
  });

  it('cancels a queued start when stop wins the latest intent', async () => {
    const calls: string[] = [];
    let resolveStart: ((started: boolean) => void) | null = null;
    const startGate = new Promise<boolean>((resolve) => {
      resolveStart = resolve;
    });
    const lifecycle = new SessionLifecycle({
      async start(backend) {
        calls.push(`start:${backend}`);
        return startGate;
      },
      async stop(backend) {
        calls.push(`stop:${backend}`);
      },
    });

    const starting = lifecycle.start('web');
    await Promise.resolve();
    const stopping = lifecycle.stop();
    resolveStart?.(true);
    await Promise.all([starting, stopping]);

    expect(calls).toEqual(['start:web', 'stop:web']);
    expect(lifecycle.snapshot()).toEqual({ activeBackend: null, status: 'idle' });
  });

  it('reports an adapter start failure as an error state', async () => {
    const failedBackend: SessionBackend = 'native';
    const lifecycle = new SessionLifecycle({
      async start(backend) {
        return backend !== failedBackend;
      },
      async stop() {},
    });

    await lifecycle.start(failedBackend);

    expect(lifecycle.snapshot()).toEqual({ activeBackend: null, status: 'error' });
  });

  it('returns to idle even when an adapter teardown rejects', async () => {
    const lifecycle = new SessionLifecycle({
      async start() {
        return true;
      },
      async stop() {
        throw new Error('device already gone');
      },
    });

    await lifecycle.start('web');
    await lifecycle.stop();

    expect(lifecycle.snapshot()).toEqual({ activeBackend: null, status: 'idle' });
  });

  it('tears down after a runtime failure and can start again', async () => {
    const calls: string[] = [];
    const lifecycle = new SessionLifecycle({
      async start(backend) {
        calls.push(`start:${backend}`);
        return true;
      },
      async stop(backend) {
        calls.push(`stop:${backend}`);
      },
    });

    await lifecycle.start('web');
    await lifecycle.fail();
    expect(lifecycle.snapshot()).toEqual({ activeBackend: null, status: 'error' });

    await lifecycle.start('web');
    expect(calls).toEqual(['start:web', 'stop:web', 'start:web']);
    expect(lifecycle.snapshot()).toEqual({ activeBackend: 'web', status: 'listening' });
  });
});
