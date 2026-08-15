import { decodeRequest, encodeLine, type SidecarRequest } from '../protocol.ts';
import { runModule, type RunDeps, type RunRequest } from './runner.ts';
import type { BrowserHost } from './browser.ts';

/**
 * One request in, frames out.
 *
 * The dispatcher is what the launcher's stdin loop calls, and it is written
 * against injected pieces so the whole protocol can be exercised without a
 * process, a socket or a browser.
 */

export interface DispatcherDeps {
  host: BrowserHost;
  /** One encoded frame onto stdout. */
  write: (line: string) => void;
  run?: (req: RunRequest, deps: RunDeps) => Promise<{ ok: boolean; error: string; durationMs: number }>;
  now?: () => number;
}

export function createDispatcher(deps: DispatcherDeps): (line: string) => Promise<void> {
  const now = deps.now ?? (() => Date.now());
  const run = deps.run ?? runModule;
  let running = false;

  const send = (frame: unknown) => deps.write(encodeLine(frame));

  const perform = async (req: SidecarRequest): Promise<unknown> => {
    switch (req.op) {
      case 'pages':
        return deps.host.ensurePage();
      case 'navigate':
        return deps.host.navigate(req.url);
      case 'new-tab':
        return deps.host.newTab(req.url);
      case 'close-page':
        return deps.host.closePage(req.index);
      case 'set-active':
        return deps.host.setActive(req.index);
      case 'run': {
        // Two scripts at once would fight over the injected globals and
        // interleave into one transcript. Refusing is the honest answer.
        if (running) throw new Error('A script is already running.');
        running = true;
        try {
          return await run(
            {
              runId: req.runId,
              dir: req.dir,
              name: req.name,
              source: req.source,
              ctx: req.url ? { url: req.url } : {},
            },
            {
              page: deps.host.activePage(),
              ...deps.host.handles(),
              // Streamed as they happen: a step is allowed to take a minute, and
              // collecting its output until the end leaves the panel blank for
              // that minute.
              emit: (level, text) => send({ t: 'log', runId: req.runId, at: now(), level, text }),
            },
          );
        } finally {
          running = false;
        }
      }
    }
  };

  return async (line: string) => {
    const req = decodeRequest(line);
    // stdin is a pipe anyone could write to, and a line this build does not
    // understand is noise. Answering it would invent an id nobody is waiting on.
    if (!req) return;

    try {
      send({ t: 'reply', id: req.id, ok: true, value: await perform(req) });
    } catch (err) {
      // A failed operation is a reply, never a dead sidecar. The browser it
      // holds is worth more than any one request.
      send({
        t: 'reply',
        id: req.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };
}
