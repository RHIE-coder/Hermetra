import fs from 'node:fs';
import path from 'node:path';
import type { ScriptFile, ScriptFileBody } from '@shared/types/web';
import { workspaceManager } from './workspaceManager';

type Slot = 'web' | 'mobile';

const SEED_WEB = `// Web automation script.
//   page: the active Playwright page
//   env:  process env variables
//   bus:  shared variable bus
//   log:  append to the run output
//
// example:
//   await page.goto(env.BASE_URL ?? 'https://example.com');
//   log('title:', await page.title());
//   bus.set('page.title', await page.title());

await page.goto('https://example.com');
log('title:', await page.title());
`;

const SEED_MOBILE = `// Mobile automation script (WebdriverIO + Appium).
//   driver: WebdriverIO browser instance
//   env:    process env variables
//   bus:    shared variable bus
//   log:    append to the run output
//
// example:
//   const el = await driver.$('~login');
//   await el.click();
//   bus.set('mobile.loginClicked', '1');

const el = await driver.$('~login');
await el.click();
log('login tapped');
`;

function dir(slot: Slot): string {
  const d = path.join(workspaceManager().activeDir(), 'scripts', slot);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function safePath(slot: Slot, p: string): string {
  const cleaned = p.replace(/\\/g, '/').replace(/^\/+/, '');
  const full = path.normalize(path.join(dir(slot), cleaned));
  if (!full.startsWith(dir(slot))) throw new Error('Invalid path');
  return full;
}

function seedIfEmpty() {
  const webDir = dir('web');
  const mobileDir = dir('mobile');
  if (fs.readdirSync(webDir).length === 0) {
    fs.writeFileSync(path.join(webDir, 'login.ts'), SEED_WEB, 'utf-8');
  }
  if (fs.readdirSync(mobileDir).length === 0) {
    fs.writeFileSync(path.join(mobileDir, 'verify-otp.ts'), SEED_MOBILE, 'utf-8');
  }
}

export const scriptsService = {
  get() {
    return scriptsService;
  },
  list(slot: Slot): ScriptFile[] {
    seedIfEmpty();
    const d = dir(slot);
    return fs
      .readdirSync(d)
      .filter((f) => /\.(ts|js|tsx|jsx)$/i.test(f))
      .sort()
      .map((f) => ({ path: f, name: f }));
  },
  read(slot: Slot, p: string): ScriptFileBody {
    const file = safePath(slot, p);
    if (!fs.existsSync(file)) return { path: p, source: '' };
    return { path: p, source: fs.readFileSync(file, 'utf-8') };
  },
  save(slot: Slot, body: ScriptFileBody): ScriptFile[] {
    const file = safePath(slot, body.path);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body.source, 'utf-8');
    return scriptsService.list(slot);
  },
  remove(slot: Slot, p: string): ScriptFile[] {
    const file = safePath(slot, p);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return scriptsService.list(slot);
  },
};
