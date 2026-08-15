import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StudioSession, type StudioRpc } from '@main/services/studioSession';
import type { StudioLogLine } from '@shared/types/studio';
import type { SidecarCall } from '@main/sidecar/protocol';

/**
 * The session is what the screen talks to: a state machine over one request
 * channel. The browser is **not** here — it lives in the sidecar, because a
 * second Playwright client sees `contexts = 0` and would hand a script an empty
 * browser (`docs/spec/studio/browser.md` — `studio.session`).
 *
 * The channel is injected, so every branch below (attach, re-attach onto a
 * restarted sidecar, detach mid-connect, a step that throws) runs with no
 * process and no socket.
 */

type Sent = SidecarCall;

function fakeRpc(over: { fail?: string; hang?: boolean } = {}) {
  const sent: Sent[] = [];
  let pages = [{ index: 0, title: 'about:blank', url: 'about:blank', isActive: true }];
  let logTo: ((l: StudioLogLine) => void) | undefined;
  let release: (() => void) | undefined;

  const rpc: StudioRpc = {
    send: async (req) => {
      sent.push(req);
      if (over.hang) await new Promise<void>((r) => { release = r; });
      if (over.fail) throw new Error(over.fail);
      if (req.op === 'run') return { ok: true, error: '', durationMs: 4 };
      if (req.op === 'navigate') {
        pages = [{ index: 0, title: req.url, url: req.url, isActive: true }];
      }
      if (req.op === 'new-tab') {
        pages = [
          { ...pages[0]!, isActive: false },
          { index: 1, title: 'about:blank', url: 'about:blank', isActive: true },
        ];
      }
      return { pages };
    },
    onLog: (cb) => {
      logTo = cb;
      return () => { logTo = undefined; };
    },
  };

  return {
    rpc,
    sent,
    emitLog: (line: StudioLogLine) => logTo?.(line),
    release: () => release?.(),
    setPages: (p: typeof pages) => { pages = p; },
  };
}

function makeSession(over: Parameters<typeof fakeRpc>[0] = {}) {
  const wire = fakeRpc(over);
  return { ...wire, session: new StudioSession({ rpc: wire.rpc, now: () => 1000 }) };
}

describe('StudioSession — attaching', () => {
  it('starts detached, holding nothing', () => {
    const { session } = makeSession();
    expect(session.status()).toEqual({
      phase: 'detached',
      endpoint: null,
      pages: [],
      lastError: null,
    });
  });

  it('attaches to a reported endpoint and lists what is open', async () => {
    const { session, sent } = makeSession();
    const status = await session.attach('ws://x/1');

    expect(status.phase).toBe('attached');
    expect(status.endpoint).toBe('ws://x/1');
    expect(status.pages).toHaveLength(1);
    expect(sent).toEqual([{ op: 'pages' }]);
  });

  it('ignores a re-attach to the endpoint it already holds', async () => {
    // The sidecar re-announces its status for reasons that have nothing to do
    // with the browser, and each one must not throw the tabs away.
    const { session, sent } = makeSession();
    await session.attach('ws://x/1');
    await session.attach('ws://x/1');
    expect(sent).toHaveLength(1);
  });

  it('takes a different endpoint as a restarted sidecar and starts clean', async () => {
    const { session, sent } = makeSession();
    await session.attach('ws://x/1');
    await session.attach('ws://x/2');

    expect(session.status().endpoint).toBe('ws://x/2');
    expect(sent).toHaveLength(2);
  });

  it('reports a refused attach instead of throwing', async () => {
    const { session } = makeSession({ fail: 'connection refused' });
    const status = await session.attach('ws://x/1');

    expect(status.phase).toBe('error');
    expect(status.endpoint).toBeNull();
    expect(status.lastError).toContain('refused');
  });

  it('does not adopt a browser that arrives after it was let go', async () => {
    const { session, release } = makeSession({ hang: true });
    const attaching = session.attach('ws://x/1');
    await session.detach();
    release();
    await attaching;

    expect(session.status().phase).toBe('detached');
    expect(session.status().pages).toEqual([]);
  });

  it('emits a status update on every transition', async () => {
    const { session } = makeSession();
    const seen: string[] = [];
    session.on('status', (s) => seen.push(s.phase));
    await session.attach('ws://x/1');
    expect(seen).toEqual(['attaching', 'attached']);
  });
});

describe('StudioSession — driving the tabs', () => {
  it('sends what the screen asked for and keeps the answer', async () => {
    const { session, sent } = makeSession();
    await session.attach('ws://x/1');

    const pages = await session.navigate('https://naver.com');
    expect(pages[0]!.url).toBe('https://naver.com');
    expect(sent.at(-1)).toEqual({ op: 'navigate', url: 'https://naver.com' });
    expect(session.status().pages[0]!.url).toBe('https://naver.com');
  });

  it('keeps the tabs when a navigation fails, and says why', async () => {
    // A timeout is a fact about one navigation, not about the session.
    const wire = fakeRpc();
    const session = new StudioSession({
      rpc: {
        ...wire.rpc,
        send: async (req) =>
          req.op === 'navigate'
            ? { pages: [{ index: 0, title: 'a', url: 'a', isActive: true }], error: 'Timeout 30000ms' }
            : wire.rpc.send(req),
      },
    });
    await session.attach('ws://x/1');
    await session.navigate('https://slow.test');

    expect(session.status().phase).toBe('attached');
    expect(session.status().lastError).toContain('Timeout');
    expect(session.status().pages).toHaveLength(1);
  });

  it('does not ask the sidecar anything while nothing is attached', async () => {
    const { session, sent } = makeSession();
    expect(await session.navigate('https://x')).toEqual([]);
    expect(await session.newTab()).toEqual([]);
    expect(await session.closePage(0)).toEqual([]);
    expect(await session.setActive(0)).toEqual([]);
    expect(sent).toEqual([]);
  });

  it('forgets the tabs when it lets go', async () => {
    const { session } = makeSession();
    await session.attach('ws://x/1');
    await session.detach();
    expect(session.status()).toMatchObject({ phase: 'detached', endpoint: null, pages: [] });
  });
});

describe('StudioSession — running a step', () => {
  it('sends the script with where it lives, and stamps one run id', async () => {
    const { session, sent } = makeSession();
    await session.attach('ws://x/1');

    const result = await session.runStep({
      source: "log('hi')",
      dir: '/ws/scripts/studio',
      name: 'step.ts',
      url: 'https://naver.com',
    });

    const run = sent.find((r) => r.op === 'run') as { runId: string };
    expect(run).toMatchObject({
      op: 'run',
      dir: '/ws/scripts/studio',
      name: 'step.ts',
      source: "log('hi')",
      url: 'https://naver.com',
    });
    expect(result.ok).toBe(true);
    expect(result.scriptId).toBe(run.runId);
    // The script is allowed to navigate, so the tabs are re-read after it.
    expect(sent.at(-1)).toEqual({ op: 'pages' });
  });

  it('refuses to run with nothing attached, and says so in the panel', async () => {
    const { session, sent } = makeSession();
    const lines: string[] = [];
    session.on('log', (l: StudioLogLine) => lines.push(l.text));

    const result = await session.runStep({ source: '', dir: '/ws', name: 'a.ts' });

    expect(result.ok).toBe(false);
    expect(lines.join()).toMatch(/browser/i);
    expect(sent).toEqual([]);
  });

  it('reports a failed run without taking the session down with it', async () => {
    const { session } = makeSession({ fail: 'ReferenceError: pge is not defined' });
    const failing = new StudioSession({
      rpc: {
        send: async (req) => {
          if (req.op === 'pages') return { pages: [{ index: 0, title: 'a', url: 'a', isActive: true }] };
          throw new Error('ReferenceError: pge is not defined');
        },
        onLog: () => () => {},
      },
    });
    await failing.attach('ws://x/1');
    const result = await failing.runStep({ source: 'pge.goto()', dir: '/ws', name: 'a.ts' });

    expect(result.ok).toBe(false);
    expect(result.output).toContain('ReferenceError');
    expect(failing.status().phase).toBe('attached');
    void session;
  });

  it('passes the sidecar\'s log lines through as they arrive', async () => {
    const { session, emitLog } = makeSession();
    await session.attach('ws://x/1');

    const lines: StudioLogLine[] = [];
    session.on('log', (l: StudioLogLine) => lines.push(l));
    emitLog({ runId: 'r1', at: 5, level: 'log', text: 'from the script' });

    expect(lines).toEqual([{ runId: 'r1', at: 5, level: 'log', text: 'from the script' }]);
  });
});

beforeEach(() => vi.restoreAllMocks());
