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
  /** Relative path inside scripts/web or scripts/mobile, e.g. "login.ts". */
  path: string;
  name: string;
}

export interface ScriptFileBody {
  path: string;
  source: string;
}
