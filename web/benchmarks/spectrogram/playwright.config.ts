import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'spectrogram-ab.spec.ts',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  outputDir: '../../benchmark-results/spectrogram-playwright',
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'off',
  },
  webServer: {
    command: 'npx vite preview --config vite.config.ts --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174/benchmarks/spectrogram/fixture.html',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
