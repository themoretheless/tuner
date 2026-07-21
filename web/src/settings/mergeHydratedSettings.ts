import type { PersistedSettings } from '../utils/settingsStorage';

export function mergeHydratedSettings(
  loaded: Partial<PersistedSettings>,
  baseline: PersistedSettings,
  current: PersistedSettings,
): Partial<PersistedSettings> {
  const merged = { ...loaded } as Partial<PersistedSettings>;
  for (const key of Object.keys(current) as Array<keyof PersistedSettings>) {
    if (!settingsValueEqual(current[key], baseline[key])) {
      Object.assign(merged, { [key]: current[key] });
    }
  }
  return merged;
}

export function settingsChanged(left: PersistedSettings, right: PersistedSettings) {
  return (Object.keys(left) as Array<keyof PersistedSettings>)
    .some((key) => !settingsValueEqual(left[key], right[key]));
}

function settingsValueEqual(left: unknown, right: unknown) {
  if (Object.is(left, right)) return true;
  return JSON.stringify(left) === JSON.stringify(right);
}
