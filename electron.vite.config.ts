import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import react from '@vitejs/plugin-react';

const r = (p: string) => path.resolve(path.dirname(fileURLToPath(import.meta.url)), p);

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/main',
      lib: { entry: 'src/main/index.ts' },
      rollupOptions: {
        external: ['playwright', 'webdriverio', 'electron'],
      },
    },
    resolve: {
      alias: {
        '@shared': r('src/shared'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload',
      lib: { entry: 'src/preload/index.ts' },
    },
    resolve: {
      alias: {
        '@shared': r('src/shared'),
      },
    },
  },
  renderer: {
    root: r('.'),
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: r('index.html'),
      },
    },
    resolve: {
      alias: {
        '@': r('src/renderer'),
        '@shared': r('src/shared'),
      },
    },
    plugins: [react()],
  },
});
