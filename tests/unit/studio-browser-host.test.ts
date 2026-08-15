import { describe, it, expect } from 'vitest';
import { BrowserHost, type HostContext, type HostPage } from '@main/sidecar/host/browser';

/**
 * The tabs, as the sidecar holds them.
 *
 * This moved out of the Electron main process on 2026-08-13: a second
 * Playwright client sees `contexts = 0`, so the process running the user's
 * script has to be the one owning the tabs (`docs/spec/studio/browser.md` —
 * `studio.session`). The browser is injected, so nothing here launches one.
 */

function fakePage(url = 'about:blank') {
  const page = {
    current: url,
    closed: false,
    fronted: 0,
    gotoFails: null as string | null,
    frontFails: false,
    url: () => page.current,
    goto: async (to: string) => {
      if (page.gotoFails) throw new Error(page.gotoFails);
      page.current = to;
    },
    close: async () => { page.closed = true; },
    bringToFront: async () => {
      if (page.frontFails) throw new Error('cannot raise');
      page.fronted += 1;
    },
  };
  return page;
}

function makeHost(urls: string[] = ['about:blank']) {
  const pages = urls.map((u) => fakePage(u));
  const context: HostContext = {
    pages: () => pages.filter((p) => !p.closed) as unknown as HostPage[],
    newPage: async () => {
      const p = fakePage();
      pages.push(p);
      return p as unknown as HostPage;
    },
    close: async () => { for (const p of pages) p.closed = true; },
  };
  return { host: new BrowserHost(context), pages };
}

describe('BrowserHost — listing', () => {
  it('numbers the tabs and marks the active one', () => {
    const { host } = makeHost(['https://a.test', 'https://b.test']);
    expect(host.list()).toEqual([
      { index: 0, title: 'https://a.test', url: 'https://a.test', isActive: true },
      { index: 1, title: 'https://b.test', url: 'https://b.test', isActive: false },
    ]);
  });

  it('opens a tab when there is none, so there is something to try a script in', async () => {
    const { host } = makeHost([]);
    expect(host.list()).toEqual([]);
    await host.ensurePage();
    expect(host.list()).toHaveLength(1);
  });
});

describe('BrowserHost — navigating', () => {
  it('treats a bare host as https, the way an address bar does', async () => {
    const { host, pages } = makeHost();
    await host.navigate('naver.com');
    expect(pages[0]!.current).toBe('https://naver.com');
  });

  it('leaves an explicit scheme alone', async () => {
    const { host, pages } = makeHost();
    await host.navigate('http://insecure.test');
    expect(pages[0]!.current).toBe('http://insecure.test');
  });

  it('reports a failed navigation but keeps the tab', async () => {
    // A timeout is a fact about one navigation, not about the session.
    const { host, pages } = makeHost();
    pages[0]!.gotoFails = 'Timeout 30000ms exceeded';

    const reply = await host.navigate('https://slow.test');
    expect(reply.error).toContain('Timeout');
    expect(reply.pages).toHaveLength(1);
  });
});

describe('BrowserHost — tabs', () => {
  it('makes a new tab the active one', async () => {
    const { host } = makeHost(['https://a.test']);
    const reply = await host.newTab();
    expect(reply.pages).toHaveLength(2);
    expect(reply.pages[1]!.isActive).toBe(true);
  });

  it('navigates a new tab only when given somewhere to go', async () => {
    const { host, pages } = makeHost([]);
    await host.newTab();
    expect(pages[0]!.current).toBe('about:blank');

    await host.newTab('example.com');
    expect(pages[1]!.current).toBe('https://example.com');
  });

  it('closes a tab and keeps the active index inside the list', async () => {
    const { host, pages } = makeHost(['https://a.test', 'https://b.test']);
    await host.setActive(1);

    const reply = await host.closePage(1);
    expect(pages[1]!.closed).toBe(true);
    expect(reply.pages).toHaveLength(1);
    expect(reply.pages[0]!.isActive).toBe(true);
  });

  it('ignores an index that is not a tab', async () => {
    const { host } = makeHost(['https://a.test']);
    expect((await host.closePage(9)).pages).toHaveLength(1);
    expect((await host.setActive(-1)).pages[0]!.isActive).toBe(true);
  });

  it('raises the tab it activates, and survives a browser that will not', async () => {
    const { host, pages } = makeHost(['https://a.test', 'https://b.test']);
    await host.setActive(1);
    expect(pages[1]!.fronted).toBe(1);

    pages[0]!.frontFails = true;
    // Bringing a tab forward is a courtesy, not the operation.
    const reply = await host.setActive(0);
    expect(reply.pages[0]!.isActive).toBe(true);
  });
});
