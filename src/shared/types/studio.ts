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

export const IDLE_SIDECAR: SidecarStatus = {
  phase: 'stopped',
  endpoint: null,
  pid: null,
  restarts: 0,
  lastError: null,
  retryInMs: null,
};
