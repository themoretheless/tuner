import type {
  SessionBackend,
  SessionLifecycleDriver,
  SessionLifecycleFailure,
  SessionLifecycleOptions,
  SessionLifecycleSnapshot,
  SessionStatus,
} from './sessionLifecycleContract';

export type * from './sessionLifecycleContract';

export class SessionLifecycle {
  private activeBackend: SessionBackend | null = null;
  private desiredListening = false;
  private readonly driver: SessionLifecycleDriver;
  private failure: SessionLifecycleFailure | null = null;
  private readonly options: SessionLifecycleOptions;
  private revision = 0;
  private status: SessionStatus = 'idle';
  private tail: Promise<void> = Promise.resolve();

  constructor(
    driver: SessionLifecycleDriver,
    options: SessionLifecycleOptions = {},
  ) {
    this.driver = driver;
    this.options = options;
  }

  snapshot(): SessionLifecycleSnapshot {
    return {
      activeBackend: this.activeBackend,
      failure: this.failure,
      status: this.status,
    };
  }

  start(backend: SessionBackend): Promise<void> {
    if (this.activeBackend === backend && this.status === 'listening') {
      return Promise.resolve();
    }
    this.desiredListening = true;
    const revision = ++this.revision;
    this.failure = null;
    if (this.status !== 'listening' && this.status !== 'starting') {
      this.setStatus('starting');
    }

    return this.enqueue(async () => {
      if (!this.isCurrent(revision)) return;

      if (this.activeBackend) {
        this.setStatus('stopping');
        const stopped = await this.stopActiveBackend();
        if (!stopped.ok) {
          if (this.isCurrent(revision)) this.setFailure(stopped.failure);
          return;
        }
        if (!this.isCurrent(revision)) return;
      }

      if (this.status !== 'starting') this.setStatus('starting');
      let started = false;
      let startMessage: string | undefined;
      try {
        started = await this.driver.start(backend);
      } catch (cause) {
        startMessage = errorMessage(cause);
        started = false;
      }

      if (!this.isCurrent(revision)) {
        if (started) {
          const stopped = await this.stopBackend(backend);
          if (!stopped.ok) {
            this.activeBackend = backend;
            this.setFailure(stopped.failure);
          }
        }
        return;
      }

      if (!started) {
        this.activeBackend = null;
        this.setFailure({ backend, message: startMessage, operation: 'start' });
        return;
      }

      this.activeBackend = backend;
      this.failure = null;
      this.setStatus('listening');
    });
  }

  stop(): Promise<void> {
    this.desiredListening = false;
    const revision = ++this.revision;
    this.failure = null;
    if (this.status !== 'idle') this.setStatus('stopping');

    return this.enqueue(async () => {
      const stopped = await this.stopActiveBackend();
      if (revision !== this.revision) return;
      if (stopped.ok) this.setStatus('idle');
      else this.setFailure(stopped.failure);
    });
  }

  fail(message?: string): Promise<void> {
    this.desiredListening = false;
    const revision = ++this.revision;
    this.failure = {
      backend: this.activeBackend,
      message,
      operation: 'runtime',
    };
    this.setStatus('error');

    return this.enqueue(async () => {
      const stopped = await this.stopActiveBackend();
      if (revision !== this.revision) return;
      if (!stopped.ok) this.failure = stopped.failure;
      this.setStatus('error');
    });
  }

  clearFailure() {
    if (!this.failure) return;
    this.failure = null;
    this.publish();
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const result = this.tail.then(operation, operation);
    this.tail = result.catch(() => {});
    return result;
  }

  private isCurrent(revision: number) {
    return revision === this.revision && this.desiredListening;
  }

  private async stopActiveBackend(): Promise<StopResult> {
    const backend = this.activeBackend;
    if (!backend) return { ok: true };
    const result = await this.stopBackend(backend);
    if (result.ok && this.activeBackend === backend) this.activeBackend = null;
    return result;
  }

  private async stopBackend(backend: SessionBackend): Promise<StopResult> {
    try {
      await this.driver.stop(backend);
      return { ok: true };
    } catch (cause) {
      return {
        failure: {
          backend,
          message: errorMessage(cause),
          operation: 'stop',
        },
        ok: false,
      };
    }
  }

  private setFailure(failure: SessionLifecycleFailure) {
    this.failure = failure;
    this.setStatus('error');
  }

  private setStatus(status: SessionStatus) {
    this.status = status;
    this.publish();
  }

  private publish() {
    this.options.onChange?.(this.snapshot());
  }
}

type StopResult = { ok: true } | { failure: SessionLifecycleFailure; ok: false };

function errorMessage(cause: unknown) {
  if (cause instanceof Error) return cause.message;
  if (typeof cause === 'string' && cause) return cause;
  return undefined;
}
