import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * globalSetup — runs once before any e2e test. Ensures the Electron app
 * is built. We always rebuild to keep things deterministic; electron-vite's
 * cache makes incremental rebuilds fast.
 */
export default async function globalSetup(): Promise<void> {
  const root = path.resolve(HERE, '..', '..', '..');
  process.stdout.write('[e2e globalSetup] running `npm run build` ...\n');
  const r = spawnSync('npm', ['run', 'build'], {
    cwd: root,
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  if (r.status !== 0) {
    throw new Error(`globalSetup: npm run build exited ${r.status}`);
  }
  const mainEntry = path.join(root, 'out', 'main', 'index.js');
  if (!fs.existsSync(mainEntry)) {
    throw new Error(`globalSetup: build did not produce ${mainEntry}`);
  }
  process.stdout.write('[e2e globalSetup] build OK\n');
}
