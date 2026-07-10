import type { PersistedSettings } from '../utils/settingsStorage';

export const PROFILE_SCHEMA_VERSION = 1;

export interface UserProfileV1 {
  exportedAt?: string;
  schemaVersion: typeof PROFILE_SCHEMA_VERSION;
  settings: Partial<PersistedSettings>;
}

export function createUserProfile(
  settings: PersistedSettings,
  includeExportTimestamp = false,
): UserProfileV1 {
  return {
    ...(includeExportTimestamp ? { exportedAt: new Date().toISOString() } : {}),
    schemaVersion: PROFILE_SCHEMA_VERSION,
    settings,
  };
}

export function encodeUserProfile(settings: PersistedSettings) {
  return JSON.stringify(createUserProfile(settings, true), null, 2);
}

export function decodeUserProfile(value: unknown): UserProfileV1 | null {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const candidate = parsed as Partial<UserProfileV1>;
  if (candidate.schemaVersion !== PROFILE_SCHEMA_VERSION) return null;
  if (!candidate.settings || typeof candidate.settings !== 'object') return null;
  return candidate as UserProfileV1;
}
