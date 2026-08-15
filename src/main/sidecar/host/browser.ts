import type { BrowserPage } from '@shared/types/web';
import type { PagesReply } from '../protocol.ts';

/**
 * The tabs, held where the script runs.
 *
 * This used to live in the Electron main process, holding a Playwright client
 * of its own. It cannot: a second client connected to the same browser server
 * sees `contexts = 0`, so a script running out here would be handed an empty
 * browser instead of the tab the person is looking at
 * (`docs/spec/studio/browser.md` — `studio.session`).
 *
 * The context is injected, exactly like the supervisor's process handle, so all
 * of this is testable without launching Camoufox.
 */

/** The slice of a Playwright page this needs. */
export interface HostPage {
  url(): string;
  goto(url: string, opts?: Record<string, unknown>): Promise<unknown>;
  close(): Promise<void>;
  bringToFront(): Promise<void>;
}

export interface HostContext {
  pages(): HostPage[];
  newPage(): Promise<HostPage>;
  close(): Promise<void>;
}

/** A bare host typed into a browser bar means https, not a relative path. */
const absolute = (url: string) => (/^[a-z]+:\/\//i.test(url) ? url : `https://${url}`);

const asMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

const GOTO = { waitUntil: 'domcontentloaded', timeout: 30_000 } as const;

export class BrowserHost {
  private activeIndex = 0;
  private context: HostContext;
  private browser: unknown;

  // A plain assignment, not a parameter property: this file is loaded by a
  // runtime that only *strips* types, and a parameter property is syntax that
  // would have to be compiled. See `erasableSyntaxOnly` in tsconfig.node.json.
  constructor(context: HostContext, browser?: unknown) {
    this.context = context;
    this.browser = browser ?? null;
  }

  /**
   * What a script gets besides the active tab.
   *
   * A person writing Playwright reaches for `context.newPage()` without being
   * told to. Handing these over is what makes the documentation they already
   * know apply here.
   */
  handles(): { context: unknown; browser: unknown } {
    return { context: this.context, browser: this.browser };
  }

  list(): BrowserPage[] {
    const pages = this.context.pages();
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

  private reply(error?: string): PagesReply {
    return error ? { pages: this.list(), error } : { pages: this.list() };
  }

  /** A session with no tab is a session nothing can be tried in. */
  async ensurePage(): Promise<PagesReply> {
    if (this.context.pages().length === 0) await this.context.newPage();
    return this.reply();
  }

  activePage(): HostPage | null {
    const pages = this.context.pages();
    if (pages.length === 0) return null;
    if (this.activeIndex >= pages.length) this.activeIndex = pages.length - 1;
    return pages[this.activeIndex] ?? null;
  }

  async navigate(url: string): Promise<PagesReply> {
    const page = this.activePage();
    if (!page) return this.reply();
    try {
      await page.goto(absolute(url), GOTO);
      return this.reply();
    } catch (err) {
      // The tab is still there and still usable — a timeout is a fact about one
      // navigation, not about the session.
      return this.reply(asMessage(err));
    }
  }

  async newTab(url?: string): Promise<PagesReply> {
    const page = await this.context.newPage();
    this.activeIndex = this.context.pages().length - 1;
    if (!url) return this.reply();
    try {
      await page.goto(absolute(url), GOTO);
      return this.reply();
    } catch (err) {
      return this.reply(asMessage(err));
    }
  }

  async closePage(index: number): Promise<PagesReply> {
    const pages = this.context.pages();
    if (index < 0 || index >= pages.length) return this.reply();
    try {
      await pages[index]!.close();
    } catch {
      /* already gone */
    }
    const remaining = this.context.pages();
    if (this.activeIndex >= remaining.length) this.activeIndex = Math.max(0, remaining.length - 1);
    return this.reply();
  }

  async setActive(index: number): Promise<PagesReply> {
    const pages = this.context.pages();
    if (index < 0 || index >= pages.length) return this.reply();
    this.activeIndex = index;
    try {
      await pages[index]!.bringToFront();
    } catch {
      /* bringing a tab forward is a courtesy, not the operation */
    }
    return this.reply();
  }
}
