import type { Ref } from 'vue';
import type { DisplayMode, LayoutMode, ThemeMode } from '../../../utils/settingsStorage';

export interface DisplayCapability {
  displayMode: Ref<DisplayMode>;
  layoutMode: Ref<LayoutMode>;
  leftHanded: Ref<boolean>;
  setDisplayMode(value: unknown): void;
  setLayoutMode(value: unknown): void;
  setLeftHanded(value: boolean): void;
  setThemeMode(value: unknown): void;
  themeMode: Ref<ThemeMode>;
  toggleFullscreen(): Promise<void>;
}
