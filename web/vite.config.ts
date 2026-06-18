import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import ver from '../version.json'

// https://vite.dev/config/
export default defineConfig({
  base: '/Tuner/',
  plugins: [vue()],
  define: { __PKG_VERSION__: JSON.stringify(ver.version) },

  // Tauri expects a fixed port in development
  server: {
    port: 5173,
    strictPort: true,
    // Allow Tauri to access the dev server
    host: '0.0.0.0',
  },

  // When building for Tauri, make sure assets work
  build: {
    target: 'esnext',
    // Tauri supports es2021
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    // produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_DEBUG,
  },
})
