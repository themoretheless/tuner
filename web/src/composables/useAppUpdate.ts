import { onMounted, onUnmounted, ref } from 'vue';

import { AppUpdateMonitor, applyAppUpdate } from '../platform/appUpdate';
import { shouldRegisterServiceWorker } from '../platform/serviceWorker';

export function useAppUpdate() {
  const updateAvailable = ref(false);
  const remoteVersion = ref<string | null>(null);
  const dismissed = ref(false);
  let monitor: AppUpdateMonitor | null = null;

  const applyUpdate = () => {
    applyAppUpdate({
      reload: () => window.location.reload(),
      serviceWorker: navigator.serviceWorker,
    });
  };

  const dismiss = () => {
    dismissed.value = true;
  };

  onMounted(() => {
    if (!shouldRegisterServiceWorker(location.protocol, navigator)) return;
    monitor = new AppUpdateMonitor({
      currentVersion: __PKG_VERSION__,
      versionUrl: new URL('version.json', document.baseURI).toString(),
      onUpdateAvailable: (version) => {
        remoteVersion.value = version;
        updateAvailable.value = true;
        dismissed.value = false;
      },
    });
    monitor.start();
  });

  onUnmounted(() => {
    monitor?.stop();
    monitor = null;
  });

  return { updateAvailable, remoteVersion, dismissed, applyUpdate, dismiss };
}
