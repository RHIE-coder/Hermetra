import fs from 'node:fs';
import path from 'node:path';
import type { ScriptFile, ScriptFileBody, ScriptMoveRequest } from '@shared/types/web';
import { STUDIO_AMBIENT_DTS } from '@shared/studio/ambient';
import { workspaceManager } from './workspaceManager';

type Slot = 'web' | 'mobile' | 'studio';

/**
 * What the tree shows. Wider than "what runs" on purpose: `GUIDE.md` is seeded
 * into this folder, and a guide nobody can open is not a guide. The editor
 * already highlights markdown; only this filter was hiding it. The Run button
 * is what draws the line between openable and runnable — see `RUNNABLE_EXT` in
 * the editor.
 */
const LISTED_EXT = /\.(ts|js|tsx|jsx|md)$/i;

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
 * The studio seed is a **script**, not a contract.
 *
 * It runs top to bottom, the way the Playwright documentation writes one, and
 * everything it uses is either the language or the library. Nothing on the page
 * is this app's invention — the runner imports the file with a real Node
 * runtime, so TypeScript, `import` and installed packages are simply available.
 *
 * A stage script (`export extract` / `export transform`) still runs, and the
 * ingestion and processing screens will reference scripts that way. But leading
 * with that shape made a workbench for trying things look like a framework to
 * fill in, which is the opposite of what this screen is.
 *
 * **It imports, and the file it imports is seeded with it.** Saying "imports of
 * your other scripts work" in a comment leaves the two things that actually bite
 * to be guessed — which folder, and that `.ts` is not optional — and both are
 * invisible until a run fails. A line that runs answers them without being read
 * as instructions. Anything named here has to be exported over in SEED_STUDIO_LIB
 * (`tests/api/scripts.test.ts` reads the import clause and checks).
 */
const SEED_STUDIO = `// Browser workbench. This file is a script: it runs top to bottom, as written,
// in a real Node runtime. TypeScript, imports of your other scripts, and any
// package you install under scripts/ (npm i cheerio) all work.
//
// Already in scope: page (the active tab) · context · browser · ctx.url (the
// address bar) · env. console.log lands in the panel below, as it happens.
// GUIDE.md, next to this file, has the rest — including why the browser being
// Firefox matters when you read the Playwright docs.

// ── Using one of your own files ─────────────────────────────────────────────
// \`clean\` and \`Row\` are not this app's. They are in lib/rows.ts, one folder
// down; open it, it is an ordinary module. The '.ts' is not optional — Node
// loads these as ES modules, and an ES module asks for a file by its real name.
// An installed package is a bare name instead: import { load } from 'cheerio';
import { clean, type Row } from './lib/rows.ts';

await page.goto(ctx.url ?? 'https://example.com');
console.log('title:', await page.title());

/** Everything matching \`selector\`, as rows of text. */
const rowsOf = (selector: string): Promise<Row[]> =>
  page.$$eval(selector, (els: Element[]) => els.map((el) => ({ text: el.textContent ?? '' })));

const raw: Row[] = await rowsOf('h1, p, a');

// Both, so you can see what the imported function actually did: wrapped text
// collapsed onto one line, blanks dropped, repeats dropped.
console.log('raw    ', raw);
console.log('cleaned', clean(raw));
`;

/**
 * The other side of the seed's import.
 *
 * It has to be worth importing. The first version trimmed one string, which
 * anybody would write inline — so the example demonstrated the mechanics of
 * `import` and nothing about why a `lib/` folder exists. This one has enough
 * logic that repeating it in every script would be the annoyance the folder
 * exists to remove.
 *
 * Its API is a break from the one shipped before 2026-08-14 (`clean(row)` took a
 * single row). That is why the pair is replaced together — see
 * `replaceUntouchedSeed`.
 */
const SEED_STUDIO_LIB = `// Your own module — nothing here is this app's invention. Whatever you would
// rather not write twice goes in a file like this, and your scripts import it.

export interface Row {
  text: string;
}

/**
 * Text pulled off a page comes wrapped across lines, padded, and repeated.
 * Doing this once inline is fine. Doing it in every script is the reason this
 * file exists.
 */
export function clean(rows: Row[]): Row[] {
  const seen = new Set<string>();
  const out: Row[] = [];
  for (const row of rows) {
    const text = row.text.replace(/\\s+/g, ' ').trim();
    if (text === '' || seen.has(text)) continue;
    seen.add(text);
    out.push({ ...row, text });
  }
  return out;
}
`;

/**
 * Every `lib/rows.ts` this app has written.
 *
 * Same rule as the seed: a copy still byte-for-byte one of ours is ours to
 * replace, and one changed line makes it theirs. Not a template — a record.
 */
const PAST_STUDIO_LIBS = [
  // Shipped alongside the stage-contract seed, and still on disk in every
  // workspace opened before 2026-08-14.
  `export interface Row {
  title: string;
}

/** Shared helpers live here and are imported by whatever needs them. */
export function clean(row: Row): Row {
  return { ...row, title: row.title.trim() };
}
`,
  // 2026-08-14, briefly: reworded, same one-row API.
  `// A plain module. Nothing here is this app's invention — put whatever you reuse
// in files like this one and import them from your scripts.

export interface Row {
  title: string;
}

export function clean(row: Row): Row {
  return { ...row, title: row.title.trim() };
}
`,
];

/**
 * The studio seeds this app has shipped before.
 *
 * A seed only lands in an **empty** slot, so a workspace opened once keeps
 * whatever starter file shipped that day — and the ones below teach a runtime
 * this app no longer has (`new Function`, no types, an import that would have
 * thrown). They are matched byte for byte: an untouched file is ours to
 * replace, and one changed line makes it the person's, which we leave alone.
 *
 * Do not edit these strings to match a new seed. They are a record of what was
 * written to disk, not a template.
 */
const PAST_STUDIO_SEEDS = [
  // Shipped 2026-08-12..13, and before that under the name `pipeline`.
  `// Stage script. Stages reference the functions this exports.
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
`,
]
  .flatMap((seed) => [seed, seed.replace('// Stage script.', '// Pipeline script.')])
  .concat([
    // 2026-08-13, briefly: the runtime was right by then, but the seed still led
    // with the stage contract instead of a script.
    `// Stage script. Stages reference the functions this exports.
//   extract(page, ctx)  → ingestion. Returns raw rows, unchanged.
//   transform(raw)      → processing. Reshapes them for storage.
//
// This is a real module. TypeScript, the import below, and any package you
// install under scripts/ (npm i cheerio) all work — the file is imported by a
// real Node runtime, not evaluated as a string.

import { clean, type Row } from './lib/rows.ts'; // the extension is not optional in ESM

export async function extract(page: any, ctx: { url?: string }): Promise<Row[]> {
  await page.goto(ctx.url ?? 'https://example.com');
  return page.$$eval('h1', (els: Element[]) =>
    els.map((el) => ({ title: el.textContent ?? '' })),
  );
}

export function transform(raw: Row[]): Row[] {
  return raw.map(clean);
}
`,
    // 2026-08-13..14: a script by then, and right about the runtime — but with
    // nothing to import, so "imports of your other scripts work" stayed a claim.
    // Someone opened the workbench, saw a lib/ folder left over from the seed
    // above, and had to ask what it was for.
    `// Browser workbench. This file is a script: it runs top to bottom, as written,
// in a real Node runtime. TypeScript, imports of your other scripts, and any
// package you install under scripts/ (npm i cheerio) all work.
//
// Already in scope: page (the active tab) · context · browser · ctx.url (the
// address bar) · env. console.log lands in the panel below, as it happens.

await page.goto(ctx.url ?? 'https://example.com');

const title: string = await page.title();
console.log('title:', title);

const headings: string[] = await page.$$eval('h1', (els: Element[]) =>
  els.map((el) => el.textContent?.trim() ?? ''),
);
console.log(headings.length, 'headings', headings);

// A pipeline stage calls a script by the function it exports instead:
//   export async function extract(page, ctx) { ... }
//   export function transform(raw) { ... }
`,
    // 2026-08-14, briefly: the import demo had landed, but the file still signed
    // off with the stage contract — three lines naming a convention this app
    // invented, for screens that are not built, with nothing explaining either.
    // "왜 필요한지 모르겠음" was the reply, and it was the right one.
    `// Browser workbench. This file is a script: it runs top to bottom, as written,
// in a real Node runtime. TypeScript, imports of your other scripts, and any
// package you install under scripts/ (npm i cheerio) all work.
//
// Already in scope: page (the active tab) · context · browser · ctx.url (the
// address bar) · env. console.log lands in the panel below, as it happens.

// Your own file, one folder down — open lib/rows.ts to see the other side.
// The '.ts' is not optional: Node loads these as ES modules, and an ES module
// asks for the file by its real name. A package you installed is a bare name
// instead: import { load } from 'cheerio';
import { clean, type Row } from './lib/rows.ts';

await page.goto(ctx.url ?? 'https://example.com');

const title: string = await page.title();
console.log('title:', title);

const headings: Row[] = await page.$$eval('h1', (els: Element[]) =>
  els.map((el) => ({ title: el.textContent ?? '' })),
);
console.log(headings.length, 'headings', headings.map(clean));

// A pipeline stage calls a script by the function it exports instead:
//   export async function extract(page, ctx) { ... }
//   export function transform(raw) { ... }
`,
  ]);

/**
 * The slot root is a **module root**.
 *
 * Node resolves both `./lib/x.ts` and a bare package name by walking up from the
 * script file, so this one file is what turns the folder a person edits in into
 * somewhere they can \`npm i cheerio\`. The app does not install anything on
 * their behalf — quietly fetching dependencies is not ours to do.
 */
const SEED_PACKAGE_JSON = `{
  "name": "hermetra-workspace-scripts",
  "private": true,
  "type": "module"
}
`;

/**
 * The globals the runner injects before importing a script.
 *
 * They exist so a snippet copied from the legacy web screen still runs inside a
 * module (`page` would otherwise be a free variable). Writing them down is what
 * stops an editor from painting that snippet red; it changes nothing at
 * runtime. The renderer hands Monaco the same text — see `@shared/studio`.
 */
const SEED_ENV_DTS = STUDIO_AMBIENT_DTS;

/**
 * The guide, seeded next to the scripts.
 *
 * It exists because of a question nobody could answer from inside the app:
 * "what syntax do I even look up?" (2026-08-14). Two thirds of the answer is
 * Playwright's own documentation and can only be a link. The other third —
 * which globals are already in scope, that the engine under Playwright is
 * Firefox, that a relative import keeps its `.ts` — is this app's own, is
 * written down nowhere a person would think to look, and is what this file is
 * for.
 *
 * It ships as a file in the workspace rather than a panel in the UI so that it
 * opens in the same editor as the scripts, works with no network, and can be
 * edited or deleted like anything else in that folder.
 */
const SEED_GUIDE = `# Browser workbench — what to read, and what is this app's own

This file was put here by Hermetra. Edit it, or delete it; it is yours.

## The short version

A script here is an ordinary file that a real Node process imports as an ES
module. **Nothing in it is this app's invention** except the six globals in the
table below. So the syntax you look up is:

| For | Read |
|---|---|
| \`page\`, \`context\`, \`browser\` — everything you do to the browser | <https://playwright.dev/docs/api/class-page> |
| The language itself | TypeScript / ES modules |
| The six globals | this file |

**The engine is Firefox.** The workbench browser is Camoufox, a Firefox build,
and the app connects to it with Playwright's \`firefox\`. Anything the Playwright
docs mark Chromium-only does not work here (CDP sessions, \`page.coverage\`, and
a handful of \`route\`/emulation options). Check that label before you copy.

Versions in use: playwright 1.60, camoufox-js 0.12.

## Already in scope — no import needed

| Name | What it is |
|---|---|
| \`page\` | the active tab, a real Playwright \`Page\` |
| \`context\` | the context it belongs to. \`await context.newPage()\` opens another tab |
| \`browser\` | the browser itself, if you want a context of your own |
| \`ctx\` | \`{ url?: string }\` — the address bar as the run saw it |
| \`log(...)\` | same destination as \`console.log\`: the output panel below |
| \`env\` | environment variables of the process running the script |

There is also a \`bus\`, and it is **not wired yet**: \`bus.set(k, v)\` only prints a
line to the output panel, and \`bus.get()\` always returns \`undefined\`. To pass a
value between scripts today, use a file or a return value.

These are declared in \`../hermetra-env.d.ts\`, which is why your editor does not
paint them red. They are typed \`any\`, so there is no autocompletion. If you want
it, open the \`scripts/\` folder in your own editor, \`npm i -D playwright\` there,
and narrow what you need:

\`\`\`ts
const p = page as import('playwright').Page;
\`\`\`

Inside this app's editor it stays \`any\` either way — Monaco has no filesystem
here, so module resolution is switched off.

## Importing

\`\`\`ts
import { clean } from './lib/rows.ts';   // your own file — keep the .ts
import { load } from 'cheerio';          // a package — bare name
\`\`\`

The extension is not optional. Node loads these as ES modules, and an ES module
asks for a file by its real name. It resolves from **the script's own folder**,
so \`./lib/rows.ts\` means the \`lib\` next to this file.

Packages install where the folder is a module root:

\`\`\`
cd <this workspace>/scripts
npm i cheerio
\`\`\`

The app does not install anything for you.

## Running

The Run button runs the file open in the editor, top to bottom.
\`console.log\` lands in the output panel as it happens, not at the end.

## \`export extract\` / \`export transform\` — read this before you use it

**This is not a library's syntax. It is a convention this app made up, and right
now almost nothing uses it.**

What it does today: if your file exports a function named \`extract\`, Run calls
\`extract(page, ctx)\` instead of merely importing the file. If \`transform\` is also
exported, it is called with whatever \`extract\` returned. The final value is
printed to the output panel with a row count.

What it does not do: the Ingestion and Processing screens that were supposed to
pick a script this way **are not built** — they are empty placeholders, and their
own spec says the data shape is not decided yet. So the two names buy you nothing
a plain script does not already give you, and they are matched literally: a typo
like \`extrct\` fails silently.

**Write a plain script.** This section is here so that a file you inherit which
opens with \`export async function extract\` is not a mystery.
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

/**
 * Written once, then left alone. Both files are things a person edits — the
 * dependency list they installed, the ambient types they extended — and
 * rewriting either on every listing would quietly undo their work.
 */
function ensureModuleRoot(root: string): void {
  for (const [name, source] of [
    ['package.json', SEED_PACKAGE_JSON],
    ['hermetra-env.d.ts', SEED_ENV_DTS],
  ] as const) {
    const file = path.join(root, name);
    if (!fs.existsSync(file)) fs.writeFileSync(file, source, 'utf-8');
  }
}

/**
 * Put the guide in the slot if it is not there.
 *
 * Not part of `seedIfEmpty`: that only fires into an **empty** slot, and the
 * person who needs a guide is the one already looking at a folder full of their
 * own files. Written when absent and then left alone, like the module-root
 * files — so an edited copy survives, and a deleted one comes back next listing.
 * That is the trade: this is documentation the app ships, not the person's work,
 * and a guide you can lose for good is worse than one that reappears.
 *
 * A revised guide will need what the seed already has (replace only a copy that
 * is byte-for-byte one the app wrote). There is only one version so far, so that
 * machinery is not here yet.
 */
function ensureGuide(slotDir: string): void {
  const file = path.join(slotDir, 'GUIDE.md');
  if (!fs.existsSync(file)) fs.writeFileSync(file, SEED_GUIDE, 'utf-8');
}

function dir(slot: Slot): string {
  const root = path.join(workspaceManager().activeDir(), 'scripts');
  // Before the mkdir below: creating the new folder first would make the move
  // look like the both-folders-exist case and strand the old one forever.
  fs.mkdirSync(root, { recursive: true });
  migrateLegacySlot(root, slot);
  // Only the studio slot's files are imported as modules, but the root is
  // shared, so the declaration lands where every slot can see it.
  if (slot === 'studio') ensureModuleRoot(root);

  const d = path.join(root, slot);
  fs.mkdirSync(d, { recursive: true });
  // The workbench is the only slot with a runtime worth explaining; web and
  // mobile scripts are evaluated snippets and have their own screens.
  if (slot === 'studio') ensureGuide(d);
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

/** Line endings and a trailing newline are not an edit. Anything else is. */
const sameFile = (a: string, b: string) =>
  a.replace(/\r\n/g, '\n').trimEnd() === b.replace(/\r\n/g, '\n').trimEnd();

/**
 * Bring an untouched starter file up to date.
 *
 * Only the file this app wrote, only while it is still exactly as written. It
 * is never created here — a seed the person deleted stays deleted.
 */
function replaceUntouchedSeed(root: string, name: string, files: [string, string][]): void {
  const file = path.join(root, name);
  if (!fs.existsSync(file)) return;
  const current = fs.readFileSync(file, 'utf-8');
  if (!PAST_STUDIO_SEEDS.some((past) => sameFile(current, past))) return;

  /**
   * The starter is a **set**: the script and the file it imports. They are
   * upgraded together or not at all, because the new example calls
   * `clean(rows)` where the old helper took one row — replace the script alone
   * and the very line meant to teach the import is the line that throws.
   *
   * So a companion the person has edited stops the whole upgrade. A stale
   * example that runs beats a fresh one that cannot, and they still get the
   * guide.
   */
  for (const [to] of files) {
    if (to === name) continue;
    const target = path.join(root, to);
    if (!fs.existsSync(target)) continue;
    const held = fs.readFileSync(target, 'utf-8');
    if (!PAST_STUDIO_LIBS.some((past) => sameFile(held, past))) return;
  }

  for (const [to, source] of files) {
    const target = path.join(root, to);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, source, 'utf-8');
  }
}

function seedIfEmpty() {
  const seeds: [Slot, [string, string][]][] = [
    ['web', [['login.ts', SEED_WEB]]],
    ['mobile', [['verify-otp.ts', SEED_MOBILE]]],
    // The script first, then the file it imports — an example that throws on its
    // own first line teaches the opposite of what it is for.
    ['studio', [['example.ts', SEED_STUDIO], ['lib/rows.ts', SEED_STUDIO_LIB]]],
  ];
  for (const [slot, files] of seeds) {
    const root = dir(slot);
    // "Empty" means the person has nothing here — the guide `dir()` just laid
    // down is the app talking to itself, and counting it would make every slot
    // look occupied and no starter file would ever land.
    if (fs.readdirSync(root).filter((name) => name !== 'GUIDE.md').length > 0) {
      // Not empty, so nothing is seeded — but a workspace opened a week ago is
      // still holding the starter file of that week, and this one is now wrong
      // about how scripts run.
      if (slot === 'studio') replaceUntouchedSeed(root, 'example.ts', files);
      continue;
    }
    for (const [name, source] of files) {
      const file = path.join(root, name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, source, 'utf-8');
    }
  }
}

function walk(root: string, current: string, out: ScriptFile[]) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    // A run writes its module beside the script it came from, named with a
    // leading dot. It belongs to the run, not to the person's tree.
    if (entry.name.startsWith('.')) continue;
    const abs = path.join(current, entry.name);
    const rel = path.relative(root, abs).split(path.sep).join('/');
    if (entry.isDirectory()) {
      out.push({ path: rel, name: entry.name, type: 'folder' });
      walk(root, abs, out);
    } else if (entry.isFile() && LISTED_EXT.test(entry.name)) {
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
  /**
   * Where a script lives, for a run that has to put its module beside it.
   *
   * One directory off and `./lib/login.ts` resolves somewhere else, so this is
   * the same path resolution every other operation uses — escapes included.
   * A buffer nobody has named yet belongs at the slot root: trying something out
   * before naming it is what the workbench is for.
   */
  locate(slot: Slot, p?: string): { dir: string; name: string } {
    const file = safePath(slot, p?.trim() ? p : 'untitled.ts');
    const folder = path.dirname(file);
    fs.mkdirSync(folder, { recursive: true });
    return { dir: folder, name: path.basename(file) };
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
