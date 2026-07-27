export type VersionCheckStatus = 'update-available' | 'up-to-date' | 'unavailable';

export interface VersionCheckResult {
  status: VersionCheckStatus;
  currentVersion: string;
  remoteVersion: string | null;
}

export interface AppUpdateMonitorOptions {
  currentVersion: string;
  versionUrl: string;
  intervalMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
  onUpdateAvailable?: (remoteVersion: string) => void;
}

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000;

export function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, '');
}

export function isUpdateAvailable(currentVersion: string, remoteVersion: string): boolean {
  const current = normalizeVersion(currentVersion);
  const remote = normalizeVersion(remoteVersion);
  return current !== '' && remote !== '' && current !== remote;
}

export function buildVersionUrl(versionUrl: string, now: number): string {
  const separator = versionUrl.includes('?') ? '&' : '?';
  return `${versionUrl}${separator}t=${now}`;
}

export function parseVersionPayload(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const version = (payload as { version?: unknown }).version;
  return typeof version === 'string' && version.trim() !== '' ? version : null;
}

export async function fetchRemoteVersion(
  fetchImpl: typeof fetch,
  versionUrl: string,
  now: number,
): Promise<string | null> {
  try {
    const response = await fetchImpl(buildVersionUrl(versionUrl, now), { cache: 'no-store' });
    if (!response.ok) return null;
    return parseVersionPayload(await response.json());
  } catch {
    return null;
  }
}

export async function checkForUpdate(options: AppUpdateMonitorOptions): Promise<VersionCheckResult> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  const now = options.now ?? Date.now;
  const currentVersion = options.currentVersion;
  if (!fetchImpl) return { status: 'unavailable', currentVersion, remoteVersion: null };
  const remoteVersion = await fetchRemoteVersion(fetchImpl, options.versionUrl, now());
  if (remoteVersion === null) return { status: 'unavailable', currentVersion, remoteVersion: null };
  return {
    status: isUpdateAvailable(currentVersion, remoteVersion) ? 'update-available' : 'up-to-date',
    currentVersion,
    remoteVersion,
  };
}

export class AppUpdateMonitor {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly options: AppUpdateMonitorOptions;
  private readonly onVisible = () => { void this.checkNow(); };
  private readonly onFocus = () => { void this.checkNow(); };

  constructor(options: AppUpdateMonitorOptions) {
    this.options = options;
  }

  start() {
    if (this.timer !== null) return;
    const intervalMs = this.options.intervalMs ?? DEFAULT_INTERVAL_MS;
    this.timer = setInterval(() => { void this.checkNow(); }, intervalMs);
    document.addEventListener('visibilitychange', this.onVisible);
    window.addEventListener('focus', this.onFocus);
    void this.checkNow();
  }

  stop() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    document.removeEventListener('visibilitychange', this.onVisible);
    window.removeEventListener('focus', this.onFocus);
  }

  async checkNow(): Promise<VersionCheckResult> {
    const result = await checkForUpdate(this.options);
    if (result.status === 'update-available' && result.remoteVersion !== null) {
      this.options.onUpdateAvailable?.(result.remoteVersion);
    }
    return result;
  }
}

export interface ApplyUpdateOptions {
  reload: () => void;
  serviceWorker?: {
    addEventListener: (type: string, listener: () => void) => void;
    removeEventListener: (type: string, listener: () => void) => void;
  };
  fallbackTimeoutMs?: number;
  setTimeoutImpl?: (handler: () => void, ms: number) => unknown;
  clearTimeoutImpl?: (handle: unknown) => void;
}

// The generated service worker already uses skipWaiting() + clientsClaim(),
// so fetching the fresh sw.js is enough: once the new worker activates and
// claims the page, 'controllerchange' fires and we reload. A fallback timeout
// covers browsers where the controller swap never fires.
export function applyAppUpdate(options: ApplyUpdateOptions): () => void {
  const setTimeoutImpl = options.setTimeoutImpl ?? ((handler: () => void, ms: number) => setTimeout(handler, ms));
  const clearTimeoutImpl = options.clearTimeoutImpl ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  let reloaded = false;
  const reloadOnce = () => {
    if (reloaded) return;
    reloaded = true;
    clearTimeoutImpl(fallback);
    options.serviceWorker?.removeEventListener('controllerchange', onControllerChange);
    options.reload();
  };
  const onControllerChange = () => reloadOnce();
  options.serviceWorker?.addEventListener('controllerchange', onControllerChange);
  const fallback = setTimeoutImpl(reloadOnce, options.fallbackTimeoutMs ?? 4000);
  return reloadOnce;
}
