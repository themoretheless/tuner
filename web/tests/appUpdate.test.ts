import { describe, expect, it, vi } from 'vitest';

import {
  AppUpdateMonitor,
  applyAppUpdate,
  buildVersionUrl,
  checkForUpdate,
  fetchRemoteVersion,
  isUpdateAvailable,
  normalizeVersion,
  parseVersionPayload,
} from '../src/platform/appUpdate';

function jsonResponse(payload: unknown, ok = true): Response {
  return { ok, json: () => Promise.resolve(payload) } as Response;
}

describe('version comparison', () => {
  it('detects a differing remote version as an update', () => {
    expect(isUpdateAvailable('0.1.13', '0.1.14')).toBe(true);
    expect(isUpdateAvailable('0.1.13', '0.2.0')).toBe(true);
  });

  it('treats identical versions as up to date', () => {
    expect(isUpdateAvailable('0.1.13', '0.1.13')).toBe(false);
  });

  it('normalizes whitespace and leading v prefix', () => {
    expect(normalizeVersion('  v0.1.13\n')).toBe('0.1.13');
    expect(isUpdateAvailable('0.1.13', 'v0.1.13')).toBe(false);
  });

  it('rejects empty versions', () => {
    expect(isUpdateAvailable('', '0.1.14')).toBe(false);
    expect(isUpdateAvailable('0.1.13', '')).toBe(false);
  });
});

describe('buildVersionUrl', () => {
  it('appends a cache-busting timestamp', () => {
    expect(buildVersionUrl('/tuner/version.json', 123)).toBe('/tuner/version.json?t=123');
  });

  it('uses & when the url already has a query', () => {
    expect(buildVersionUrl('/version.json?x=1', 5)).toBe('/version.json?x=1&t=5');
  });
});

describe('parseVersionPayload', () => {
  it('reads the version field', () => {
    expect(parseVersionPayload({ version: '0.1.14' })).toBe('0.1.14');
  });

  it('rejects malformed payloads', () => {
    expect(parseVersionPayload(null)).toBeNull();
    expect(parseVersionPayload({})).toBeNull();
    expect(parseVersionPayload({ version: 42 })).toBeNull();
    expect(parseVersionPayload('0.1.14')).toBeNull();
  });
});

describe('fetchRemoteVersion', () => {
  it('returns the remote version with no-store caching', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ version: '0.1.14' }));
    const version = await fetchRemoteVersion(fetchImpl as unknown as typeof fetch, '/tuner/version.json', 7);
    expect(version).toBe('0.1.14');
    expect(fetchImpl).toHaveBeenCalledWith('/tuner/version.json?t=7', { cache: 'no-store' });
  });

  it('returns null on http errors', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false));
    await expect(fetchRemoteVersion(fetchImpl as unknown as typeof fetch, '/v.json', 1)).resolves.toBeNull();
  });

  it('returns null on network failures', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(fetchRemoteVersion(fetchImpl as unknown as typeof fetch, '/v.json', 1)).resolves.toBeNull();
  });
});

describe('checkForUpdate', () => {
  it('reports update-available when versions differ', async () => {
    const result = await checkForUpdate({
      currentVersion: '0.1.13',
      versionUrl: '/tuner/version.json',
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse({ version: '0.1.14' })) as unknown as typeof fetch,
      now: () => 1,
    });
    expect(result).toEqual({ status: 'update-available', currentVersion: '0.1.13', remoteVersion: '0.1.14' });
  });

  it('reports up-to-date when versions match', async () => {
    const result = await checkForUpdate({
      currentVersion: '0.1.13',
      versionUrl: '/tuner/version.json',
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse({ version: '0.1.13' })) as unknown as typeof fetch,
      now: () => 1,
    });
    expect(result.status).toBe('up-to-date');
  });

  it('reports unavailable when fetch fails', async () => {
    const result = await checkForUpdate({
      currentVersion: '0.1.13',
      versionUrl: '/tuner/version.json',
      fetchImpl: vi.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch,
      now: () => 1,
    });
    expect(result).toEqual({ status: 'unavailable', currentVersion: '0.1.13', remoteVersion: null });
  });
});

describe('AppUpdateMonitor', () => {
  it('notifies only when an update is available', async () => {
    const onUpdateAvailable = vi.fn();
    const monitor = new AppUpdateMonitor({
      currentVersion: '0.1.13',
      versionUrl: '/tuner/version.json',
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse({ version: '0.1.14' })) as unknown as typeof fetch,
      now: () => 1,
      onUpdateAvailable,
    });
    const result = await monitor.checkNow();
    expect(result.status).toBe('update-available');
    expect(onUpdateAvailable).toHaveBeenCalledWith('0.1.14');
  });

  it('does not notify when up to date', async () => {
    const onUpdateAvailable = vi.fn();
    const monitor = new AppUpdateMonitor({
      currentVersion: '0.1.13',
      versionUrl: '/tuner/version.json',
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse({ version: '0.1.13' })) as unknown as typeof fetch,
      now: () => 1,
      onUpdateAvailable,
    });
    await monitor.checkNow();
    expect(onUpdateAvailable).not.toHaveBeenCalled();
  });
});

describe('applyAppUpdate', () => {
  it('reloads on controllerchange and only once', () => {
    const reload = vi.fn();
    const listeners = new Map<string, () => void>();
    const serviceWorker = {
      addEventListener: (type: string, listener: () => void) => listeners.set(type, listener),
      removeEventListener: (type: string) => listeners.delete(type),
    };
    const clearTimeoutImpl = vi.fn();
    applyAppUpdate({ reload, serviceWorker, setTimeoutImpl: () => 1, clearTimeoutImpl });
    listeners.get('controllerchange')?.();
    listeners.get('controllerchange')?.();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(clearTimeoutImpl).toHaveBeenCalled();
  });

  it('falls back to a timed reload without controllerchange', () => {
    const reload = vi.fn();
    let scheduled: (() => void) | undefined;
    applyAppUpdate({
      reload,
      serviceWorker: { addEventListener: () => {}, removeEventListener: () => {} },
      setTimeoutImpl: (handler) => { scheduled = handler; return 1; },
      clearTimeoutImpl: () => {},
    });
    expect(reload).not.toHaveBeenCalled();
    scheduled!();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
