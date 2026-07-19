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
      dependencies.displayMode.value = normalizeDisplayMode(value);
    },
    setLayoutMode(value: unknown) {
      dependencies.layoutMode.value = normalizeLayoutMode(value);
    },
    setLeftHanded(value: boolean) {
      dependencies.leftHanded.value = Boolean(value);
    },
    setThemeMode(value: unknown) {
      dependencies.themeMode.value = normalizeThemeMode(value);
    },
    toggleFullscreen: dependencies.fullscreen.toggle,
  };
}
