import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { RunOutcome } from '../protocol.ts';

/**
 * Runs one workbench script.
 *
 * **The file is imported, not evaluated.** Until 2026-08-13 this was
 * `new Function(source)` in the Electron main process, which rejects an
 * `import` statement and a type annotation alike — while the seed and the spec
 * both told people to reuse code with ordinary ES imports. Handing the file to
 * Node instead makes TypeScript, relative imports, installed packages and
 * file-accurate stack traces all arrive at once, because they are things the
 * runtime already does.
 *
 * That is also why this lives in the sidecar: `docs/spec/studio/browser.md`
 * records the measurement (a second Playwright client sees `contexts = 0`), so
 * the process holding the browser has to be the process running the script.
 */

/** What to run. `dir` is the script's own directory and is not negotiable. */
export interface RunRequest {
  runId: string;
  dir: string;
  name: string;
  source: string;
  ctx: { url?: string };
}

export interface RunDeps {
  /** The live page. Null when nothing is attached — a reportable state. */
  page: unknown;
  /** The context and the browser behind it, for a script that opens its own tab. */
  context?: unknown;
  browser?: unknown;
  emit: (level: 'log' | 'error', text: string) => void;
  now?: () => number;
  env?: NodeJS.ProcessEnv;
}

/** How much of a returned value reaches the panel before it stops being read. */
const MAX_RESULT_CHARS = 2000;

/**
 * The failure as the author of the script should read it.
 *
 * A thrown error's stack runs from their line down through this file, the
 * dispatcher and Node's internals. Those frames are this app's plumbing: they
 * make a two-line mistake look like a crash in the tool. So the trace is cut at
 * the first frame that is not theirs.
 */
function asMessage(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const stack = err.stack ?? err.message;
  const mine = /\bat .*(host[\\/](runner|serve|launcher)\.ts|node:internal)/;
  const lines = stack.split('\n');
  const cut = lines.findIndex((line) => mine.test(line));
  return (cut === -1 ? lines : lines.slice(0, cut)).join('\n').trimEnd();
}

/**
 * A returned value as one line of transcript.
 *
 * A stage returns rows, and a thousand of them would bury the log lines around
 * it. The head is what tells you whether the shape is right; the count tells you
 * whether the selector caught what you meant.
 */
function describe(value: unknown): string {
  const count = Array.isArray(value) ? ` (${value.length} rows)` : '';
  let text: string;
  try {
    text = JSON.stringify(value) ?? String(value);
  } catch {
    // Cyclic, or something JSON refuses. Saying so beats losing the run.
    text = String(value);
  }
  const clipped = text.length > MAX_RESULT_CHARS ? `${text.slice(0, MAX_RESULT_CHARS)}…` : text;
  return `→${count} ${clipped}`;
}

/**
 * Where the temp module goes: **beside the script**, always.
 *
 * One directory up or down and `./lib/login.ts` resolves somewhere else, which
 * would make the reuse story a lie again. The name starts with a dot so the
 * script listing (which hides dotfiles) never shows it, and carries the run id
 * so two runs cannot collide in Node's module cache.
 */
function tempModulePath(req: RunRequest): string {
  const base = path.basename(req.name, path.extname(req.name)) || 'untitled';
  return path.join(req.dir, `.${base}.run-${req.runId}.ts`);
}

/**
 * The scope a snippet expects.
 *
 * Inside a module `page` is a free variable, so a line copied from the legacy
 * `웹 > 스크립트` screen would be a `ReferenceError` — the globals are what keep
 * that paste working. A file that has grown up takes them as arguments instead;
 * see the export contract below.
 */
/** `console.log(x)` should read like it does in a terminal, objects included. */
function stringify(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.stack ?? value.message;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/**
 * Point `console` at the panel for the length of one run.
 *
 * In the sidecar, stdout **is** the protocol: a script's `console.log` written
 * there is not a message, it is a malformed frame, and it gets dropped as
 * noise. So the output a person expects to see simply vanished. Since the whole
 * point is that a script is written the way any other script is written, the
 * fix is to make the ordinary thing work rather than to teach a special one.
 */
function captureConsole(emit: (level: 'log' | 'error', text: string) => void): () => void {
  const original = { log: console.log, info: console.info, debug: console.debug, warn: console.warn, error: console.error };
  const to = (level: 'log' | 'error') => (...args: unknown[]) =>
    emit(level, args.map(stringify).join(' '));

  console.log = to('log');
  console.info = to('log');
  console.debug = to('log');
  // Warnings share the error channel: the panel has two colours, and a warning
  // is the one a person needs to see.
  console.warn = to('error');
  console.error = to('error');

  return () => Object.assign(console, original);
}

function inject(globals: Record<string, unknown>): () => void {
  const scope = globalThis as unknown as Record<string, unknown>;
  const had = new Map<string, { present: boolean; value: unknown }>();
  for (const [key, value] of Object.entries(globals)) {
    had.set(key, { present: key in scope, value: scope[key] });
    scope[key] = value;
  }
  return () => {
    for (const [key, prev] of had) {
      if (prev.present) scope[key] = prev.value;
      else delete scope[key];
    }
  };
}

export async function runModule(req: RunRequest, deps: RunDeps): Promise<RunOutcome> {
  const now = deps.now ?? (() => Date.now());
  const started = now();
  const done = (ok: boolean, error = ''): RunOutcome => ({ ok, error, durationMs: now() - started });

  if (!deps.page) {
    const text = 'No browser attached. Start the workbench browser first.';
    deps.emit('error', text);
    return done(false, text);
  }

  const file = tempModulePath(req);
  const log = (...args: unknown[]) => deps.emit('log', args.map(stringify).join(' '));
  const releaseConsole = captureConsole(deps.emit);
  const restore = inject({
    page: deps.page,
    // The context and the browser, so a script can open its own tab exactly the
    // way the Playwright documentation does.
    context: deps.context,
    browser: deps.browser,
    ctx: req.ctx,
    log,
    env: deps.env ?? process.env,
    // The shared bus is not wired to the workbench yet. Saying so in the
    // transcript beats a setter that silently drops what it was given.
    bus: { set: (k: string, v: string) => deps.emit('log', `bus.set(${k}=${v})`), get: () => undefined },
  });

  try {
    fs.writeFileSync(file, req.source, 'utf-8');
    // A file URL, so Node loads it natively: it strips the types and resolves
    // both `./lib/x.ts` and bare package names from where the file actually is.
    const mod = (await import(/* @vite-ignore */ pathToFileURL(file).href)) as Record<string, unknown>;

    let out: unknown;
    const call = (fn: unknown, ...args: unknown[]) =>
      typeof fn === 'function' ? (fn as (...a: unknown[]) => unknown)(...args) : undefined;

    // A default export is called for you. It is the one shape here the app did
    // not invent — a module whose whole point is one function is how JavaScript
    // has always said that — and it is what gives a script a return value to
    // show. Anything else: a file of top-level statements already ran on
    // import, which is the snippet shape.
    if (typeof mod.default === 'function') out = await call(mod.default, deps.page, req.ctx);

    // What a script returned is the thing being checked, so it goes to the panel
    // rather than being thrown away with the verdict.
    if (out !== undefined) deps.emit('log', describe(out));
    return done(true);
  } catch (err) {
    // The trace points at the temp module a person never wrote. Rewriting the
    // name back is what makes a line number usable.
    const message = asMessage(err).split(path.basename(file)).join(req.name);
    deps.emit('error', message);
    return done(false, message);
  } finally {
    releaseConsole();
    restore();
    // Even after a throw. A leftover would be imported by the next run and
    // would show up in the person's own file list.
    fs.rmSync(file, { force: true });
  }
}
