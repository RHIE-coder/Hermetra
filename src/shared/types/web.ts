export interface RemoteBrowserStatus {
  isRunning: boolean;
  port: number;
  wsEndpoint: string | null;
  /** True when Playwright is installed and the real driver is in use. */
  driverAvailable: boolean;
  /** Friendly message about the driver state when the real driver can't run. */
  driverHint?: string;
}

export interface BrowserPage {
  index: number;
  title: string;
  url: string;
  isActive: boolean;
}

export interface UrlBookmark {
  id: string;
  name: string;
  url: string;
}

export interface WebScriptRunRequest {
  scriptId: string;
  source: string;
}

export interface WebScriptRunResult {
  scriptId: string;
  ok: boolean;
  durationMs: number;
  output: string;
}

export interface ScriptFile {
  /** Relative path inside scripts/web or scripts/mobile, e.g. "auth/login.ts" or "auth". */
  path: string;
  name: string;
  type: 'file' | 'folder';
}

export interface ScriptFileBody {
  path: string;
  source: string;
}

/**
 * Atomic batch move for the scripts tree. Each entry asks for a file or
 * folder at `from` to be relocated to `to`. The batch is all-or-nothing:
 * if any single move would conflict, the whole batch is refused.
 */
export interface ScriptMoveRequest {
  /** Existing relative path (file or folder), e.g. "auth/login.ts" or "auth". */
  from: string;
  /** New relative path (parent + name), e.g. "team/login.ts". */
  to: string;
}

export type ScriptMoveResult =
  | { ok: true }
  | { ok: false; error: string; conflicts: string[] };
