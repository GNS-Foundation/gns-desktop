import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Hardcoded path based on pnpm structure found
const libsodiumPath = path.resolve(__dirname, '../../node_modules/.pnpm/libsodium-wrappers-sumo@0.8.1/node_modules/libsodium-wrappers-sumo/dist/modules-sumo-esm/libsodium-wrappers.mjs');

export default defineConfig({
    plugins: [react()],
    clearScreen: false,
    server: {
        port: 1421,
        strictPort: true,
    },
    envPrefix: ['VITE_', 'TAURI_'],
    resolve: {
        alias: {
            'libsodium-wrappers': libsodiumPath,
            'libsodium-wrappers-sumo': libsodiumPath,
        },
    },
    build: {
        target: ['es2021', 'chrome100', 'safari13'],
        minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
        sourcemap: !!process.env.TAURI_DEBUG,
    },
});
