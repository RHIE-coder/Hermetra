import fs from 'node:fs';
import path from 'node:path';
import type { Capability, Connection } from '@shared/types/mobile';
import type { UrlBookmark } from '@shared/types/web';
import type { Scenario } from '@shared/types/bridge';
import { workspaceManager } from './workspaceManager';

/**
 * Persisted shape of `<workspaceDir>/store.json`.
 *
 * P4 (devices-connection-config) replaced the legacy `capabilities[]` /
 * `activeCapabilityId` fields with `connections[]` / `activeConnectionId`.
 * Read-side tolerates the legacy fields (they're silently dropped); write-side
 * never re-emits them.
 */
interface StoreShape {
  bookmarks: UrlBookmark[];
  scenarios: Scenario[];
  connections: Connection[];
  activeConnectionId: string | null;
}

const DEFAULTS: StoreShape = {
  bookmarks: [
    { id: 'bm-1', name: 'Example', url: 'https://example.com' },
    { id: 'bm-2', name: 'Playwright Docs', url: 'https://playwright.dev' },
  ],
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
        scenarios: parsed.scenarios ?? DEFAULTS.scenarios,
        connections: Array.isArray(parsed.connections) ? parsed.connections : [],
        activeConnectionId:
          typeof parsed.activeConnectionId === 'string' ? parsed.activeConnectionId : null,
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
  /**
   * Legacy capability accessor. P4 retired the capabilities concept in favour
   * of connection configs. The getter always returns `[]` (the field is no
   * longer persisted) and the setter is a no-op so consumers that still call
   * it survive without re-emitting the legacy key to disk.
   */
  get capabilities(): Capability[] {
    return [];
  },
  set capabilities(_v: Capability[]) {
    /* no-op — P4 retired this field. */
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
    return read().connections;
  },
  set connections(v: Connection[]) {
    const data = read();
    data.connections = v;
    write(data);
  },
  get activeConnectionId(): string | null {
    return read().activeConnectionId;
  },
  set activeConnectionId(v: string | null) {
    const data = read();
    data.activeConnectionId = v;
    write(data);
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
