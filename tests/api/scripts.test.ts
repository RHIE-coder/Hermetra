import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runModule } from '@main/sidecar/host/runner';

let tmpDir: string;

vi.mock('@main/services/workspaceManager', () => ({
  workspaceManager: () => ({ activeDir: () => tmpDir }),
}));

const importFresh = async () => {
  vi.resetModules();
  return import('@main/services/scripts');
};

describe('scripts service — tree & folders', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetra-scripts-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('seeds a starter script on first list', async () => {
    const { scriptsService } = await importFresh();
    const items = scriptsService.list('web');
    expect(items.some((i) => i.type === 'file' && i.name === 'login.ts')).toBe(true);
  });

  it('mkdir creates nested folders and lists them as folder entries', async () => {
    const { scriptsService } = await importFresh();
    scriptsService.list('web'); // seed first
    scriptsService.mkdir('web', 'auth/admin');
    const items = scriptsService.list('web');
    const paths = items.map((i) => `${i.type}:${i.path}`);
    expect(paths).toContain('folder:auth');
    expect(paths).toContain('folder:auth/admin');
  });

  it('save writes a nested file and creates parent folders', async () => {
    const { scriptsService } = await importFresh();
    scriptsService.save('mobile', { path: 'flows/checkout/run.ts', source: 'log("hi")' });
    const items = scriptsService.list('mobile');
    expect(items.some((i) => i.type === 'folder' && i.path === 'flows')).toBe(true);
    expect(items.some((i) => i.type === 'folder' && i.path === 'flows/checkout')).toBe(true);
    expect(items.some((i) => i.type === 'file' && i.path === 'flows/checkout/run.ts')).toBe(true);

    const body = scriptsService.read('mobile', 'flows/checkout/run.ts');
    expect(body.source).toBe('log("hi")');
  });

  it('remove on a folder deletes it recursively', async () => {
    const { scriptsService } = await importFresh();
    scriptsService.save('web', { path: 'team/login.ts', source: '' });
    scriptsService.save('web', { path: 'team/signup.ts', source: '' });
    scriptsService.remove('web', 'team');
    const items = scriptsService.list('web');
    expect(items.every((i) => !i.path.startsWith('team'))).toBe(true);
  });

  it('rejects paths that try to escape the workspace', async () => {
    const { scriptsService } = await importFresh();
    expect(() => scriptsService.mkdir('web', '../outside')).toThrow(/Invalid path/);
    expect(() => scriptsService.save('web', { path: '../leak.ts', source: '' })).toThrow(
      /Invalid path/,
    );
  });
});

describe('scripts service — the studio slot', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetra-scripts-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('seeds a starter script of its own', async () => {
    const { scriptsService } = await importFresh();
    const items = scriptsService.list('studio');
    expect(items.some((i) => i.type === 'file')).toBe(true);
  });

  it('seeds a script, not a contract to fill in', async () => {
    // The workbench is where a person tries things. Opening it onto an export
    // contract made it read as a framework; what it should read as is the
    // script they would have written anyway.
    const { scriptsService } = await importFresh();
    const [first] = scriptsService.list('studio').filter((i) => i.type === 'file');
    const body = scriptsService.read('studio', first!.path);

    expect(body.source).toMatch(/^await page\.goto/m);
    expect(body.source).toMatch(/console\.log/);
    // TypeScript, because that is the whole point of the runtime underneath.
    // Any annotated declaration will do — which line carries it is the seed's
    // business, not this test's.
    expect(body.source).toMatch(/^const \w+: \w+(\[\])? =/m);
    expect(body.source).not.toMatch(/^export /m);
  });

  it('keeps its files away from the web and mobile slots', async () => {
    // Three folders, three lists. A shared folder would put a mobile driver
    // script in the list a browser stage picks from.
    const { scriptsService } = await importFresh();
    scriptsService.save('studio', { path: 'amazon.ts', source: '// pipeline' });
    expect(scriptsService.list('web').some((i) => i.path === 'amazon.ts')).toBe(false);
    expect(scriptsService.list('mobile').some((i) => i.path === 'amazon.ts')).toBe(false);
    expect(scriptsService.list('studio').some((i) => i.path === 'amazon.ts')).toBe(true);
  });

  it('holds shared helpers in subfolders, so a script can import one', async () => {
    const { scriptsService } = await importFresh();
    scriptsService.save('studio', { path: 'lib/auth.ts', source: 'export const login = 1;' });
    const items = scriptsService.list('studio');
    expect(items.map((i) => `${i.type}:${i.path}`)).toContain('folder:lib');
    expect(items.map((i) => i.path)).toContain('lib/auth.ts');
  });

  // A comment saying "imports of your other scripts work" was the whole answer,
  // and it left the two things that actually bite to be guessed: which folder,
  // and that the extension is not optional. An example that runs says both, and
  // is the difference between a claim and a demonstration.
  it('opens on a script that really imports another file, and ships that file too', async () => {
    const { scriptsService } = await importFresh();
    const items = scriptsService.list('studio');
    const seed = scriptsService.read('studio', 'example.ts').source;

    const clause = seed.match(/^import \{([^}]+)\} from '([^']+)';/m);
    expect(clause, 'the seed has no import to learn from').not.toBeNull();
    // Relative, and carrying the extension — the specifier Node actually wants.
    expect(clause![2]).toBe('./lib/rows.ts');

    // The file it points at is seeded beside it, or the example throws on line one.
    expect(items.map((i) => i.path)).toContain('lib/rows.ts');
    const helper = scriptsService.read('studio', 'lib/rows.ts').source;
    for (const name of clause![1].split(',').map((n) => n.replace(/^\s*type\s+/, '').trim())) {
      expect(helper, `lib/rows.ts does not export ${name}`).toMatch(
        new RegExp(`export [\\w ]*\\b${name}\\b`),
      );
    }
  });

  it('rejects an escaping path here too', async () => {
    const { scriptsService } = await importFresh();
    expect(() => scriptsService.save('studio', { path: '../leak.ts', source: '' })).toThrow(
      /Invalid path/,
    );
  });
});

describe('scripts service — the slot root is a module root', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetra-scripts-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const root = () => path.join(tmpDir, 'scripts');

  it('lays down a package.json so imports and installed packages resolve', async () => {
    // Node walks up from the script file: this one line is what makes both
    // `./lib/x.ts` and `npm i cheerio` work in the folder a person edits in.
    const { scriptsService } = await importFresh();
    scriptsService.list('studio');

    const pkg = JSON.parse(fs.readFileSync(path.join(root(), 'package.json'), 'utf-8'));
    expect(pkg.type).toBe('module');
  });

  it('declares the injected globals so the editor does not paint a snippet red', async () => {
    const { scriptsService } = await importFresh();
    scriptsService.list('studio');

    const dts = fs.readFileSync(path.join(root(), 'hermetra-env.d.ts'), 'utf-8');
    expect(dts).toMatch(/declare (const|var|global)/);
    expect(dts).toMatch(/page/);
  });

  it('never overwrites a package.json a person has edited', async () => {
    // It is where their dependencies are written down.
    const { scriptsService } = await importFresh();
    scriptsService.list('studio');
    fs.writeFileSync(
      path.join(root(), 'package.json'),
      JSON.stringify({ type: 'module', dependencies: { cheerio: '^1.0.0' } }),
      'utf-8',
    );

    scriptsService.list('studio');
    const pkg = JSON.parse(fs.readFileSync(path.join(root(), 'package.json'), 'utf-8'));
    expect(pkg.dependencies).toEqual({ cheerio: '^1.0.0' });
  });

  it('hides dotfiles from the listing', async () => {
    // A run writes a temp module beside the script. It is not the person's file
    // and must never appear in their tree.
    const { scriptsService } = await importFresh();
    scriptsService.list('studio');
    fs.writeFileSync(path.join(root(), 'studio', '.step.run-1.ts'), '', 'utf-8');

    expect(scriptsService.list('studio').some((i) => i.name.startsWith('.'))).toBe(false);
  });

  it('locates a script so a run knows which directory it belongs to', async () => {
    const { scriptsService } = await importFresh();
    const found = scriptsService.locate('studio', 'lib/login.ts');

    expect(found.dir).toBe(path.join(root(), 'studio', 'lib'));
    expect(found.name).toBe('login.ts');
  });

  it('locates an unsaved buffer at the slot root', async () => {
    // Trying something out before naming it is the point of the workbench.
    const { scriptsService } = await importFresh();
    const found = scriptsService.locate('studio', undefined);

    expect(found.dir).toBe(path.join(root(), 'studio'));
    expect(found.name).toMatch(/\.ts$/);
  });

  it('refuses to locate a path that climbs out of the slot', async () => {
    const { scriptsService } = await importFresh();
    expect(() => scriptsService.locate('studio', '../../secrets.ts')).toThrow(/Invalid path/);
  });
});

/**
 * The guide is the app's answer to "what do I even look at?".
 *
 * It is seeded next to the scripts and listed in the tree rather than linked out,
 * because the half a person cannot look up anywhere — the injected globals, the
 * Firefox engine under Playwright, what Run does with a default export — is
 * exactly the half that is this app's own. A link to playwright.dev answers the
 * other half.
 *
 * It ships in **both** of the app's languages (2026-08-18). The app is bilingual
 * everywhere else — `messages.ts` fails to compile if a key is missing either
 * side — and the one document explaining how to write a script was English only.
 * Both files are laid down for everyone: the person is the one who knows which
 * they read, and a guide that appears only in the language the UI happens to be
 * set to is a guide that vanishes when someone flips the switch.
 */
describe('scripts service — the guide sits with the scripts, in both languages', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetra-scripts-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const slot = () => path.join(tmpDir, 'scripts', 'studio');
  const guide = (lang: 'ko' | 'en') => path.join(slot(), `GUIDE_${lang}.md`);
  const GUIDES = ['GUIDE_ko.md', 'GUIDE_en.md'] as const;

  it('lists both guides, so the tree opens the one you read', async () => {
    const { scriptsService } = await importFresh();
    const items = scriptsService.list('studio').map((i) => i.path);
    for (const name of GUIDES) expect(items).toContain(name);
  });

  it('reaches a workspace that already existed, not only a fresh one', async () => {
    // The person who needs the guide is the one already staring at a workspace
    // full of their own files — `seedIfEmpty` never fires there.
    fs.mkdirSync(slot(), { recursive: true });
    fs.writeFileSync(path.join(slot(), 'mine.ts'), '// mine', 'utf-8');

    const { scriptsService } = await importFresh();
    scriptsService.list('studio');

    expect(fs.existsSync(guide('ko'))).toBe(true);
    expect(fs.existsSync(guide('en'))).toBe(true);
  });

  it('answers the questions it exists to answer — in either language', async () => {
    const { scriptsService } = await importFresh();

    for (const name of GUIDES) {
      const { source } = scriptsService.read('studio', name);

      // Where to look for the 90% this app did not invent — and the engine, because
      // Playwright's Chromium-only pages are a dead end here.
      expect(source, `${name} names no documentation to read`).toMatch(/playwright\.dev/);
      expect(source, `${name} never says the engine is Firefox`).toMatch(/[Ff]irefox/);
      // The globals, which are documented nowhere else a person would think to look.
      for (const g of ['page', 'context', 'browser', 'ctx', 'log', 'env']) {
        // In backticks, either bare or as a call — `log(...)` counts.
        expect(source, `${name} never mentions \`${g}\``).toMatch(new RegExp('`' + g + '[(`]'));
      }
      // What Run calls on the author's behalf — the only thing it calls, since
      // `extract`/`transform` left the runner on 2026-08-18.
      expect(source, `${name} never says what a default export does`).toMatch(
        /export default/,
      );
    }
  });

  it('writes the Korean one in Korean and the English one in English', async () => {
    // Two files whose only difference is the name would be worse than one file:
    // the tree would show a choice that is not a choice.
    const { scriptsService } = await importFresh();
    const hangul = /[가-힣]/;

    expect(scriptsService.read('studio', 'GUIDE_ko.md').source).toMatch(hangul);
    expect(scriptsService.read('studio', 'GUIDE_en.md').source).not.toMatch(hangul);
  });

  it('has each guide point at the other, so two of them is not a puzzle', async () => {
    const { scriptsService } = await importFresh();
    expect(scriptsService.read('studio', 'GUIDE_ko.md').source).toContain('GUIDE_en.md');
    expect(scriptsService.read('studio', 'GUIDE_en.md').source).toContain('GUIDE_ko.md');
  });

  it('leaves a guide the person has edited alone', async () => {
    const { scriptsService } = await importFresh();
    scriptsService.list('studio');
    const mine = '# my notes\n';
    fs.writeFileSync(guide('ko'), mine, 'utf-8');

    scriptsService.list('studio');
    expect(fs.readFileSync(guide('ko'), 'utf-8')).toBe(mine);
    // The other one is a separate file, so a note in one does not stop the other
    // from being replaced when it is missing.
    expect(fs.existsSync(guide('en'))).toBe(true);
  });

  it('takes away the single-language GUIDE.md it used to ship', async () => {
    // The app shipped one English `GUIDE.md` until 2026-08-18. Leaving it beside
    // the pair puts three guides in the tree and two of them are the same text,
    // so it goes — **even if the person edited it**, which is the user's call
    // (2026-08-18) and the one thing here that can lose someone's writing.
    fs.mkdirSync(slot(), { recursive: true });
    fs.writeFileSync(path.join(slot(), 'GUIDE.md'), '# my own notes\n', 'utf-8');

    const { scriptsService } = await importFresh();
    const items = scriptsService.list('studio').map((i) => i.path);

    expect(fs.existsSync(path.join(slot(), 'GUIDE.md'))).toBe(false);
    expect(items).not.toContain('GUIDE.md');
    for (const name of GUIDES) expect(items).toContain(name);
  });

  it('still seeds the starter script into a slot holding only the guides', async () => {
    // The guides `dir()` just laid down are the app talking to itself. Counting
    // them makes every slot look occupied, and no starter file ever lands.
    const { scriptsService } = await importFresh();
    const items = scriptsService.list('studio').map((i) => i.path);
    expect(items).toContain('example.ts');
  });

  it('does not list a markdown file as something to run', async () => {
    // Listing it is what makes it openable; it is still not a script. The Run
    // button is disabled for it in the editor (`CodeEditor.test.tsx`).
    const { scriptsService } = await importFresh();
    const [guideEntry] = scriptsService.list('studio').filter((i) => i.path === 'GUIDE_ko.md');
    expect(guideEntry!.type).toBe('file');
  });
});

/**
 * The example is the answer to "how do I import one of my own files?", so the
 * one thing it must never be is broken. A seed is a string in this file until
 * something runs it — and a wrong specifier or a name that is not exported over
 * in lib/ both look perfectly fine as text.
 *
 * `tests/api/studio-session.test.ts` already runs the shipped seed and checks it
 * does not fail. This asks the next question: the import resolved, but did the
 * thing it imported do anything? A seed that pulls in `clean` and never applies
 * it passes there and still teaches nothing here.
 *
 * A fake page — what is under test is the example, not a browser.
 */
describe('scripts service — the example it seeds actually runs', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetra-scripts-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('runs top to bottom, import and all', async () => {
    const { scriptsService } = await importFresh();
    scriptsService.list('studio');
    const { dir, name } = scriptsService.locate('studio', 'example.ts');
    const { source } = scriptsService.read('studio', 'example.ts');

    const lines: { level: string; text: string }[] = [];
    const visited: string[] = [];
    // What a page really hands back: wrapped, padded, and repeating itself.
    const page = {
      goto: async (to: string) => void visited.push(to),
      title: async () => 'Example Domain',
      $$eval: async (_sel: string, fn: (els: unknown[]) => unknown) =>
        fn([
          { textContent: '  Example Domain  ' },
          { textContent: 'This domain is for use\n    in illustrative examples.' },
          { textContent: '   ' },
          { textContent: 'Example Domain' },
        ]),
    };

    const out = await runModule(
      { runId: 'seed', dir, name, source, ctx: {} },
      { page, emit: (level, text) => lines.push({ level, text }), now: () => 0 },
    );

    expect(out.error).toBe('');
    expect(out.ok).toBe(true);
    expect(visited).toEqual(['https://example.com']);

    const transcript = lines.map((l) => l.text).join('\n');
    expect(transcript).toContain('title: Example Domain');

    // The whole point of the example: you can see, side by side, what the
    // imported function did. Printing only the result teaches nothing — there
    // is nothing to compare it against.
    const [rawLine, cleanedLine] = [
      lines.find((l) => l.text.startsWith('raw'))?.text,
      lines.find((l) => l.text.startsWith('cleaned'))?.text,
    ];
    expect(rawLine, 'the example never shows the untouched rows').toBeDefined();
    expect(cleanedLine, 'the example never shows the cleaned rows').toBeDefined();

    // Raw keeps the mess; cleaned does not. That difference is the demonstration.
    expect(rawLine).toContain('  Example Domain  ');
    expect(cleanedLine).not.toContain('  Example Domain  ');
    expect(cleanedLine).toContain('Example Domain');
    // Wrapped text collapsed, the blank dropped, the repeat dropped.
    expect(cleanedLine).not.toMatch(/\\n/);
    expect((cleanedLine!.match(/Example Domain/g) ?? []).length).toBe(1);
  });
});

describe('scripts service — a workspace that already has the old seed', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetra-scripts-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const slot = () => path.join(tmpDir, 'scripts', 'studio');
  const seedFile = () => path.join(slot(), 'example.ts');
  const read = (p: string) => fs.readFileSync(p, 'utf-8');

  /** The seed as it shipped before 2026-08-13: no types, no import that runs. */
  const OLD_SEED = `// Stage script. Stages reference the functions this exports.
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

  /** The same file one name earlier, while the slot was called `pipeline`. */
  const OLDER_SEED = OLD_SEED.replace('// Stage script.', '// Pipeline script.');

  /**
   * The seed as it shipped 2026-08-13..14: a script by then, but with nothing to
   * import — which is the state the person was in when they asked how importing
   * is supposed to work.
   */
  const SEED_WITHOUT_IMPORT = `// Browser workbench. This file is a script: it runs top to bottom, as written,
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
`;

  /** The `lib/rows.ts` that ships today — the seed is only upgraded as a pair. */
  const CURRENT_LIB = `// Your own module — nothing here is this app's invention. Whatever you would
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
   * The seed as it shipped 2026-08-14..18 — a script that imports, and correct
   * about the runtime, but pointing at a guide called `GUIDE.md`. That file is
   * gone (one guide per language since 2026-08-18), so the first file a person
   * opens sends them to something the app deletes on the next listing.
   */
  const SEED_POINTING_AT_ONE_GUIDE = `// Browser workbench. This file is a script: it runs top to bottom, as written,
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

  const plant = (source: string) => {
    fs.mkdirSync(slot(), { recursive: true });
    fs.writeFileSync(seedFile(), source, 'utf-8');
  };

  it.each([
    ['the shipped seed', () => OLD_SEED],
    ['the one from when the slot was `pipeline`', () => OLDER_SEED],
    ['the same file with Windows line endings', () => OLD_SEED.replace(/\n/g, '\r\n')],
    ['the script that had nothing to import', () => SEED_WITHOUT_IMPORT],
  ])('replaces %s, because nobody wrote it', async (_which, source) => {
    // The seed only lands in an empty slot, so a workspace that has been opened
    // once keeps whatever shipped that day — here, a starter file that teaches
    // a runtime this app no longer has.
    plant(source());
    const { scriptsService } = await importFresh();
    scriptsService.list('studio');

    expect(read(seedFile())).toMatch(/^await page\.goto/m);
    expect(read(seedFile())).not.toMatch(/^export async function extract/m);
  });

  it('sends a carried-over seed to the guides that exist now', async () => {
    // The pointer is the whole reason this file has a comment header. A stale
    // one is worse than none: it names a file, so the person goes looking.
    plant(SEED_POINTING_AT_ONE_GUIDE);
    fs.mkdirSync(path.join(slot(), 'lib'), { recursive: true });
    fs.writeFileSync(path.join(slot(), 'lib', 'rows.ts'), CURRENT_LIB, 'utf-8');

    const { scriptsService } = await importFresh();
    scriptsService.list('studio');

    expect(read(seedFile())).toContain('GUIDE_ko.md');
    expect(read(seedFile())).not.toMatch(/\bGUIDE\.md\b/);
  });

  it('leaves a seed the person has touched exactly as it is', async () => {
    // One edited line makes it theirs. Overwriting work is worse than showing
    // an outdated example.
    const mine = `${OLD_SEED}\n// my note\n`;
    plant(mine);
    const { scriptsService } = await importFresh();
    scriptsService.list('studio');

    expect(read(seedFile())).toBe(mine);
  });

  it('does not bring back a seed that was deleted', async () => {
    fs.mkdirSync(slot(), { recursive: true });
    fs.writeFileSync(path.join(slot(), 'amazon.ts'), '// mine', 'utf-8');
    const { scriptsService } = await importFresh();
    scriptsService.list('studio');

    expect(fs.existsSync(seedFile())).toBe(false);
  });

  it('leaves everything else in the slot alone', async () => {
    plant(OLD_SEED);
    fs.mkdirSync(path.join(slot(), 'lib'), { recursive: true });
    fs.writeFileSync(path.join(slot(), 'lib', 'rows.ts'), '// mine', 'utf-8');
    fs.writeFileSync(path.join(slot(), 'amazon.ts'), '// also mine', 'utf-8');

    const { scriptsService } = await importFresh();
    scriptsService.list('studio');

    expect(read(path.join(slot(), 'lib', 'rows.ts'))).toBe('// mine');
    expect(read(path.join(slot(), 'amazon.ts'))).toBe('// also mine');
  });

  it('brings the file the new seed imports along with it', async () => {
    // Replacing the script alone would leave an import pointing at nothing —
    // the example would throw on its first line in a workspace that never had
    // a lib/ folder.
    plant(SEED_WITHOUT_IMPORT);
    const { scriptsService } = await importFresh();
    scriptsService.list('studio');

    expect(read(seedFile())).toMatch(/^import /m);
    expect(fs.existsSync(path.join(slot(), 'lib', 'rows.ts'))).toBe(true);
  });

  /** `lib/rows.ts` exactly as the app used to write it — nobody's edit in it. */
  const OLD_LIB = `export interface Row {
  title: string;
}

/** Shared helpers live here and are imported by whatever needs them. */
export function clean(row: Row): Row {
  return { ...row, title: row.title.trim() };
}
`;

  it('upgrades the script and the file it imports together', async () => {
    // They ship as a set. The new example calls `clean(rows)` where the old
    // helper took a single row, so replacing one and keeping the other is how
    // you get an example that throws on the line that is meant to teach.
    plant(SEED_WITHOUT_IMPORT);
    fs.mkdirSync(path.join(slot(), 'lib'), { recursive: true });
    fs.writeFileSync(path.join(slot(), 'lib', 'rows.ts'), OLD_LIB, 'utf-8');

    const { scriptsService } = await importFresh();
    scriptsService.list('studio');

    expect(read(seedFile())).toMatch(/^import /m);
    expect(read(path.join(slot(), 'lib', 'rows.ts'))).not.toBe(OLD_LIB);
  });

  it('upgrades neither when the imported file is the person\'s', async () => {
    // A stale example that runs beats a fresh one that cannot. The guide still
    // lands, so they are not left with nothing.
    plant(SEED_WITHOUT_IMPORT);
    const mine = 'export interface Row { title: string }\nexport const clean = (r: Row) => r;\n';
    fs.mkdirSync(path.join(slot(), 'lib'), { recursive: true });
    fs.writeFileSync(path.join(slot(), 'lib', 'rows.ts'), mine, 'utf-8');

    const { scriptsService } = await importFresh();
    scriptsService.list('studio');

    expect(read(path.join(slot(), 'lib', 'rows.ts'))).toBe(mine);
    expect(read(seedFile())).toBe(SEED_WITHOUT_IMPORT);
    expect(fs.existsSync(path.join(slot(), 'GUIDE_ko.md'))).toBe(true);
    expect(fs.existsSync(path.join(slot(), 'GUIDE_en.md'))).toBe(true);
  });

  it('does not rewrite the current seed on every listing', async () => {
    const { scriptsService } = await importFresh();
    scriptsService.list('studio');
    const first = read(seedFile());

    scriptsService.list('studio');
    expect(read(seedFile())).toBe(first);
  });
});

describe('scripts service — the slot was called `pipeline` until 2026-08-12', () => {
  // The slot is a directory on disk holding files a person wrote. Renaming it
  // without moving them would not rename anything — it would hide their work
  // and then seed a fresh starter script on top, which reads as "my scripts are
  // gone".
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetra-scripts-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const legacy = (rel: string, source: string) => {
    const abs = path.join(tmpDir, 'scripts', 'pipeline', rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, source, 'utf-8');
  };

  it('carries the old folder over, subfolders and all', async () => {
    legacy('amazon.ts', '// mine');
    legacy('lib/auth.ts', 'export const login = 1;');

    const { scriptsService } = await importFresh();
    const items = scriptsService.list('studio');

    expect(items.map((i) => i.path)).toContain('amazon.ts');
    expect(items.map((i) => i.path)).toContain('lib/auth.ts');
    expect(scriptsService.read('studio', 'amazon.ts').source).toBe('// mine');
  });

  it('leaves nothing behind at the old name', async () => {
    legacy('amazon.ts', '// mine');
    const { scriptsService } = await importFresh();
    scriptsService.list('studio');
    expect(fs.existsSync(path.join(tmpDir, 'scripts', 'pipeline'))).toBe(false);
  });

  it('does not seed over files it just carried over', async () => {
    // The seed only fires into an empty slot. If the move ran late the folder
    // would look empty, get a starter script, and the person's own files would
    // arrive next to a file they never wrote.
    //
    // The guides are not that file: they are laid down in every slot,
    // carried-over or not, and are what this test would otherwise mistake for a
    // stray seed.
    legacy('amazon.ts', '// mine');
    const { scriptsService } = await importFresh();
    const files = scriptsService
      .list('studio')
      .filter((i) => i.type === 'file' && !/^GUIDE_(ko|en)\.md$/.test(i.path));
    expect(files.map((i) => i.path)).toEqual(['amazon.ts']);
  });

  it('keeps what is already in the new folder when both exist', async () => {
    // Two folders means a half-finished move, or an older app version writing
    // again after a newer one migrated. The newer folder is the live one.
    legacy('old.ts', '// old');
    const nu = path.join(tmpDir, 'scripts', 'studio');
    fs.mkdirSync(nu, { recursive: true });
    fs.writeFileSync(path.join(nu, 'new.ts'), '// new', 'utf-8');

    const { scriptsService } = await importFresh();
    const paths = scriptsService.list('studio').map((i) => i.path);
    expect(paths).toContain('new.ts');
    expect(paths).not.toContain('old.ts');
  });
});
