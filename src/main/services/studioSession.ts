import { EventEmitter } from 'node:events';
import { IDLE_SESSION, type StudioSessionStatus } from '@shared/types/studio';
import type { BrowserPage, WebScriptRunResult } from '@shared/types/web';

/**
 * The pure half of the pipeline session: what to do with a browser once the
 * sidecar has one running.
 *
 * The sidecar reports an endpoint and stops there — this is what connects to it
 * and keeps the connection alive across every step a person runs. The browser is
 * injected rather than imported, which is what lets the whole state machine
 * (attach, re-attach onto a restarted sidecar, detach, a step that throws) be
 * tested without launching Camoufox. Same split as `sidecar/supervisor.ts`.
 *
 * The session outlives a run on purpose. A run that opened and closed its own
 * browser would throw away the login, the cookies and the page you were looking
 * at between one step and the next, which is the thing this surface exists to
 * avoid.
 */

/** The slice of a Playwright page this needs. */
export interface SessionPage {
  url(): string;
  title(): Promise<string>;
  goto(url: string, opts?: Record<string, unknown>): Promise<unknown>;
  close(): Promise<void>;
  bringToFront(): Promise<void>;
}

export interface SessionContext {
  pages(): SessionPage[];
  newPage(): Promise<SessionPage>;
  close(): Promise<void>;
}

export interface SessionBrowser {
  newContext(): Promise<SessionContext>;
  close(): Promise<void>;
}

export interface StudioSessionOptions {
  connect: (endpoint: string) => Promise<SessionBrowser>;
  /** Injected so log timestamps and run ids are deterministic under test. */
  now?: () => number;
}

/** A bare host typed into a browser bar means https, not a relative path. */
const absolute = (url: string) => (/^[a-z]+:\/\//i.test(url) ? url : `https://${url}`);

const asMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** What a stage-shaped script declares. `export` is stripped, names are kept. */
const EXPORT_DECL =
  /^[ \t]*export[ \t]+(?:default[ \t]+)?(?:async[ \t]+)?(?:function[ \t*]+|const[ \t]+|let[ \t]+|var[ \t]+|class[ \t]+)([A-Za-z_$][\w$]*)/gm;

/**
 * Two script shapes have to run here, and they are not the same shape.
 *
 * A snippet is a body — `await page.goto(…)` — tried against the live page. A
 * stage script is a module: it exports `extract` / `transform` for a pipeline
 * stage to reference. Running a module as a body throws `Unexpected token
 * 'export'` before a line of it executes, which is exactly what made the seed
 * the one script that could not be run.
 *
 * So `export` is stripped and the names it declared are remembered. The body
 * then runs as a body, and whatever it defined is called afterwards.
 *
 * `export { a, b }` leaves a block statement behind and declares nothing —
 * harmless, and nothing here needs its names.
 */
export function prepareStep(source: string): { body: string; exported: Set<string> } {
  const exported = new Set<string>();
  for (const hit of source.matchAll(EXPORT_DECL)) exported.add(hit[1]!);
  // Keep the leading whitespace: stripping it would shift a line out from under
  // a stack trace's column number.
  const body = source.replace(/^([ \t]*)export[ \t]+(?:default[ \t]+)?/gm, '$1');
  return { body, exported };
}

/** The scope a stage script is called with. Today: what is in the address bar. */
export interface StepContext {
  url?: string;
}

/** How much of a returned value goes to the panel before it stops being read. */
const MAX_RESULT_CHARS = 2000;

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

export class StudioSession extends EventEmitter {
  private opts: Required<StudioSessionOptions>;
  private state: StudioSessionStatus = { ...IDLE_SESSION };
  private browser: SessionBrowser | null = null;
  private context: SessionContext | null = null;
  private activeIndex = 0;
  /**
   * The endpoint we are supposed to be holding. A connect takes time, and the
   * sidecar can die inside that window — without this, the browser handed back
   * late would install itself into a session someone already let go of.
   */
  private wanted: string | null = null;

  constructor(options: StudioSessionOptions) {
    super();
    this.opts = { now: () => Date.now(), ...options };
  }

  status(): StudioSessionStatus {
    return { ...this.state, pages: this.state.pages.map((p) => ({ ...p })) };
  }

  private set(patch: Partial<StudioSessionStatus>): void {
    this.state = { ...this.state, ...patch };
    this.emit('status', this.status());
  }

  /**
   * Take the browser at `endpoint`.
   *
   * Attaching to the endpoint already held is a no-op — the sidecar re-announces
   * its status for reasons that have nothing to do with the browser, and each
   * one must not throw away the tabs. A *different* endpoint is a restarted
   * sidecar, and the old browser is gone whether or not we let go of it.
   */
  async attach(endpoint: string): Promise<StudioSessionStatus> {
    if (this.browser && this.state.endpoint === endpoint) return this.status();
    if (this.browser) await this.detach();

    this.wanted = endpoint;
    this.set({ phase: 'attaching', endpoint, lastError: null });
    try {
      const browser = await this.opts.connect(endpoint);
      const context = await browser.newContext();
      if (this.wanted !== endpoint) {
        // Detached (or re-pointed) while we were connecting. Let go of what just
        // arrived rather than adopting it.
        await context.close().catch(() => {});
        await browser.close().catch(() => {});
        return this.status();
      }
      this.browser = browser;
      this.context = context;
      // A session with no tab is a session nothing can be tried in.
      if (context.pages().length === 0) await context.newPage();
      this.activeIndex = 0;
      this.set({ phase: 'attached', endpoint, pages: this.collect(), lastError: null });
    } catch (err) {
      // Reported, not thrown: a refused connect is something the screen says.
      this.browser = null;
      this.context = null;
      this.set({ phase: 'error', endpoint: null, pages: [], lastError: asMessage(err) });
    }
    return this.status();
  }

  async detach(): Promise<void> {
    const { browser, context } = this;
    this.wanted = null;
    this.browser = null;
    this.context = null;
    this.activeIndex = 0;
    try {
      await context?.close();
    } catch {
      /* a browser that is already gone cannot be closed politely */
    }
    try {
      await browser?.close();
    } catch {
      /* same */
    }
    if (this.state.phase !== 'detached') {
      this.set({ ...IDLE_SESSION });
    }
  }

  private collect(): BrowserPage[] {
    const pages = this.context?.pages() ?? [];
    if (this.activeIndex >= pages.length) this.activeIndex = Math.max(0, pages.length - 1);
    return pages.map((p, index) => ({
      index,
      // Titles need a round trip each; the list is refreshed often enough that
      // paying for one per tab per refresh is not worth it. The url is the
      // identity a person reads here anyway.
      title: p.url(),
      url: p.url(),
      isActive: index === this.activeIndex,
    }));
  }

  private activePage(): SessionPage | null {
    const pages = this.context?.pages() ?? [];
    if (pages.length === 0) return null;
    if (this.activeIndex >= pages.length) this.activeIndex = pages.length - 1;
    return pages[this.activeIndex] ?? null;
  }

  async listPages(): Promise<BrowserPage[]> {
    return this.collect();
  }

  async navigate(url: string): Promise<BrowserPage[]> {
    const page = this.activePage();
    if (!page) return [];
    try {
      await page.goto(absolute(url), { waitUntil: 'domcontentloaded', timeout: 30_000 });
      this.set({ pages: this.collect(), lastError: null });
    } catch (err) {
      // The tab is still there and still usable — a timeout is a fact about one
      // navigation, not about the session.
      this.set({ pages: this.collect(), lastError: asMessage(err) });
    }
    return this.collect();
  }

  async newTab(url?: string): Promise<BrowserPage[]> {
    if (!this.context) return [];
    const page = await this.context.newPage();
    this.activeIndex = this.context.pages().length - 1;
    if (url) {
      try {
        await page.goto(absolute(url), { waitUntil: 'domcontentloaded', timeout: 30_000 });
      } catch (err) {
        this.set({ lastError: asMessage(err) });
      }
    }
    this.set({ pages: this.collect() });
    return this.collect();
  }

  async closePage(index: number): Promise<BrowserPage[]> {
    const pages = this.context?.pages() ?? [];
    if (index < 0 || index >= pages.length) return this.collect();
    try {
      await pages[index]!.close();
    } catch {
      /* already gone */
    }
    const remaining = this.context?.pages() ?? [];
    if (this.activeIndex >= remaining.length) this.activeIndex = Math.max(0, remaining.length - 1);
    this.set({ pages: this.collect() });
    return this.collect();
  }

  async setActive(index: number): Promise<BrowserPage[]> {
    const pages = this.context?.pages() ?? [];
    if (index < 0 || index >= pages.length) return this.collect();
    this.activeIndex = index;
    try {
      await pages[index]!.bringToFront();
    } catch {
      /* bringing a tab forward is a courtesy, not the operation */
    }
    this.set({ pages: this.collect() });
    return this.collect();
  }

  /**
   * Run one snippet against the live page.
   *
   * `log()` emits as it is called rather than accumulating, so the panel fills
   * while the step runs. The returned result is the verdict and the duration —
   * the story already arrived.
   *
   * The scope matches the Web side's `runScript` (`page`, `env`, `bus`, `log`)
   * so a snippet moves between the two surfaces unchanged, plus `ctx` for the
   * stage shape — see `prepareStep`.
   *
   * A script that exports `extract` gets it called with `(page, ctx)` after the
   * body has run, and `transform` is chained onto whatever that returned. That
   * pair is the pipeline in miniature, and running it here is how a stage gets
   * checked before anything references it.
   */
  async runStep(source: string, ctx: StepContext = {}): Promise<WebScriptRunResult> {
    const started = this.opts.now();
    const runId = `pipeline-${started}`;
    const page = this.activePage();

    const emit = (level: 'log' | 'error', text: string) =>
      this.emit('log', { runId, at: this.opts.now(), level, text });

    if (!page) {
      const output = 'No browser attached. Start the pipeline browser first.';
      emit('error', output);
      return { scriptId: runId, ok: false, durationMs: 0, output };
    }

    try {
      const { body, exported } = prepareStep(source);
      // `transform` only runs behind `extract`: on its own it has no input, and
      // calling it with undefined would turn a fine script into a crash its
      // author never wrote.
      const tail: string[] = [];
      if (exported.has('extract')) {
        tail.push('__out = await extract(page, ctx);');
        if (exported.has('transform')) tail.push('__out = await transform(__out);');
      }

      const fn = new Function(
        'page',
        'env',
        'bus',
        'log',
        'ctx',
        `return (async () => { let __out;\n${body}\n${tail.join('\n')}\nreturn __out; })();`,
      );
      const log = (...args: unknown[]) => emit('log', args.map((a) => String(a)).join(' '));
      const bus = {
        set: (k: string, v: string) => emit('log', `bus.set(${k}=${v})`),
        get: () => undefined,
      };
      const out = await fn(page, process.env, bus, log, ctx);
      // What a stage returned is the thing being checked, so it goes to the
      // panel rather than being thrown away with the verdict.
      if (out !== undefined) emit('log', describe(out));
      this.set({ pages: this.collect() });
      return {
        scriptId: runId,
        ok: true,
        durationMs: this.opts.now() - started,
        output: '',
      };
    } catch (err) {
      const message = asMessage(err);
      emit('error', message);
      this.set({ pages: this.collect() });
      return {
        scriptId: runId,
        ok: false,
        durationMs: this.opts.now() - started,
        output: message,
      };
    }
  }
}
