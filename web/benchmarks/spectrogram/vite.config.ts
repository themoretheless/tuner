import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: '/',
  define: { __SPECTROGRAM_BENCHMARK_BUILD__: JSON.stringify('spectrogram-production-v1') },
  root: resolve(import.meta.dirname, '../..'),
  build: {
    emptyOutDir: true,
    outDir: resolve(import.meta.dirname, '../../benchmark-results/spectrogram-bundle'),
    rollupOptions: {
      input: resolve(import.meta.dirname, 'fixture.html'),
    },
    target: 'esnext',
  },
});
