import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  
  // Tauri expects a fixed port
  server: {
    port: 5173,
    strictPort: true,
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
