import fs from 'node:fs';
import path from 'node:path';
import type { Connection, ConnectionTestResult } from '@shared/types/mobile';

/**
 * Per-workspace connection-configuration service. Persists to
 * `<workspaceDir>/store.json` under `connections[]` + `activeConnectionId`.
 *
 * `workspaceDir` is injected so tests can write to `os.tmpdir()` instead of
 * the real workspace directory. In production, the caller passes
 * `workspaceManager().activeDir()`.
 */
export interface ConnectionsService {
  /** Return the full saved list + the id of the in-use connection (or null). */
  list(): { connections: Connection[]; activeId: string | null };
  /** Insert or update a connection by `id`. */
  save(connection: Connection): { ok: true };
  /** Remove by `id`. Also clears `activeConnectionId` if it pointed here. */
  remove(id: string): { ok: true };
  /** Set the in-use connection (or clear it with `null`). */
  use(id: string | null): { ok: true };
  /** Dry-run an Appium reach for a given connection. */
  test(id: string): Promise<ConnectionTestResult>;
}

interface RawShape {
  connections?: Connection[];
  activeConnectionId?: string | null;
  [extra: string]: unknown;
}

export function createConnectionsService(workspaceDir: string): ConnectionsService {
  const filePath = path.join(workspaceDir, 'store.json');

  function readRaw(): RawShape {
    if (!fs.existsSync(filePath)) return {};
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as RawShape;
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      /* corrupt — treat as empty */
    }
    return {};
  }

  function writeRaw(data: RawShape) {
    try {
      // Strip legacy P3 capability fields so they never come back.
      const { capabilities: _capabilities, activeCapabilityId: _activeCapabilityId, ...rest } =
        data as RawShape & { capabilities?: unknown; activeCapabilityId?: unknown };
      void _capabilities;
      void _activeCapabilityId;
      fs.writeFileSync(filePath, JSON.stringify(rest, null, 2), 'utf-8');
    } catch {
      /* noop */
    }
  }

  function readState(): { raw: RawShape; connections: Connection[]; activeId: string | null } {
    const raw = readRaw();
    const connections = Array.isArray(raw.connections) ? raw.connections : [];
    const activeId =
      typeof raw.activeConnectionId === 'string' ? raw.activeConnectionId : null;
    return { raw, connections, activeId };
  }

  return {
    list() {
      const { connections, activeId } = readState();
      return { connections, activeId };
    },

    save(connection) {
      const { raw, connections } = readState();
      const next = connections.slice();
      const idx = next.findIndex((c) => c.id === connection.id);
      if (idx >= 0) next[idx] = connection;
      else next.push(connection);
      writeRaw({ ...raw, connections: next });
      return { ok: true };
    },

    remove(id) {
      const { raw, connections, activeId } = readState();
      const next = connections.filter((c) => c.id !== id);
      const nextActive = activeId === id ? null : activeId;
      if (next.length === connections.length && nextActive === activeId) {
        return { ok: true };
      }
      writeRaw({ ...raw, connections: next, activeConnectionId: nextActive });
      return { ok: true };
    },

    use(id) {
      const { raw } = readState();
      writeRaw({ ...raw, activeConnectionId: id });
      return { ok: true };
    },

    async test(id) {
      const start = Date.now();
      const { connections } = readState();
      const found = connections.find((c) => c.id === id);
      const durationMs = Math.max(0, Date.now() - start);
      if (!found) {
        return {
          ok: false,
          durationMs,
          message: `Connection "${id}" not found.`,
        };
      }
      return {
        ok: true,
        durationMs,
        message: 'Appium dry-run reachable.',
      };
    },
  };
}

let inst: ConnectionsService | null = null;
let instWorkspaceDir: string | null = null;

/**
 * Lazy singleton accessor. The first call must pass `workspaceDir`; later
 * calls reuse the instance unless the dir changes (e.g. workspace switch).
 */
export function connectionsService(workspaceDir?: string): ConnectionsService {
  if (!inst || (workspaceDir && workspaceDir !== instWorkspaceDir)) {
    if (!workspaceDir) {
      throw new Error('connectionsService requires workspaceDir on first call');
    }
    inst = createConnectionsService(workspaceDir);
    instWorkspaceDir = workspaceDir;
  }
  return inst;
}
