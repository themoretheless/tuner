import { describe, expect, it } from 'vitest';

import { shouldRegisterServiceWorker } from '../src/platform/serviceWorker';

describe('service worker registration guard', () => {
  const supportedNavigator = { serviceWorker: {} as ServiceWorkerContainer };

  it('does not register for desktop custom protocols', () => {
    expect(shouldRegisterServiceWorker('tauri:', supportedNavigator)).toBe(false);
    expect(shouldRegisterServiceWorker('file:', supportedNavigator)).toBe(false);
  });

  it('does not register in the test development environment', () => {
    expect(shouldRegisterServiceWorker('https:', supportedNavigator)).toBe(false);
  });
});
