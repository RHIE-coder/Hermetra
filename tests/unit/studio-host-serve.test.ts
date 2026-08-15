import { describe, it, expect, beforeEach } from 'vitest';
import { createDispatcher } from '@main/sidecar/host/serve';
import { BrowserHost, type HostContext, type HostPage } from '@main/sidecar/host/browser';
import { decodeFrame, encodeLine, type SidecarFrame, type SidecarRequest } from '@main/sidecar/protocol';

/**
 * The sidecar's half of the wire: a request in, frames out.
 *
 * Spec: docs/spec/studio/README.md — `studio.sidecar` 계약.
 */

function fakePage(url = 'https://a.test') {
  return {
    url: () => url,
    goto: async () => {},
    close: async () => {},
    bringToFront: async () => {},
  } as unknown as HostPage;
}

function makeDispatcher(over: { run?: unknown } = {}) {
  const pages = [fakePage()];
  const context: HostContext = {
    pages: () => pages,
    newPage: async () => fakePage('about:blank'),
    close: async () => {},
  };
  const out: SidecarFrame[] = [];
  const runs: unknown[] = [];

  const dispatch = createDispatcher({
    host: new BrowserHost(context),
    write: (line) => {
      const frame = decodeFrame(line.trim());
      if (frame) out.push(frame);
    },
    run:
      (over.run as never) ??
      (async (req: { runId: string }, deps: { emit: (l: 'log' | 'error', t: string) => void }) => {
        runs.push(req);
        deps.emit('log', 'from the script');
        return { ok: true, error: '', durationMs: 3 };
      }),
  });

  const send = (req: SidecarRequest) => dispatch(encodeLine(req).trim());
  return { send, dispatch, out, runs };
}

let d: ReturnType<typeof makeDispatcher>;
beforeEach(() => { d = makeDispatcher(); });

describe('the sidecar dispatcher', () => {
  it('answers a tab request with the list', async () => {
    await d.send({ id: 1, op: 'pages' });
    expect(d.out).toEqual([
      {
        t: 'reply',
        id: 1,
        ok: true,
        value: { pages: [{ index: 0, title: 'https://a.test', url: 'https://a.test', isActive: true }] },
      },
    ]);
  });

  it('says nothing at all to a line it cannot read', async () => {
    // stdin is a pipe someone else may write to. Noise is dropped, not answered.
    await d.dispatch('[camoufox] downloading');
    await d.dispatch('{"id":1,"op":"launch-missiles"}');
    expect(d.out).toEqual([]);
  });

  it('streams a run\'s log lines before its verdict', async () => {
    await d.send({
      id: 2,
      op: 'run',
      runId: 'r7',
      dir: '/tmp/scripts',
      name: 'step.ts',
      source: "log('x')",
      url: 'https://naver.com',
    });

    expect(d.out.map((f) => f.t)).toEqual(['log', 'reply']);
    expect(d.out[0]).toMatchObject({ t: 'log', runId: 'r7', level: 'log', text: 'from the script' });
    expect(d.out[1]).toMatchObject({ t: 'reply', id: 2, ok: true });
  });

  it('hands the run the address bar as ctx', async () => {
    await d.send({
      id: 3,
      op: 'run',
      runId: 'r8',
      dir: '/tmp/scripts',
      name: 'step.ts',
      source: '',
      url: 'https://naver.com',
    });
    expect(d.runs[0]).toMatchObject({ ctx: { url: 'https://naver.com' } });
  });

  it('refuses a second run while one is still going', async () => {
    // Two scripts in one process would fight over the injected globals and
    // interleave into one transcript.
    let release = () => {};
    const slow = makeDispatcher({
      run: async () => {
        await new Promise<void>((r) => { release = r; });
        return { ok: true, error: '', durationMs: 1 };
      },
    });
    const req = { op: 'run', runId: 'r1', dir: '/tmp', name: 'a.ts', source: '' } as const;

    const first = slow.send({ id: 1, ...req });
    await slow.send({ id: 2, ...req, runId: 'r2' });

    expect(slow.out).toEqual([
      { t: 'reply', id: 2, ok: false, error: 'A script is already running.' },
    ]);
    release();
    await first;
    expect(slow.out.at(-1)).toMatchObject({ t: 'reply', id: 1, ok: true });
  });

  it('turns a thrown operation into a failed reply, not a dead sidecar', async () => {
    const broken = makeDispatcher({ run: async () => { throw new Error('boom'); } });
    await broken.send({ id: 4, op: 'run', runId: 'r9', dir: '/tmp', name: 'a.ts', source: '' });
    expect(broken.out).toEqual([{ t: 'reply', id: 4, ok: false, error: 'boom' }]);
  });
});
