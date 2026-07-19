import type { AudioInputId } from '../ports/audioInput';

export type SessionBackend = AudioInputId;
export type SessionStatus = 'idle' | 'starting' | 'listening' | 'stopping' | 'error';
export type SessionFailureOperation = 'runtime' | 'start' | 'stop';

export interface SessionLifecycleFailure {
  backend: SessionBackend | null;
  message?: string;
  operation: SessionFailureOperation;
}

export interface SessionLifecycleSnapshot {
  activeBackend: SessionBackend | null;
  failure: SessionLifecycleFailure | null;
  status: SessionStatus;
}

export interface SessionLifecycleDriver {
  start(backend: SessionBackend): Promise<boolean>;
  stop(backend: SessionBackend): Promise<void>;
}

export interface SessionLifecycleOptions {
  onChange?: (snapshot: SessionLifecycleSnapshot) => void;
}
