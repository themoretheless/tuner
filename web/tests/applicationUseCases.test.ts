import { describe, expect, it, vi } from 'vitest';
import { createDisplayController } from '../src/application/controllers/displayController';
import { createListeningController } from '../src/application/controllers/listeningController';
import { createProfileController } from '../src/application/controllers/profileController';
import { createDefaultSettings } from '../src/settings/normalizeSettings';
import { encodeUserProfile } from '../src/settings/profileCodec';
import type { SessionStatus } from '../src/session/sessionLifecycle';
import type { DisplayMode, LayoutMode, ThemeMode } from '../src/utils/settingsStorage';

describe('framework-independent application use cases', () => {
  it('coordinates listening through capabilities and plain value cells', async () => {
    const clearHistory = vi.fn();
    const stopReferenceTone = vi.fn();
    const session = {
      clearError: vi.fn(),
      setAudioBackend: vi.fn(async () => {}),
      start: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
    };
    const controller = createListeningController({
      clearHistory,
      detectionRange: cell({ minFrequency: 60, maxFrequency: 120 }),
      session,
      stopReferenceTone,
    });

    await controller.start();
    expect(clearHistory).toHaveBeenCalledOnce();
    expect(session.start).toHaveBeenCalledWith({ minFrequency: 60, maxFrequency: 120 });

    await controller.stop();
    expect(session.stop).toHaveBeenCalledOnce();
    expect(stopReferenceTone).toHaveBeenCalledOnce();
  });

  it('ignores unrecognized display commands instead of resetting the user to defaults', async () => {
    const toggle = vi.fn(async () => {});
    const displayMode = cell<DisplayMode>('needle');
    const layoutMode = cell<LayoutMode>('stage');
    const themeMode = cell<ThemeMode>('light');
    const controller = createDisplayController({
      displayMode,
      fullscreen: { toggle },
      layoutMode,
      leftHanded: cell(false),
      themeMode,
    });

    controller.setDisplayMode('invalid');
    controller.setLayoutMode('invalid');
    controller.setThemeMode('invalid');
    await controller.toggleFullscreen();

    expect(displayMode.value).toBe('needle');
    expect(layoutMode.value).toBe('stage');
    expect(themeMode.value).toBe('light');
    expect(toggle).toHaveBeenCalledOnce();

    controller.setDisplayMode('strobe');
    controller.setLayoutMode('compact');
    controller.setThemeMode('colorblind');

    expect(displayMode.value).toBe('strobe');
    expect(layoutMode.value).toBe('compact');
    expect(themeMode.value).toBe('colorblind');
  });

  it('validates profile import before interrupting the active session', async () => {
    const status = cell<SessionStatus>('listening');
    const stop = vi.fn(async () => { status.value = 'idle'; });
    const start = vi.fn(async () => { status.value = 'listening'; });
    const importProfile = vi.fn(async () => true);
    const controller = createProfileController({
      exportProfile: () => 'profile',
      importProfile,
      sessionStatus: status,
      start,
      stop,
      stopReferenceTone: vi.fn(),
    });

    expect(await controller.importProfile('{bad json')).toBe(false);
    expect(stop).not.toHaveBeenCalled();

    const payload = encodeUserProfile(createDefaultSettings());
    expect(await controller.importProfile(payload)).toBe(true);
    expect(stop).toHaveBeenCalledOnce();
    expect(importProfile).toHaveBeenCalledWith(payload);
    expect(start).toHaveBeenCalledOnce();
  });
});

function cell<T>(value: T) {
  return { value };
}
