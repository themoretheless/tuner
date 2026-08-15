import {
  normalizeDisplayMode,
  normalizeLayoutMode,
  normalizeThemeMode,
} from '../../settings/normalizeSettings';
import type { FullscreenPort } from '../../ports/fullscreen';
import type { DisplayMode, LayoutMode, ThemeMode } from '../../utils/settingsStorage';
import type { WritableValue } from '../ports/value';

export interface DisplayControllerDependencies {
  displayMode: WritableValue<DisplayMode>;
  fullscreen: FullscreenPort;
  layoutMode: WritableValue<LayoutMode>;
  leftHanded: WritableValue<boolean>;
  themeMode: WritableValue<ThemeMode>;
}

export function createDisplayController(dependencies: DisplayControllerDependencies) {
  return {
    setDisplayMode(value: unknown) {
      assignValid(dependencies.displayMode, value, normalizeDisplayMode);
    },
    setLayoutMode(value: unknown) {
      assignValid(dependencies.layoutMode, value, normalizeLayoutMode);
    },
    setLeftHanded(value: boolean) {
      dependencies.leftHanded.value = Boolean(value);
    },
    setThemeMode(value: unknown) {
      assignValid(dependencies.themeMode, value, normalizeThemeMode);
    },
    toggleFullscreen: dependencies.fullscreen.toggle,
  };
}

// A command carrying an unrecognized value is a caller bug, not a request to
// switch to the default: silently coercing it would flip the user's current
// theme or layout to something they never asked for.
function assignValid<Value>(
  target: WritableValue<Value>,
  value: unknown,
  normalize: (input: unknown) => Value,
) {
  const normalized = normalize(value);
  if (normalized !== value) return;
  target.value = normalized;
}
