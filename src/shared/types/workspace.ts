export interface Workspace {
  id: string;
  name: string;
  port: number;
  /** Description shown in the switcher dropdown. */
  description?: string;
  createdAt: number;
  lastUsedAt?: number;
}

export interface WorkspaceState {
  workspaces: Workspace[];
  activeId: string;
}

export interface BrowserInstallState {
  installed: boolean;
  /** Expected on-disk path for the Playwright Chromium build. */
  executablePath: string;
}

export interface BrowserInstallLog {
  line: string;
  level: 'info' | 'error';
  /** Whether the install finished after this line. */
  done?: boolean;
  ok?: boolean;
}
