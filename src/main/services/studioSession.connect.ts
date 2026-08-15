import { StudioSession } from './studioSession';
import { createRpc, type RpcTransport } from './studioRpc';
import { decodeFrame, type SidecarFrame } from '../sidecar/protocol';
import { BrowserHost, type HostContext, type HostPage } from '../sidecar/host/browser';
import { createDispatcher } from '../sidecar/host/serve';
import type { SidecarSupervisor } from '../sidecar/supervisor';

/**
 * The infrastructure half: which sidecar the session talks to.
 *
 * There are two transports and they are not alike. The real one is the spawned
 * child, holding Camoufox. The mock one is the **same dispatcher** called in
 * this process over a browser that is not one — e2e and the screenshot adapter
 * both run under `HERMETRA_DRIVERS=mock`, and a workbench that could only be
 * clicked with Camoufox installed would be a screen no automated check opens.
 *
 * Reusing the dispatcher rather than faking replies is deliberate: it is what
 * makes "the script the app ships actually runs" a thing a test can assert
 * (`AC-studio.browser-17`).
 */

const isMockMode = () => process.env.HERMETRA_DRIVERS === 'mock';

/** The spawned sidecar: requests down stdin, frames back up stdout. */
function sidecarTransport(sidecar: SidecarSupervisor): RpcTransport {
  return {
    send: (request) => sidecar.send(request),
    onFrame: (cb) => sidecar.on('frame', cb),
    onGone: (cb) =>
      sidecar.on('status', (status: { phase: string; lastError: string | null }) => {
        // Anything that is not a live child means the answers are not coming.
        if (status.phase === 'crashed' || status.phase === 'stopped') {
          cb(status.lastError ?? 'The workbench browser stopped.');
        }
      }),
  };
}

/**
 * A page that is not one.
 *
 * It answers the handful of calls a script makes without a browser behind them,
 * because a mock that cannot run the script this app ships is a mock that cannot
 * verify this screen.
 */
function mockPage(): HostPage {
  const page = {
    current: 'about:blank',
    closed: false,
    url: () => page.current,
    goto: async (to: string) => { page.current = to; },
    close: async () => { page.closed = true; },
    bringToFront: async () => {},
    title: async () => page.current,
    $: async () => null,
    $$: async () => [],
    $$eval: async () => [],
    $eval: async () => undefined,
    content: async () => '',
    evaluate: async () => undefined,
    waitForTimeout: async () => {},
  };
  return page as unknown as HostPage;
}

function mockTransport(): RpcTransport {
  const pages: (HostPage & { closed?: boolean })[] = [];
  const context: HostContext = {
    pages: () => pages.filter((p) => !p.closed),
    newPage: async () => {
      const p = mockPage() as HostPage & { closed?: boolean };
      pages.push(p);
      return p;
    },
    close: async () => { for (const p of pages) p.closed = true; },
  };

  let onFrame: ((frame: SidecarFrame) => void) | undefined;
  const dispatch = createDispatcher({
    host: new BrowserHost(context),
    write: (line) => {
      const frame = decodeFrame(line.trim());
      if (frame) onFrame?.(frame);
    },
  });

  return {
    send: (request) => {
      void dispatch(JSON.stringify(request));
      return true;
    },
    onFrame: (cb) => { onFrame = cb; },
    // Nothing to die: it is this process.
    onGone: () => {},
  };
}

export function createStudioSession(sidecar?: SidecarSupervisor): StudioSession {
  const transport = !sidecar || isMockMode() ? mockTransport() : sidecarTransport(sidecar);
  return new StudioSession({ rpc: createRpc(transport) });
}
