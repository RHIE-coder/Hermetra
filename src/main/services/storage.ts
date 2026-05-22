import fs from 'node:fs';
import path from 'node:path';
import type { Capability, Connection } from '@shared/types/mobile';
import type { UrlBookmark } from '@shared/types/web';
import type { Scenario } from '@shared/types/bridge';
import { workspaceManager } from './workspaceManager';

interface StoreShape {
  bookmarks: UrlBookmark[];
  capabilities: Capability[];
  scenarios: Scenario[];
  // P4 (devices-connection-config) — per-workspace connection configs.
  connections: Connection[];
  activeConnectionId: string | null;
}

const DEFAULTS: StoreShape = {
  bookmarks: [
    { id: 'bm-1', name: 'Example', url: 'https://example.com' },
    { id: 'bm-2', name: 'Playwright Docs', url: 'https://playwright.dev' },
  ],
  capabilities: [],
  scenarios: [
    {
      id: 'sample-handoff',
      name: 'Web login → Mobile OTP',
      steps: [
        {
          id: 'step-1',
          platform: 'web',
          name: 'Web에서 로그인',
          scriptPath: 'login.ts',
          emits: 'login.completed',
        },
        {
          id: 'step-2',
          platform: 'mobile',
          name: '모바일에서 OTP 확인',
          scriptPath: 'verify-otp.ts',
          waitFor: 'login.completed',
        },
      ],
    },
  ],
  connections: [],
  activeConnectionId: null,
};

function filePath(): string {
  return path.join(workspaceManager().activeDir(), 'store.json');
}

function read(): StoreShape {
  const fp = filePath();
  try {
    if (fs.existsSync(fp)) {
      const parsed = JSON.parse(fs.readFileSync(fp, 'utf-8')) as Partial<StoreShape>;
      return {
        bookmarks: parsed.bookmarks ?? DEFAULTS.bookmarks,
        capabilities: parsed.capabilities ?? DEFAULTS.capabilities,
        scenarios: parsed.scenarios ?? DEFAULTS.scenarios,
        // P4 fields — implementer adds the read+write here.
        connections: DEFAULTS.connections,
        activeConnectionId: DEFAULTS.activeConnectionId,
      };
    }
  } catch {
    /* fall through */
  }
  return structuredClone(DEFAULTS);
}

function write(data: StoreShape) {
  try {
    fs.writeFileSync(filePath(), JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    /* noop */
  }
}

export const memoryStore = {
  get bookmarks(): UrlBookmark[] {
    return read().bookmarks;
  },
  set bookmarks(v: UrlBookmark[]) {
    const data = read();
    data.bookmarks = v;
    write(data);
  },
  get capabilities(): Capability[] {
    return read().capabilities;
  },
  set capabilities(v: Capability[]) {
    const data = read();
    data.capabilities = v;
    write(data);
  },
  get scenarios(): Scenario[] {
    return read().scenarios;
  },
  set scenarios(v: Scenario[]) {
    const data = read();
    data.scenarios = v;
    write(data);
  },
  get connections(): Connection[] {
    throw new Error('not implemented: memoryStore.connections (P4 devices-connection-config)');
  },
  set connections(_v: Connection[]) {
    throw new Error('not implemented: memoryStore.connections (P4 devices-connection-config)');
  },
  get activeConnectionId(): string | null {
    throw new Error('not implemented: memoryStore.activeConnectionId (P4 devices-connection-config)');
  },
  set activeConnectionId(_v: string | null) {
    throw new Error('not implemented: memoryStore.activeConnectionId (P4 devices-connection-config)');
  },
  removeScenario(id: string): Scenario[] {
    const data = read();
    const next = data.scenarios.filter((s) => s.id !== id);
    if (next.length === data.scenarios.length) return data.scenarios;
    data.scenarios = next;
    write(data);
    return next;
  },
};
