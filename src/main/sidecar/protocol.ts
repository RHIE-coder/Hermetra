import type { BrowserPage } from '@shared/types/web';

/**
 * The wire between Electron main and the sidecar.
 *
 * The sidecar does not just announce a browser and stop — it **owns** the
 * browser, the tabs and the user's running script (`docs/spec/studio/browser.md`
 * — `studio.session` records the measurement that forced this). So stdout
 * carries requests' replies and streamed log lines alongside the endpoint, and
 * the rule that keeps that readable is: **one JSON object per line, or noise.**
 *
 * This file is the one thing both sides import. It is deliberately free of
 * dependencies and of anything Electron: the sidecar copy is loaded as source by
 * a real Node runtime, so a `node:`-only import here would be fine but an
 * Electron one would kill the child. Types are imported with `import type` so
 * type stripping erases them — nothing here resolves an alias at runtime.
 */

/** What the sidecar can be asked to do. `run` is the reason this exists. */
export type SidecarRequest =
  | { id: number; op: 'pages' }
  | { id: number; op: 'navigate'; url: string }
  | { id: number; op: 'new-tab'; url?: string }
  | { id: number; op: 'close-page'; index: number }
  | { id: number; op: 'set-active'; index: number }
  | { id: number; op: 'run'; runId: string; dir: string; name: string; source: string; url?: string };

export type SidecarOp = SidecarRequest['op'];

/**
 * A request before it is numbered — what a caller actually writes.
 *
 * Distributive on purpose: a plain `Omit` over a union keeps only the keys every
 * member shares, which would quietly reduce this to `{ op }` and let a
 * `navigate` go out with no url.
 */
export type SidecarCall = SidecarRequest extends infer T
  ? T extends SidecarRequest
    ? Omit<T, 'id'>
    : never
  : never;

const OPS: readonly string[] = [
  'pages',
  'navigate',
  'new-tab',
  'close-page',
  'set-active',
  'run',
];

/** What a `run` reports once it is over. The story itself already streamed. */
export interface RunOutcome {
  ok: boolean;
  durationMs: number;
  /** Empty when it worked — the log lines are the output. */
  error: string;
}

/** What the sidecar says. `ready` once per browser, the rest whenever. */
export type SidecarFrame =
  | { t: 'ready'; endpoint: string }
  | { t: 'reply'; id: number; ok: true; value: unknown }
  | { t: 'reply'; id: number; ok: false; error: string }
  | { t: 'log'; runId: string; at: number; level: 'log' | 'error'; text: string };

/**
 * The value carried by a reply to a tab operation.
 *
 * The pages ride along with the failure rather than instead of it: a navigation
 * that timed out still leaves a usable tab, and the screen needs to say both
 * things after one round trip.
 */
export interface PagesReply {
  pages: BrowserPage[];
  error?: string;
}

export function encodeLine(msg: unknown): string {
  // JSON.stringify escapes newlines inside strings, which is what makes
  // "one line = one frame" hold even when a script logs a stack trace.
  return `${JSON.stringify(msg)}\n`;
}

/**
 * Turns arbitrary stdout chunks into whole lines.
 *
 * A chunk boundary lands wherever the OS put it — a frame can span two of them
 * and two frames can share one. Everything downstream is written against whole
 * lines, so this is the only place that has to know.
 */
export function createLineSplitter(onLine: (line: string) => void): (chunk: string) => void {
  let held = '';
  return (chunk: string) => {
    held += chunk;
    const lines = held.split('\n');
    // The last piece has no terminator yet: it is the start of the next frame.
    held = lines.pop() ?? '';
    for (const line of lines) onLine(line.trim());
  };
}

function parseObject(line: string): Record<string, unknown> | null {
  if (!line) return null;
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    // Progress chatter from a dependency. Dropping it is the point.
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function decodeFrame(line: string): SidecarFrame | null {
  const raw = parseObject(line);
  if (!raw || typeof raw.t !== 'string') return null;

  switch (raw.t) {
    case 'ready':
      return typeof raw.endpoint === 'string' ? { t: 'ready', endpoint: raw.endpoint } : null;
    case 'reply': {
      if (typeof raw.id !== 'number') return null;
      return raw.ok === true
        ? { t: 'reply', id: raw.id, ok: true, value: raw.value }
        : { t: 'reply', id: raw.id, ok: false, error: String(raw.error ?? 'failed') };
    }
    case 'log': {
      if (typeof raw.runId !== 'string' || typeof raw.text !== 'string') return null;
      return {
        t: 'log',
        runId: raw.runId,
        at: typeof raw.at === 'number' ? raw.at : 0,
        level: raw.level === 'error' ? 'error' : 'log',
        text: raw.text,
      };
    }
    default:
      // A frame this build does not know. Ignored rather than thrown: a newer
      // sidecar must not be able to kill an older main.
      return null;
  }
}

export function decodeRequest(line: string): SidecarRequest | null {
  const raw = parseObject(line);
  if (!raw || typeof raw.id !== 'number' || typeof raw.op !== 'string') return null;
  if (!OPS.includes(raw.op)) return null;
  return raw as unknown as SidecarRequest;
}
