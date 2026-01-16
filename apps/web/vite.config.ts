import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@gns/api-core': path.resolve(__dirname, '../../packages/api-core/src/index.ts'),
            '@gns/api-web': path.resolve(__dirname, '../../packages/api-web/src/index.ts'),
            '@gns/ui': path.resolve(__dirname, '../../packages/ui/src/index.ts'),
            'libsodium-wrappers': require.resolve('libsodium-wrappers'),
        },
    },
    build: {
        outDir: 'build',
        target: 'esnext',
        commonjsOptions: {
            transformMixedEsModules: true,
        },
    },
    esbuild: {
        target: 'esnext',
        supported: {
            'top-level-await': true
        },
    },
    server: {
        port: 5173,
        fs: {
            allow: ['..', '../../../tauri-plugin-gns']
        }
    }
});
