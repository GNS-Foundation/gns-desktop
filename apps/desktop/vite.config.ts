import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@gns/api-tauri': path.resolve(__dirname, '../../packages/api-tauri/src/index.ts'),
      '@gns/api-core': path.resolve(__dirname, '../../packages/api-core/src/index.ts'),
      '@gns/ui': path.resolve(__dirname, '../../packages/ui/src/index.ts'),
    },
  },

  // Tauri expects a fixed port
  server: {
    port: 5173,
    strictPort: true,
    host: true,  // 👈 Expose on network for iOS device
  },

  // Prevent Vite from obscuring Rust errors
  clearScreen: false,

  // Tauri expects paths relative to the dist folder
  build: {
    outDir: 'dist',
    target: ['es2021', 'chrome100', 'safari13'],
    minify: !process.env.TAURI_DEBUG,
    sourcemap: !!process.env.TAURI_DEBUG,
  },

  // Environment variables
  envPrefix: ['VITE_', 'TAURI_'],
});
