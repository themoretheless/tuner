export type SessionBackend = 'web' | 'native' | 'synthetic';

export type SessionStatus = 'idle' | 'starting' | 'listening' | 'stopping' | 'error';

export interface SessionLifecycleSnapshot {
  activeBackend: SessionBackend | null;
  status: SessionStatus;
}

export interface SessionLifecycleDriver {
  start(backend: SessionBackend): Promise<boolean>;
  stop(backend: SessionBackend): Promise<void>;
}

export interface SessionLifecycleOptions {
  onChange?: (snapshot: SessionLifecycleSnapshot) => void;
}

export class SessionLifecycle {
  private activeBackend: SessionBackend | null = null;
  private desiredListening = false;
  private readonly driver: SessionLifecycleDriver;
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
      status: this.status,
    };
  }

  start(backend: SessionBackend): Promise<void> {
    this.desiredListening = true;
    const revision = ++this.revision;

    return this.enqueue(async () => {
      if (!this.isCurrent(revision)) return;
      if (this.activeBackend === backend && this.status === 'listening') return;

      if (this.activeBackend) {
        this.setStatus('stopping');
        await this.stopActiveBackend();
        if (!this.isCurrent(revision)) return;
      }

      this.setStatus('starting');
      let started = false;
      try {
        started = await this.driver.start(backend);
      } catch {
        started = false;
      }

      if (!this.isCurrent(revision)) {
        if (started) await this.stopBackend(backend);
        return;
      }

      if (!started) {
        this.activeBackend = null;
        this.setStatus('error');
        return;
      }

      this.activeBackend = backend;
      this.setStatus('listening');
    });
  }

  stop(): Promise<void> {
    this.desiredListening = false;
    const revision = ++this.revision;
    if (this.status !== 'idle') this.setStatus('stopping');

    return this.enqueue(async () => {
      await this.stopActiveBackend();
      if (revision === this.revision) this.setStatus('idle');
    });
  }

  fail(): Promise<void> {
    this.desiredListening = false;
    const revision = ++this.revision;
    this.setStatus('error');

    return this.enqueue(async () => {
      await this.stopActiveBackend();
      if (revision === this.revision) this.setStatus('error');
    });
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const result = this.tail.then(operation, operation);
    this.tail = result.catch(() => {});
    return result;
  }

  private isCurrent(revision: number) {
    return revision === this.revision && this.desiredListening;
  }

  private async stopActiveBackend() {
    const backend = this.activeBackend;
    this.activeBackend = null;
    if (!backend) return;
    await this.stopBackend(backend);
  }

  private async stopBackend(backend: SessionBackend) {
    try {
      await this.driver.stop(backend);
    } catch {
      // A failed adapter teardown must not leave the lifecycle permanently
      // stuck in `stopping`; the next start still gets a clean serialized turn.
    }
  }

  private setStatus(status: SessionStatus) {
    this.status = status;
    this.options.onChange?.(this.snapshot());
  }
}
