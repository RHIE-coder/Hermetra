import fs from 'node:fs';
import path from 'node:path';
import type { ScriptFile, ScriptFileBody, ScriptMoveRequest } from '@shared/types/web';
import { workspaceManager } from './workspaceManager';

type Slot = 'web' | 'mobile' | 'studio';

const SCRIPT_EXT = /\.(ts|js|tsx|jsx)$/i;

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

/**
 * The studio slot stores **functions**, not snippets.
 *
 * A stage references a script by the function it exports — `extract` for
 * ingestion, `transform` for processing — so a file of top-level statements has
 * nothing a stage can point at. Reuse is then plain `import`: shared logins and
 * paging live in their own files and are called from wherever, rather than
 * being copied into a per-stage folder.
 *
 * Do not write a literal `import … from '…'` statement inside these seeds.
 * electron-vite's CommonJS shim scans the emitted chunk for import statements
 * and inserts its `__dirname` declaration after the last one it finds — a line
 * that merely looks like one, inside a template literal, sends that declaration
 * into the string and leaves the real `__dirname` undefined. The main process
 * then dies on boot with no window.
 */
const SEED_STUDIO = `// Stage script. Stages reference the functions this exports.
//   extract(page, ctx)  → ingestion. Returns raw rows, unchanged.
//   transform(raw)      → processing. Reshapes them for storage.
//
// Reuse needs nothing new: put a shared step in its own file under lib/ and
// pull it in with an ordinary ES module import.

export async function extract(page, ctx) {
  await page.goto(ctx.url ?? 'https://example.com');
  return page.$$eval('h1', (els) => els.map((el) => ({ title: el.textContent })));
}

export function transform(raw) {
  return raw.map((row) => ({ ...row, title: row.title?.trim() }));
}
`;

/**
 * The studio slot was called `pipeline` until 2026-08-12, when the browser
 * workbench moved out of the Data Pipeline service (`docs/spec/studio/`).
 *
 * A slot is a directory holding files a person wrote, so renaming it in the code
 * alone would not rename anything — it would hide their scripts behind a name
 * nothing reads, and `seedIfEmpty` would then drop a starter file into the empty
 * new folder. That reads as "my scripts are gone".
 *
 * Both folders existing means a half-finished move, or an older build writing
 * again after a newer one migrated. The new one is live and the old one is left
 * alone — merging two folders would have to guess which side of a name clash to
 * keep, and guessing wrong overwrites work.
 */
function migrateLegacySlot(root: string, slot: Slot): void {
  if (slot !== 'studio') return;
  const legacy = path.join(root, 'pipeline');
  const current = path.join(root, slot);
  if (!fs.existsSync(legacy) || fs.existsSync(current)) return;
  fs.renameSync(legacy, current);
}

function dir(slot: Slot): string {
  const root = path.join(workspaceManager().activeDir(), 'scripts');
  // Before the mkdir below: creating the new folder first would make the move
  // look like the both-folders-exist case and strand the old one forever.
  fs.mkdirSync(root, { recursive: true });
  migrateLegacySlot(root, slot);

  const d = path.join(root, slot);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function safePath(slot: Slot, p: string): string {
  const root = dir(slot);
  const cleaned = p.replace(/\\/g, '/').replace(/^\/+/, '');
  const full = path.normalize(path.join(root, cleaned));
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (full !== root && !full.startsWith(rootWithSep)) throw new Error('Invalid path');
  return full;
}

function seedIfEmpty() {
  const seeds: [Slot, string, string][] = [
    ['web', 'login.ts', SEED_WEB],
    ['mobile', 'verify-otp.ts', SEED_MOBILE],
    ['studio', 'example.ts', SEED_STUDIO],
  ];
  for (const [slot, name, source] of seeds) {
    const root = dir(slot);
    if (fs.readdirSync(root).length === 0) {
      fs.writeFileSync(path.join(root, name), source, 'utf-8');
    }
  }
}

function walk(root: string, current: string, out: ScriptFile[]) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const abs = path.join(current, entry.name);
    const rel = path.relative(root, abs).split(path.sep).join('/');
    if (entry.isDirectory()) {
      out.push({ path: rel, name: entry.name, type: 'folder' });
      walk(root, abs, out);
    } else if (entry.isFile() && SCRIPT_EXT.test(entry.name)) {
      out.push({ path: rel, name: entry.name, type: 'file' });
    }
  }
}

export const scriptsService = {
  get() {
    return scriptsService;
  },
  list(slot: Slot): ScriptFile[] {
    seedIfEmpty();
    const root = dir(slot);
    const out: ScriptFile[] = [];
    walk(root, root, out);
    return out.sort((a, b) => {
      // Folders first within the same parent, then alphabetical by path.
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.path.localeCompare(b.path);
    });
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
  mkdir(slot: Slot, p: string): ScriptFile[] {
    const folder = safePath(slot, p);
    fs.mkdirSync(folder, { recursive: true });
    return scriptsService.list(slot);
  },
  remove(slot: Slot, p: string): ScriptFile[] {
    const target = safePath(slot, p);
    if (fs.existsSync(target)) {
      const stat = fs.statSync(target);
      if (stat.isDirectory()) {
        fs.rmSync(target, { recursive: true, force: true });
      } else {
        fs.unlinkSync(target);
      }
    }
    return scriptsService.list(slot);
  },
  /**
   * Atomic batch move of files and folders inside one workspace slot.
   *
   * Two-phase: dry-run validates every move (path-escape, self/descendant,
   * destination conflicts); only when the entire batch is valid do we apply
   * the renames. Identity moves (`from === to`) are silently skipped so the
   * UI can fire them without special-casing. Conflicts are surfaced both via
   * a recognizable error message and a `conflicts: string[]` field attached
   * to the thrown error so the renderer can list them.
   */
  move(slot: Slot, moves: ScriptMoveRequest[]): ScriptFile[] {
    // Phase 1 — resolve + classify every requested move.
    interface Resolved {
      from: string;
      to: string;
      fromAbs: string;
      toAbs: string;
    }
    const resolved: Resolved[] = [];
    for (const m of moves) {
      // safePath throws "Invalid path" on traversal — propagate as-is.
      const fromAbs = safePath(slot, m.from);
      const toAbs = safePath(slot, m.to);
      if (fromAbs === toAbs) continue; // identity no-op
      resolved.push({ from: m.from, to: m.to, fromAbs, toAbs });
    }

    // Phase 2 — self / descendant guard. Reject moving a folder into itself
    // or any of its own descendants (covers both the strict descendant case
    // and the "drop folder onto its own path with new child" case).
    for (const r of resolved) {
      if (fs.existsSync(r.fromAbs) && fs.statSync(r.fromAbs).isDirectory()) {
        const fromWithSep = r.fromAbs.endsWith(path.sep) ? r.fromAbs : r.fromAbs + path.sep;
        if (r.toAbs === r.fromAbs || r.toAbs.startsWith(fromWithSep)) {
          throw new Error(`Cannot move folder into itself or its descendants: ${r.from}`);
        }
      }
    }

    // Phase 3 — conflict dry-run. Collect every destination that already
    // exists so the UI can show the full list, not just the first.
    const conflicts: string[] = [];
    for (const r of resolved) {
      if (fs.existsSync(r.toAbs)) conflicts.push(r.to);
    }
    if (conflicts.length > 0) {
      const err = new Error(`Move conflict: ${conflicts.join(', ')} already exists`) as Error & {
        conflicts: string[];
      };
      err.conflicts = conflicts;
      throw err;
    }

    // Phase 4 — apply. Renames are same-fs and atomic; we make parents
    // first so deep destinations like "a/b/c.ts" work without prior mkdir.
    for (const r of resolved) {
      fs.mkdirSync(path.dirname(r.toAbs), { recursive: true });
      fs.renameSync(r.fromAbs, r.toAbs);
    }

    return scriptsService.list(slot);
  },
};
