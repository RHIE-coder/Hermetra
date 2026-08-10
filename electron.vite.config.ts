import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import react from '@vitejs/plugin-react';

const r = (p: string) => path.resolve(path.dirname(fileURLToPath(import.meta.url)), p);

/**
 * The fetch sidecar's launcher is **not** part of the main bundle: it runs under
 * a real Node runtime, not Electron (`src/main/sidecar/launcher.mjs` says why).
 * Rollup therefore never sees it, and without this it is simply missing from a
 * built app — where the sidecar would report "launcher not found" forever.
 */
const copySidecarLauncher = () => ({
  name: 'hermetra:copy-sidecar-launcher',
  closeBundle() {
    const from = r('src/main/sidecar/launcher.mjs');
    const to = r('out/main/launcher.mjs');
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  },
});

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), copySidecarLauncher()],
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
