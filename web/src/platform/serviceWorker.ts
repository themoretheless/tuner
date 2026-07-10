export function registerServiceWorker() {
  if (!shouldRegisterServiceWorker(location.protocol, navigator)) return;

  const register = () => {
    const url = new URL('sw.js', document.baseURI);
    void navigator.serviceWorker.register(url, { scope: './' }).catch((error: unknown) => {
      if (import.meta.env.DEV) console.warn('Service worker registration failed', error);
    });
  };

  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

export function shouldRegisterServiceWorker(
  protocol: string,
  browserNavigator: Pick<Navigator, 'serviceWorker'>,
) {
  return import.meta.env.PROD
    && (protocol === 'http:' || protocol === 'https:')
    && 'serviceWorker' in browserNavigator;
}
