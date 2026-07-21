import type { PitchDetectionRange } from '../../utils/pitch';
import type { AudioBackend } from '../../utils/settingsStorage';
import type { SessionStatus } from '../../session/sessionLifecycle';
import type { ReadableValue } from '../ports/value';

export interface ListeningSessionPort {
  clearError(): void;
  setAudioBackend(backend: AudioBackend): Promise<void>;
  start(range: PitchDetectionRange): Promise<void>;
  status: ReadableValue<SessionStatus>;
  stop(): Promise<void>;
}

export interface ListeningControllerDependencies {
  clearHistory(): void;
  detectionRange: ReadableValue<PitchDetectionRange>;
  session: ListeningSessionPort;
  stopReferenceTone(): void;
}

export function createListeningController(dependencies: ListeningControllerDependencies) {
  async function start() {
    dependencies.clearHistory();
    await dependencies.session.start(dependencies.detectionRange.value);
  }

  async function stop() {
    await dependencies.session.stop();
    dependencies.stopReferenceTone();
  }

  async function toggle() {
    const status = dependencies.session.status.value;
    if (status === 'stopping') return;
    if (status === 'starting' || status === 'listening') {
      await stop();
      return;
    }
    await start();
  }

  return {
    clearError: dependencies.session.clearError,
    setAudioBackend: dependencies.session.setAudioBackend,
    start,
    stop,
    toggle,
  };
}
