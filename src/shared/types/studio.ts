/**
 * Data pipeline — the fetch sidecar.
 *
 * The stealth browser (Camoufox) is launched by a **separate real-Node
 * process**, not by Electron. That is not a preference: `better-sqlite3`, which
 * `camoufox-js` depends on, ships a V8-ABI build that segfaults the moment it is
 * used under Electron's V8 — in the main process and under
 * `ELECTRON_RUN_AS_NODE` alike. Electron therefore never loads it; it only
 * speaks WebSocket to the browser the sidecar started.
 */

import type { BrowserPage } from './web';

/** Where the sidecar is in its life. */
export type SidecarPhase =
  /** Not running, and not trying to. */
  | 'stopped'
  /** Spawned, waiting for it to report an endpoint. */
  | 'starting'
  /** Reported an endpoint; the browser is connectable. */
  | 'ready'
  /** Died on its own. A restart may be pending — see `retryInMs`. */
  | 'crashed';

export interface SidecarStatus {
  phase: SidecarPhase;
  /** Playwright endpoint, present only while `ready`. */
  endpoint: string | null;
  pid: number | null;
  /**
   * Whether the browser this launched has a window. It survives stops and
   * restarts because it is the person's setting, not the run's — a crash that
   * quietly comes back invisible is a browser they think they are watching.
   */
  headless: boolean;
  /** Automatic restarts since the last clean start. Reset once it reaches `ready`. */
  restarts: number;
  /** Why it died, when it died. Kept while `crashed` so the screen can say it. */
  lastError: string | null;
  /**
   * Milliseconds until the pending automatic restart, or null when none is
   * scheduled — either it is running, or it has given up and needs a person.
   */
  retryInMs: number | null;
}

/** Where the app's connection to that browser is. */
export type StudioSessionPhase =
  /** No browser held. Either the sidecar is down, or nobody asked. */
  | 'detached'
  /** Connecting to a reported endpoint. */
  | 'attaching'
  /** Holding a browser; tabs are drivable. */
  | 'attached'
  /** The connect failed. `lastError` says why; the sidecar may still be fine. */
  | 'error';

export interface StudioSessionStatus {
  phase: StudioSessionPhase;
  /** The endpoint currently held. A restart hands out a different one. */
  endpoint: string | null;
  /**
   * The tabs, as the screen lists them. `BrowserPage` is reused rather than
   * cloned: a tab is a tab, and two identical shapes would drift apart.
   */
  pages: BrowserPage[];
  /** The last failure — a refused connect, or a navigation that timed out. */
  lastError: string | null;
}

export const IDLE_SESSION: StudioSessionStatus = {
  phase: 'detached',
  endpoint: null,
  pages: [],
  lastError: null,
};

/**
 * One line of output from a running step, sent as it happens.
 *
 * A step is allowed to take a minute; collecting its output and returning it at
 * the end would leave the screen blank for that minute, which is the opposite of
 * what this surface is for.
 */
export interface StudioLogLine {
  /** Which run this belongs to, so two runs cannot interleave into one story. */
  runId: string;
  at: number;
  level: 'log' | 'error';
  text: string;
}

export const IDLE_SIDECAR: SidecarStatus = {
  phase: 'stopped',
  endpoint: null,
  pid: null,
  headless: true,
  restarts: 0,
  lastError: null,
  retryInMs: null,
};
