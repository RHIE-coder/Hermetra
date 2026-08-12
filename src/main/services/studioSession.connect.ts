import {
  StudioSession,
  type SessionBrowser,
  type SessionContext,
  type SessionPage,
} from './studioSession';

/**
 * The infrastructure half of the pipeline session: how to actually reach the
 * browser the sidecar started.
 *
 * Playwright's client is plain JavaScript over a WebSocket, so it runs in the
 * Electron main process without trouble. The dependency that cannot — the
 * V8-ABI `better-sqlite3` under `camoufox-js` — stays in the sidecar's Node
 * child and is never imported here. **Firefox**, not Chromium: Camoufox is a
 * patched Firefox build, so a Chromium client would not speak to it.
 */

const isMockMode = () => process.env.HERMETRA_DRIVERS === 'mock';

/**
 * A browser that is not one, for `HERMETRA_DRIVERS=mock`.
 *
 * e2e and the screenshot adapter both run with mock drivers, and a workbench
 * that could only be clicked with Camoufox installed would be a screen no
 * automated check ever opens.
 */
function mockBrowser(): SessionBrowser {
  const make = (): SessionPage & { current: string; closed: boolean } => {
    const page = {
      current: 'about:blank',
      closed: false,
      url: () => page.current,
      title: async () => page.current,
      goto: async (to: string) => { page.current = to; },
      close: async () => { page.closed = true; },
      bringToFront: async () => {},
      // Beyond what `SessionPage` needs: a step script holds the raw page, and
      // a mock that cannot run the script this app ships is a mock that cannot
      // verify this screen. An empty page finds nothing, which is the truth.
      $: async () => null,
      $$: async () => [],
      $$eval: async () => [],
      $eval: async () => undefined,
      content: async () => '',
      evaluate: async () => undefined,
      waitForTimeout: async () => {},
    };
    return page;
  };

  const pages = [make()];
  const context: SessionContext = {
    pages: () => pages.filter((p) => !p.closed),
    newPage: async () => { const p = make(); pages.push(p); return p; },
    close: async () => { for (const p of pages) p.closed = true; },
  };

  return {
    newContext: async () => context,
    close: async () => {},
  };
}

export function createStudioSession(): StudioSession {
  return new StudioSession({
    connect: async (endpoint) => {
      if (isMockMode()) return mockBrowser();
      const { firefox } = await import('playwright');
      const browser = await firefox.connect({ wsEndpoint: endpoint });
      return browser as unknown as SessionBrowser;
    },
  });
}
