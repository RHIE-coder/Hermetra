import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  StudioSession,
  type SessionBrowser,
  type SessionContext,
  type SessionPage,
} from '@main/services/studioSession';

/**
 * The pure half of the pipeline session: what to do with a browser once the
 * sidecar has one running. A browser is injected, so nothing here launches
 * Camoufox, opens a socket or touches disk.
 *
 * Spec: docs/spec/pipeline/jobs.md — `pipeline.session`.
 */

function fakePage(url = 'about:blank') {
  const page = {
    current: url,
    closed: false,
    fronted: 0,
    gotoFails: null as string | null,
    url: () => page.current,
    title: async () => `title of ${page.current}`,
    goto: async (to: string) => {
      if (page.gotoFails) throw new Error(page.gotoFails);
      page.current = to;
    },
    close: async () => { page.closed = true; },
    bringToFront: async () => { page.fronted += 1; },
  };
  return page;
}

function fakeBrowser() {
  const pages: ReturnType<typeof fakePage>[] = [];
  const context: SessionContext & { closed: boolean } = {
    closed: false,
    pages: () => pages.filter((p) => !p.closed) as unknown as SessionPage[],
    newPage: async () => { const p = fakePage(); pages.push(p); return p as unknown as SessionPage; },
    close: async () => { context.closed = true; },
  };
  const browser: SessionBrowser & { closed: boolean; context: typeof context } = {
    closed: false,
    context,
    newContext: async () => context,
    close: async () => { browser.closed = true; },
  };
  return browser;
}

function makeSession(over: { connect?: (endpoint: string) => Promise<SessionBrowser> } = {}) {
  const browsers: ReturnType<typeof fakeBrowser>[] = [];
  const endpoints: string[] = [];
  const connect =
    over.connect ??
    (async (endpoint: string) => {
      endpoints.push(endpoint);
      const b = fakeBrowser();
      browsers.push(b);
      return b;
    });
  let clock = 1000;
  const session = new StudioSession({ connect, now: () => (clock += 1) });
  return { session, browsers, endpoints };
}

describe('StudioSession — attaching to what the sidecar started', () => {
  it('starts detached with nothing open', () => {
    const { session } = makeSession();
    expect(session.status().phase).toBe('detached');
    expect(session.status().pages).toEqual([]);
  });

  it('attaches and opens one tab, so there is something to drive', async () => {
    const { session, endpoints } = makeSession();
    await session.attach('ws://x/1');

    expect(endpoints).toEqual(['ws://x/1']);
    expect(session.status().phase).toBe('attached');
    expect(session.status().endpoint).toBe('ws://x/1');
    expect(session.status().pages).toHaveLength(1);
    expect(session.status().pages[0]!.isActive).toBe(true);
  });

  it('reports a failed connect instead of throwing — the screen has to say it', async () => {
    const { session } = makeSession({
      connect: async () => { throw new Error('ECONNREFUSED'); },
    });
    await expect(session.attach('ws://dead/1')).resolves.toBeDefined();

    expect(session.status().phase).toBe('error');
    expect(session.status().lastError).toMatch(/ECONNREFUSED/);
    expect(session.status().pages).toEqual([]);
  });

  it('attaching again to the same endpoint is a no-op, not a second browser', async () => {
    const { session, endpoints } = makeSession();
    await session.attach('ws://x/1');
    await session.attach('ws://x/1');
    expect(endpoints).toEqual(['ws://x/1']);
  });

  it('a restarted sidecar means a new endpoint — it drops the old one and takes it', async () => {
    // The supervisor's backoff restarts hand out a different port every time.
    // Holding the dead one would show tabs that are gone.
    const { session, browsers, endpoints } = makeSession();
    await session.attach('ws://x/1');
    await session.attach('ws://x/2');

    expect(endpoints).toEqual(['ws://x/1', 'ws://x/2']);
    expect(browsers[0]!.closed).toBe(true);
    expect(session.status().endpoint).toBe('ws://x/2');
    expect(session.status().pages).toHaveLength(1);
  });

  it('detach closes what it opened and empties the tab list', async () => {
    const { session, browsers } = makeSession();
    await session.attach('ws://x/1');
    await session.detach();

    expect(browsers[0]!.context.closed).toBe(true);
    expect(browsers[0]!.closed).toBe(true);
    expect(session.status().phase).toBe('detached');
    expect(session.status().pages).toEqual([]);
    expect(session.status().endpoint).toBeNull();
  });

  it('lets go of a browser that arrived after the session was detached', async () => {
    // The sidecar can die inside the connect window. Adopting the late arrival
    // would leave a live browser in a session everything else calls detached.
    let release!: (b: SessionBrowser) => void;
    const late = fakeBrowser();
    const { session } = makeSession({
      connect: () => new Promise<SessionBrowser>((resolve) => { release = resolve; }),
    });

    const attaching = session.attach('ws://x/1');
    await session.detach();
    release(late);
    await attaching;

    expect(late.closed).toBe(true);
    expect(session.status().phase).toBe('detached');
    expect(session.status().pages).toEqual([]);
  });

  it('detach on a session that never attached is harmless', async () => {
    const { session } = makeSession();
    await expect(session.detach()).resolves.toBeUndefined();
    expect(session.status().phase).toBe('detached');
  });

  it('emits a status on every transition', async () => {
    const { session } = makeSession();
    const seen: string[] = [];
    session.on('status', (s) => seen.push(s.phase));
    await session.attach('ws://x/1');
    await session.detach();
    expect(seen).toEqual(['attaching', 'attached', 'detached']);
  });
});

describe('StudioSession — driving the tabs', () => {
  it('navigates the active tab and reports the new url', async () => {
    const { session } = makeSession();
    await session.attach('ws://x/1');
    const pages = await session.navigate('https://example.com');
    expect(pages[0]!.url).toBe('https://example.com');
  });

  it('assumes https for a bare host, the way a browser bar does', async () => {
    const { session } = makeSession();
    await session.attach('ws://x/1');
    const pages = await session.navigate('example.com');
    expect(pages[0]!.url).toBe('https://example.com');
  });

  it('keeps a failed navigation as a reportable error, not a dead session', async () => {
    const { session } = makeSession();
    await session.attach('ws://x/1');
    await session.navigate('https://ok.test');
    // The page refuses the next hop the way a timeout would.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (session as any).activePage().gotoFails = 'net::ERR_TIMED_OUT';
    await session.navigate('https://slow.test');

    expect(session.status().phase).toBe('attached');
    expect(session.status().lastError).toMatch(/ERR_TIMED_OUT/);
  });

  it('does nothing but say so when there is no browser', async () => {
    const { session } = makeSession();
    const pages = await session.navigate('https://example.com');
    expect(pages).toEqual([]);
    expect(session.status().phase).toBe('detached');
  });

  it('opens a new tab and makes it the active one', async () => {
    const { session } = makeSession();
    await session.attach('ws://x/1');
    const pages = await session.newTab('https://second.test');

    expect(pages).toHaveLength(2);
    expect(pages[1]!.isActive).toBe(true);
    expect(pages[1]!.url).toBe('https://second.test');
  });

  it('closing the active tab moves the mark rather than leaving it out of range', async () => {
    const { session } = makeSession();
    await session.attach('ws://x/1');
    await session.newTab();
    const pages = await session.closePage(1);

    expect(pages).toHaveLength(1);
    expect(pages[0]!.isActive).toBe(true);
  });

  it('ignores a tab index that is not there', async () => {
    const { session } = makeSession();
    await session.attach('ws://x/1');
    const pages = await session.closePage(9);
    expect(pages).toHaveLength(1);
  });

  it('setActive brings that tab forward', async () => {
    const { session } = makeSession();
    await session.attach('ws://x/1');
    await session.newTab();
    const pages = await session.setActive(0);
    expect(pages[0]!.isActive).toBe(true);
    expect(pages[1]!.isActive).toBe(false);
  });
});

describe('StudioSession — running a step against the live browser', () => {
  it('runs the source with the page in scope and reports success', async () => {
    const { session } = makeSession();
    await session.attach('ws://x/1');
    const result = await session.runStep(`await page.goto('https://ran.test');`);

    expect(result.ok).toBe(true);
    expect(session.status().pages[0]!.url).toBe('https://ran.test');
  });

  it('streams every log line while the step is still running', async () => {
    // The whole point of the workbench: a thirty-second step must not be a
    // thirty-second blank screen.
    const { session } = makeSession();
    await session.attach('ws://x/1');

    const lines: string[] = [];
    let sawFirstBeforeEnd = false;
    session.on('log', (l) => {
      lines.push(l.text);
      if (lines.length === 1) sawFirstBeforeEnd = !done;
    });

    let done = false;
    const running = session
      .runStep(`log('one'); await new Promise(r => setTimeout(r, 5)); log('two');`)
      .then((r) => { done = true; return r; });

    const result = await running;
    expect(sawFirstBeforeEnd).toBe(true);
    expect(lines).toEqual(['one', 'two']);
    expect(result.ok).toBe(true);
  });

  it('a step that throws is a failed run, not a lost session', async () => {
    const { session } = makeSession();
    await session.attach('ws://x/1');
    const result = await session.runStep(`throw new Error('selector missing');`);

    expect(result.ok).toBe(false);
    expect(result.output).toMatch(/selector missing/);
    expect(session.status().phase).toBe('attached'); // 브라우저는 살아 있다
  });

  it('emits the failure as a log line too, so the panel shows it in place', async () => {
    const { session } = makeSession();
    await session.attach('ws://x/1');
    const levels: string[] = [];
    session.on('log', (l) => levels.push(l.level));
    await session.runStep(`throw new Error('boom');`);
    expect(levels).toContain('error');
  });

  it('refuses to run with no browser and says what to do about it', async () => {
    const { session } = makeSession();
    const result = await session.runStep(`log('hi');`);
    expect(result.ok).toBe(false);
    expect(result.output).not.toBe('');
  });

  it('runs a stage-shaped script by calling what it exports', async () => {
    // The seed this screen ships exports `extract`. Wrapping a module in a
    // statement body throws `Unexpected token 'export'` before anything runs,
    // which made the default script the one script that could not be run.
    const { session } = makeSession();
    await session.attach('ws://x/1');
    const result = await session.runStep(
      `export async function extract(page) {
         await page.goto('https://stage.test');
         return [{ title: ' a ' }];
       }`,
    );

    expect(result.ok).toBe(true);
    expect(session.status().pages[0]!.url).toBe('https://stage.test');
  });

  it('hands the address bar to the script as ctx.url', async () => {
    const { session } = makeSession();
    await session.attach('ws://x/1');
    await session.runStep(
      `export async function extract(page, ctx) { await page.goto(ctx.url); }`,
      { url: 'https://from-the-bar.test' },
    );
    expect(session.status().pages[0]!.url).toBe('https://from-the-bar.test');
  });

  it('shows what the stage returned, since that is the thing being checked', async () => {
    const { session } = makeSession();
    await session.attach('ws://x/1');
    const lines: string[] = [];
    session.on('log', (l) => lines.push(l.text));
    await session.runStep(`export async function extract() { return [{ title: 'row' }]; }`);

    expect(lines.join('\n')).toMatch(/row/);
  });

  it('chains transform onto extract — that pair is the pipeline in miniature', async () => {
    const { session } = makeSession();
    await session.attach('ws://x/1');
    const lines: string[] = [];
    session.on('log', (l) => lines.push(l.text));
    await session.runStep(
      `export async function extract() { return [{ title: '  padded  ' }]; }
       export function transform(raw) { return raw.map((r) => ({ title: r.title.trim() })); }`,
    );

    const said = lines.join('\n');
    expect(said).toMatch(/"padded"/);
    expect(said).not.toMatch(/ {2}padded/);
  });

  it('leaves transform alone when there is nothing for it to transform', async () => {
    // Exported on its own it has no input. Calling it with undefined would turn
    // a fine script into a crash the author did not write.
    const { session } = makeSession();
    await session.attach('ws://x/1');
    const result = await session.runStep(`export function transform(raw) { return raw.length; }`);
    expect(result.ok).toBe(true);
  });

  it('still runs a plain snippet with no exports at all', async () => {
    const { session } = makeSession();
    await session.attach('ws://x/1');
    const lines: string[] = [];
    session.on('log', (l) => lines.push(l.text));
    const result = await session.runStep(`log('plain'); await page.goto('https://plain.test');`);

    expect(result.ok).toBe(true);
    expect(lines).toEqual(['plain']);
    expect(session.status().pages[0]!.url).toBe('https://plain.test');
  });

  it('accepts the other export shapes without treating them as stages', async () => {
    const { session } = makeSession();
    await session.attach('ws://x/1');
    const result = await session.runStep(
      `export const LIMIT = 3;
       export default function helper() { return LIMIT; }
       log('limit is ' + helper());`,
    );
    expect(result.ok).toBe(true);
  });

  it('tags every line of one run with the same id, so two runs do not interleave', async () => {
    const { session } = makeSession();
    await session.attach('ws://x/1');
    const ids = new Set<string>();
    session.on('log', (l) => ids.add(l.runId));

    await session.runStep(`log('a'); log('b');`);
    expect(ids.size).toBe(1);

    await session.runStep(`log('c');`);
    expect(ids.size).toBe(2);
  });
});

beforeEach(() => vi.restoreAllMocks());
