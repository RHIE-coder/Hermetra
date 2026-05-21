import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import type { WebDriver } from '../types';
import type {
  BrowserPage,
  RemoteBrowserStatus,
  WebScriptRunResult,
} from '@shared/types/web';

interface BrowserServer {
  wsEndpoint: () => string;
  close: () => Promise<void>;
}

interface Browser {
  newContext: (opts: Record<string, unknown>) => Promise<BrowserContext>;
  close: () => Promise<void>;
}

interface BrowserContext {
  pages: () => PWPage[];
  newPage: () => Promise<PWPage>;
  addInitScript: (script: string | { content: string } | ((...args: unknown[]) => unknown)) => Promise<void>;
  setExtraHTTPHeaders: (headers: Record<string, string>) => Promise<void>;
  close: () => Promise<void>;
}

interface PWPage {
  url: () => string;
  title: () => Promise<string>;
  goto: (url: string, opts?: Record<string, unknown>) => Promise<unknown>;
  close: () => Promise<void>;
  bringToFront: () => Promise<void>;
}

interface ChromiumEngine {
  launchServer: (opts: Record<string, unknown>) => Promise<BrowserServer>;
  connect: (opts: { wsEndpoint: string }) => Promise<Browser>;
  executablePath?: () => string;
}

interface PlaywrightModule {
  chromium: ChromiumEngine;
}

const tryLoadPlaywright = async (): Promise<PlaywrightModule | null> => {
  try {
    return (await import('playwright')) as unknown as PlaywrightModule;
  } catch {
    return null;
  }
};

/**
 * Anti-detection options applied at launch + context level.
 * - Stealth args remove the most obvious automation signals exposed by Chromium.
 * - `addInitScript` patches the few JS-visible flags (`navigator.webdriver`,
 *   plugins length, chrome runtime, languages) that bot-detection sniffs first.
 */
const STEALTH_ARGS = [
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-blink-features=AutomationControlled',
  '--disable-features=IsolateOrigins,site-per-process,AutomationControlled',
  '--disable-infobars',
  '--window-size=1280,800',
];

const STEALTH_INIT_SCRIPT = `
(() => {
  try {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  } catch (_) {}
  try {
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  } catch (_) {}
  try {
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'PDF Viewer', filename: 'internal-pdf-viewer' },
        { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer' },
        { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer' },
      ],
    });
  } catch (_) {}
  try {
    // Real Chrome exposes window.chrome with runtime metadata.
    if (!window.chrome) {
      Object.defineProperty(window, 'chrome', { value: { runtime: {} } });
    }
  } catch (_) {}
  try {
    const origQuery = navigator.permissions && navigator.permissions.query;
    if (origQuery) {
      navigator.permissions.query = (params) => {
        if (params && params.name === 'notifications') {
          return Promise.resolve({ state: Notification && Notification.permission, name: 'notifications' });
        }
        return origQuery.call(navigator.permissions, params);
      };
    }
  } catch (_) {}
})();
`;

export function createPlaywrightWebDriver(): WebDriver {
  const emitter = new EventEmitter();
  let pw: PlaywrightModule | null = null;
  let server: BrowserServer | null = null;
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let port = 9222;
  let driverHint: string | undefined;
  let activeIndex = 0;

  const status = (): RemoteBrowserStatus => ({
    isRunning: !!server,
    port,
    wsEndpoint: server ? server.wsEndpoint() : null,
    driverAvailable: !!pw,
    driverHint,
  });

  const broadcast = () => emitter.emit('change');

  const ensureLoaded = async () => {
    if (pw) return pw;
    pw = await tryLoadPlaywright();
    if (!pw) {
      driverHint =
        'Playwright이 로드되지 않았습니다. `npm install playwright` 후 다시 시도해 주세요.';
    }
    return pw;
  };

  /**
   * Verify the Playwright-pinned Chromium build exists on disk.
   * Returns the path if it's there, otherwise a hint string explaining
   * which exact path is missing (so the install panel can show it).
   */
  const verifyChromium = (lib: PlaywrightModule): { ok: true } | { ok: false; expected: string } => {
    let expected = '';
    try {
      if (lib.chromium.executablePath) expected = lib.chromium.executablePath();
    } catch {
      /* throws when build hasn't been downloaded */
    }
    if (!expected) return { ok: false, expected: '(unknown — Playwright did not resolve a path)' };
    return fs.existsSync(expected) ? { ok: true } : { ok: false, expected };
  };

  const collectPages = async (): Promise<BrowserPage[]> => {
    if (!context) return [];
    const pages = context.pages();
    if (activeIndex >= pages.length) activeIndex = Math.max(0, pages.length - 1);
    const result: BrowserPage[] = [];
    for (let i = 0; i < pages.length; i++) {
      let url = '';
      let title = '';
      try {
        url = pages[i].url();
        title = await pages[i].title();
      } catch {
        /* page may have been closed mid-iteration */
      }
      result.push({
        index: i,
        url,
        title: title || '(untitled)',
        isActive: i === activeIndex,
      });
    }
    return result;
  };

  const activePage = (): PWPage | null => {
    if (!context) return null;
    const pages = context.pages();
    if (pages.length === 0) return null;
    if (activeIndex < 0 || activeIndex >= pages.length) activeIndex = pages.length - 1;
    return pages[activeIndex];
  };

  return {
    async status() {
      await ensureLoaded();
      return status();
    },

    async start(p: number) {
      port = p || 9222;
      const lib = await ensureLoaded();
      if (!lib) return status();
      if (server) return status();

      const check = verifyChromium(lib);
      if (!check.ok) {
        driverHint = `Chromium 바이너리가 없습니다. "Chromium 설치"를 눌러 한 번만 받으세요.\n예상 경로: ${check.expected}`;
        broadcast();
        return status();
      }

      try {
        server = await lib.chromium.launchServer({
          headless: false,
          host: '127.0.0.1',
          port,
          args: STEALTH_ARGS,
          ignoreDefaultArgs: ['--enable-automation'],
        });
        const wsEndpoint = server.wsEndpoint();
        browser = await lib.chromium.connect({ wsEndpoint });
        context = await browser.newContext({
          viewport: null,
          locale: 'en-US',
          timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
          userAgent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        });
        await context.addInitScript({ content: STEALTH_INIT_SCRIPT });
        await context.newPage();
        activeIndex = 0;
        driverHint = undefined;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Treat the well-known Playwright "Executable doesn't exist" error as
        // a missing-install case so the UI can guide users to the install panel.
        if (/Executable doesn't exist/i.test(msg) || /\bplease run\b.*\bplaywright install\b/i.test(msg)) {
          const m = msg.match(/Executable doesn't exist at\s+(\S+)/i);
          const expected = m?.[1] ?? '';
          driverHint = expected
            ? `Chromium 바이너리가 없습니다. "Chromium 설치"를 눌러 한 번만 받으세요.\n예상 경로: ${expected}`
            : '브라우저 바이너리가 누락되었습니다. "Chromium 설치"를 눌러 주세요.';
        } else {
          driverHint = msg;
        }
        if (server) {
          try {
            await server.close();
          } catch {
            /* noop */
          }
        }
        server = null;
        browser = null;
        context = null;
      }
      broadcast();
      return status();
    },

    async stop() {
      try {
        if (context) await context.close();
      } catch {
        /* noop */
      }
      context = null;
      try {
        if (browser) await browser.close();
      } catch {
        /* noop */
      }
      browser = null;
      try {
        if (server) await server.close();
      } catch {
        /* noop */
      }
      server = null;
      activeIndex = 0;
      broadcast();
      return status();
    },

    async listPages() {
      return collectPages();
    },

    async navigate(url: string) {
      if (!context) return [];
      const page = activePage();
      if (!page) return collectPages();
      const target = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      try {
        await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 15000 });
      } catch (err) {
        driverHint = err instanceof Error ? err.message : String(err);
      }
      broadcast();
      return collectPages();
    },

    async newTab(url?: string) {
      if (!context) return [];
      const page = await context.newPage();
      activeIndex = context.pages().length - 1;
      if (url) {
        const target = /^https?:\/\//i.test(url) ? url : `https://${url}`;
        try {
          await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 15000 });
        } catch {
          /* surfaced in UI on next refresh */
        }
      }
      broadcast();
      return collectPages();
    },

    async closePage(index: number) {
      if (!context) return [];
      const pages = context.pages();
      if (index < 0 || index >= pages.length) return collectPages();
      try {
        await pages[index].close();
      } catch {
        /* noop */
      }
      const remaining = context.pages();
      if (remaining.length === 0) activeIndex = 0;
      else if (activeIndex >= remaining.length) activeIndex = remaining.length - 1;
      broadcast();
      return collectPages();
    },

    async setActive(index: number) {
      if (!context) return [];
      const pages = context.pages();
      if (index < 0 || index >= pages.length) return collectPages();
      activeIndex = index;
      try {
        await pages[index].bringToFront();
      } catch {
        /* noop */
      }
      broadcast();
      return collectPages();
    },

    async runScript(source: string): Promise<WebScriptRunResult> {
      const started = Date.now();
      const id = `web-${started}`;
      const page = activePage();
      if (!page) {
        return {
          scriptId: id,
          ok: false,
          durationMs: Date.now() - started,
          output: '브라우저에 열린 탭이 없습니다. 먼저 브라우저를 띄우고 탭을 열어주세요.',
        };
      }
      const logs: string[] = [];
      try {
        const fn = new Function(
          'page',
          'env',
          'bus',
          'log',
          `return (async () => { ${source} \n })();`,
        );
        const env = process.env;
        const bus = {
          set: (k: string, v: string) => logs.push(`bus.set(${k}=${v})`),
          get: () => undefined,
        };
        const log = (...args: unknown[]) => logs.push(args.map((a) => String(a)).join(' '));
        await fn(page, env, bus, log);
        return {
          scriptId: id,
          ok: true,
          durationMs: Date.now() - started,
          output: logs.length ? logs.join('\n') : '스크립트가 성공적으로 실행되었습니다.',
        };
      } catch (err) {
        return {
          scriptId: id,
          ok: false,
          durationMs: Date.now() - started,
          output: `실행 중 오류: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },

    onChange(handler) {
      emitter.on('change', handler);
      return () => emitter.off('change', handler);
    },
  };
}
