import { decodeUserProfile } from '../../settings/profileCodec';
import type { SessionStatus } from '../../session/sessionLifecycle';
import type { ReadableValue } from '../ports/value';

export interface ProfileControllerDependencies {
  exportProfile(): string;
  importProfile(payload: string): Promise<boolean>;
  sessionStatus: ReadableValue<SessionStatus>;
  start(): Promise<void>;
  stop(): Promise<void>;
  stopReferenceTone(): void;
}

export function createProfileController(dependencies: ProfileControllerDependencies) {
  async function importProfile(payload: string) {
    if (!decodeUserProfile(payload)) return false;
    const status = dependencies.sessionStatus.value;
    const shouldRestart = status === 'starting' || status === 'listening';
    if (status !== 'idle') await dependencies.stop();
    dependencies.stopReferenceTone();
    const imported = await dependencies.importProfile(payload);
    if (shouldRestart) await dependencies.start();
    return imported;
  }

  return {
    exportProfile: dependencies.exportProfile,
    importProfile,
  };
}
