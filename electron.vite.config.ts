import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import react from '@vitejs/plugin-react';

const r = (p: string) => path.resolve(path.dirname(fileURLToPath(import.meta.url)), p);

/**
 * The fetch sidecar is **not** part of the main bundle: it runs under a real
 * Node runtime, not Electron (`src/main/sidecar/host/launcher.ts` says why).
 * Rollup therefore never sees it, and without this it is simply missing from a
 * built app — where the sidecar would report "launcher not found" forever.
 *
 * Copied as **source**, extensions and all. The runtime it runs on strips the
 * types itself, which is the same mechanism a user's `.ts` script relies on;
 * compiling this half would mean two ways of loading TypeScript in one process.
 * `protocol.ts` rides along because both halves import it — bundled into main,
 * loaded as a file out here.
 */
const copySidecarHost = () => ({
  name: 'hermetra:copy-sidecar-host',
  closeBundle() {
    const host = r('src/main/sidecar/host');
    const out = r('out/main/host');
    fs.mkdirSync(out, { recursive: true });
    for (const file of fs.readdirSync(host)) {
      fs.copyFileSync(path.join(host, file), path.join(out, file));
    }
    fs.copyFileSync(r('src/main/sidecar/protocol.ts'), r('out/main/protocol.ts'));
  },
});

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), copySidecarHost()],
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
