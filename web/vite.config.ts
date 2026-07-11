import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import ver from '../version.json'

// https://vite.dev/config/
export default defineConfig({
  base: '/tuner/',
  plugins: [vue(), offlineServiceWorker(ver.version)],
  define: { __PKG_VERSION__: JSON.stringify(ver.version) },

  // Tauri expects a fixed port in development
  server: {
    port: 5173,
    strictPort: true,
    // Allow Tauri to access the dev server
    host: '0.0.0.0',
    fs: {
      allow: [fileURLToPath(new URL('..', import.meta.url))],
    },
  },

  // When building for Tauri, make sure assets work
  build: {
    target: 'esnext',
    // Tauri supports es2021
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    // produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_DEBUG,
  },

  // Support for WASM files
  optimizeDeps: {
    exclude: [],
  },
})

function offlineServiceWorker(version: string): Plugin {
  let base = '/'

  return {
    name: 'offline-service-worker',
    apply: 'build',
    configResolved(config) {
      base = config.base
    },
    generateBundle(_options, bundle) {
      if (base === './' || base === '') return

      const bundleFiles = Object.keys(bundle)
        .filter((file) => !file.endsWith('.map') && file !== 'sw.js')
        .sort()
      const signature = bundleFiles.reduce((hash, file) => {
        for (let index = 0; index < file.length; index += 1) {
          hash = ((hash << 5) - hash + file.charCodeAt(index)) | 0
        }
        return hash
      }, 0)
      const publicFiles = [
        'manifest.webmanifest',
        'favicon.svg',
        'icons.svg',
        'wasm/pitch_core.js',
        'wasm/pitch_core_bg.wasm',
      ]
      const precache = [base, ...bundleFiles.map((file) => `${base}${file}`), ...publicFiles.map((file) => `${base}${file}`)]
      const source = createServiceWorkerSource(
        `tuner-${version}-${Math.abs(signature).toString(36)}`,
        base,
        precache,
      )

      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

function createServiceWorkerSource(cacheName: string, appShell: string, precache: string[]) {
  return `const CACHE_NAME = ${JSON.stringify(cacheName)};
const APP_SHELL = ${JSON.stringify(appShell)};
const PRECACHE = ${JSON.stringify(precache)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('tuner-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(APP_SHELL, response.clone()));
          return response;
        })
        .catch(() => caches.match(APP_SHELL)),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
      return response;
    })),
  );
});
`
}
