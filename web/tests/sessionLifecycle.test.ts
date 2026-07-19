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
    expect(lifecycle.snapshot()).toEqual({
      activeBackend: 'native',
      failure: null,
      status: 'listening',
    });
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
    expect(lifecycle.snapshot()).toEqual({ activeBackend: null, failure: null, status: 'idle' });
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

    expect(lifecycle.snapshot()).toEqual({
      activeBackend: null,
      failure: { backend: failedBackend, operation: 'start' },
      status: 'error',
    });
  });

  it('keeps a failed teardown visible and lets a later stop retry it', async () => {
    let stopAttempts = 0;
    const lifecycle = new SessionLifecycle({
      async start() {
        return true;
      },
      async stop() {
        stopAttempts += 1;
        if (stopAttempts === 1) throw new Error('device still active');
      },
    });

    await lifecycle.start('web');
    await lifecycle.stop();

    expect(lifecycle.snapshot()).toEqual({
      activeBackend: 'web',
      failure: {
        backend: 'web',
        message: 'device still active',
        operation: 'stop',
      },
      status: 'error',
    });

    await lifecycle.stop();
    expect(stopAttempts).toBe(2);
    expect(lifecycle.snapshot()).toEqual({ activeBackend: null, failure: null, status: 'idle' });
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
    expect(lifecycle.snapshot()).toEqual({
      activeBackend: null,
      failure: { backend: 'web', operation: 'runtime' },
      status: 'error',
    });

    await lifecycle.start('web');
    expect(calls).toEqual(['start:web', 'stop:web', 'start:web']);
    expect(lifecycle.snapshot()).toEqual({
      activeBackend: 'web',
      failure: null,
      status: 'listening',
    });
  });

  it('publishes a restart intent before a queued stop finishes', async () => {
    let releaseStop: (() => void) | null = null;
    const stopGate = new Promise<void>((resolve) => {
      releaseStop = resolve;
    });
    const lifecycle = new SessionLifecycle({
      async start() {
        return true;
      },
      async stop() {
        await stopGate;
      },
    });

    await lifecycle.start('web');
    const stopping = lifecycle.stop();
    const restarting = lifecycle.start('web');

    expect(lifecycle.snapshot().status).toBe('starting');
    releaseStop?.();
    await Promise.all([stopping, restarting]);
    expect(lifecycle.snapshot()).toEqual({
      activeBackend: 'web',
      failure: null,
      status: 'listening',
    });
  });
});
