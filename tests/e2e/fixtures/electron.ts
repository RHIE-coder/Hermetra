import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';

export interface LaunchedApp {
  app: ElectronApplication;
  window: Page;
  userDataDir: string;
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MAIN_ENTRY = path.resolve(HERE, '..', '..', '..', 'out', 'main', 'index.js');

export async function launchHermetra(): Promise<LaunchedApp> {
  if (!fs.existsSync(MAIN_ENTRY)) {
    throw new Error(
      `Hermetra main entry not built at ${MAIN_ENTRY}. ` +
        `globalSetup should have run \`npm run build\` already.`,
    );
  }

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetra-e2e-'));

  const app = await electron.launch({
    args: [MAIN_ENTRY, `--user-data-dir=${userDataDir}`],
    env: {
      ...process.env,
      HERMETRA_DRIVERS: 'mock',
      NODE_ENV: 'test',
    },
  });

  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  return { app, window, userDataDir };
}

export async function closeHermetra(launched: LaunchedApp): Promise<void> {
  try {
    await launched.app.close();
  } catch {
    // ignore — the app may have crashed; we still want to clean up tmp
  }
  fs.rmSync(launched.userDataDir, { recursive: true, force: true });
}
