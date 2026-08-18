import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runModule, type RunRequest } from '@main/sidecar/host/runner';

/**
 * The workbench runner: a file the person wrote, imported as a real module.
 *
 * Everything here runs on a fake page — what is being checked is the runtime
 * (TypeScript, imports, the export contract, cleanup), not a browser.
 *
 * Spec: docs/spec/studio/browser.md — 실행: 파일은 진짜 모듈로 돈다.
 */

let dir = '';
const lines: { level: string; text: string }[] = [];

function fakePage(url = 'about:blank') {
  const page = {
    current: url,
    visited: [] as string[],
    url: () => page.current,
    goto: async (to: string) => { page.visited.push(to); page.current = to; },
    title: async () => `title of ${page.current}`,
  };
  return page;
}

/** The context and browser a script reaches for when it opens its own tab. */
function fakeContext() {
  const opened: ReturnType<typeof fakePage>[] = [];
  return {
    opened,
    newPage: async () => {
      const p = fakePage();
      opened.push(p);
      return p;
    },
    pages: () => opened,
  };
}

let context: ReturnType<typeof fakeContext>;

function run(source: string, over: Partial<RunRequest> = {}, page: unknown = fakePage()) {
  context = fakeContext();
  return runModule(
    { runId: 'r1', dir, name: 'step.ts', source, ctx: {}, ...over },
    {
      page,
      context,
      browser: { name: 'camoufox' },
      emit: (level, text) => lines.push({ level, text }),
      now: () => 0,
    },
  );
}

/** What the run left behind in the script's own directory. */
const leftovers = () => fs.readdirSync(dir).filter((f) => f !== 'step.ts' && f !== 'lib');

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetra-runner-'));
  lines.length = 0;
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('runModule — the shapes a file can take', () => {
  it('runs a plain snippet, with the live page reachable', async () => {
    const page = fakePage();
    const out = await run("log('hi'); await page.goto('https://example.com');", {}, page);

    expect(out.ok).toBe(true);
    expect(page.visited).toEqual(['https://example.com']);
    expect(lines).toContainEqual({ level: 'log', text: 'hi' });
  });

  it('does nothing special with functions named `extract` or `transform`', async () => {
    // Two names the app invented for the ingestion and processing screens, and
    // then called from four lines of the runner for a year in which those
    // screens stayed 13-line placeholders. Removed 2026-08-18: a file here runs
    // top to bottom, and the one thing Run calls on your behalf is a default
    // export. Anything else named in a file is just a function you exported.
    const page = fakePage();
    const out = await run(
      `
      export function extract() { throw new Error('must not be called'); }
      export function transform() { throw new Error('must not be called'); }
      log('the file itself ran');
    `,
      { ctx: { url: 'https://x.test' } },
      page,
    );

    expect(out.ok).toBe(true);
    expect(out.error).toBe('');
    expect(lines).toEqual([{ level: 'log', text: 'the file itself ran' }]);
  });

  it('calls a default export with the page and ctx', async () => {
    const page = fakePage();
    const out = await run(
      "export default async function (page, ctx) { await page.goto(ctx.url); return 'done'; }",
      { ctx: { url: 'https://x.test' } },
      page,
    );

    expect(out.ok).toBe(true);
    expect(page.visited).toEqual(['https://x.test']);
  });
});

describe('runModule — a script written the way the Playwright docs write one', () => {
  it('runs top to bottom with context, page and console', async () => {
    // This is the shape a person already knows. Nothing about it is ours: no
    // export contract, no `log()`, no wrapper.
    const out = await run(`
      const page = await context.newPage();
      await page.goto('http://example.com');
      console.log(page.url());
    `);

    expect(out.error).toBe('');
    expect(context.opened).toHaveLength(1);
    expect(lines).toContainEqual({ level: 'log', text: 'http://example.com' });
  });

  it('puts console.log in the panel, not into the wire', async () => {
    // The sidecar's stdout *is* the protocol. A script's console output written
    // there is dropped as noise, so it goes to the panel instead.
    await run("console.log('one', 2, { three: true });");
    expect(lines).toEqual([{ level: 'log', text: 'one 2 {"three":true}' }]);
  });

  it('marks console.error and console.warn as errors', async () => {
    await run("console.error('bad'); console.warn('careful');");
    expect(lines).toEqual([
      { level: 'error', text: 'bad' },
      { level: 'error', text: 'careful' },
    ]);
  });

  it('gives console back when the run is over', async () => {
    const before = console.log;
    await run("console.log('during');");
    expect(console.log).toBe(before);
  });

  it('hands the browser over too, for a script that wants its own context', async () => {
    const out = await run('console.log(browser.name);');
    expect(out.error).toBe('');
    expect(lines).toContainEqual({ level: 'log', text: 'camoufox' });
  });
});

describe('runModule — it is really TypeScript, and really a module', () => {
  it('runs a file with type annotations', async () => {
    const out = await run(`
      interface Row { title: string }
      export default async function (page: { url(): string }): Promise<Row[]> {
        return [{ title: page.url() }];
      }
    `);

    expect(out.error).toBe('');
    expect(out.ok).toBe(true);
  });

  it('imports a sibling file relative to the script, not the app', async () => {
    fs.mkdirSync(path.join(dir, 'lib'));
    fs.writeFileSync(
      path.join(dir, 'lib', 'login.ts'),
      'export const who = (name: string): string => `hello ${name}`;\n',
      'utf-8',
    );

    const out = await run(`
      import { who } from './lib/login.ts';
      export default function () { return who('rhie'); }
    `);

    expect(out.error).toBe('');
    expect(lines.at(-1)!.text).toContain('hello rhie');
  });

  it('reports a syntax error as a failed run and stays alive', async () => {
    const out = await run('export default function ( {');

    expect(out.ok).toBe(false);
    expect(out.error).not.toBe('');
    expect(lines.some((l) => l.level === 'error')).toBe(true);
  });

  it('keeps the runner\'s own frames out of the trace', async () => {
    // What follows the user's own frames is this file's plumbing. Printing it
    // makes a two-line mistake look like a crash in the app.
    const out = await run("export default function () { throw new Error('nope'); }");

    expect(out.error).toContain('step.ts');
    expect(out.error).not.toContain('runner.ts');
    expect(out.error).not.toContain('node:internal');
  });

  it('names the script, not the temp module, when something throws', async () => {
    // The file a person edits is `step.ts`. A trace pointing at a hidden file
    // they never wrote is a trace they cannot act on.
    const out = await run("export default function () { throw new Error('nope'); }");

    expect(out.ok).toBe(false);
    expect(out.error).toContain('nope');
    expect(out.error).not.toContain('.run-');
  });
});

describe('runModule — what it leaves behind', () => {
  it('removes the temp module after a good run', async () => {
    await run("log('fine');");
    expect(leftovers()).toEqual([]);
  });

  it('removes the temp module after a bad one too', async () => {
    await run('export default function ( {');
    expect(leftovers()).toEqual([]);
  });

  it('reports the run even with no page attached', async () => {
    const out = await run("log('no browser');", {}, null);
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/browser/i);
  });
});

describe('runModule — the returned value is the thing being checked', () => {
  it('prints rows with their count', async () => {
    const out = await run('export default function () { return [{ a: 1 }, { a: 2 }]; }');

    expect(out.ok).toBe(true);
    expect(lines.at(-1)!.text).toMatch(/2 rows/);
  });

  it('clips a huge value instead of burying the log', async () => {
    const out = await run("export default function () { return 'x'.repeat(5000); }");

    expect(out.ok).toBe(true);
    expect(lines.at(-1)!.text.length).toBeLessThan(2200);
    expect(lines.at(-1)!.text).toContain('…');
  });

  it('says nothing extra when the script returned nothing', async () => {
    await run("log('only this');");
    expect(lines).toEqual([{ level: 'log', text: 'only this' }]);
  });
});
