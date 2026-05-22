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
  /** Dry-run an Appium reach for a given connection. Implementation may
   *  delegate to a driver that mocks the network. */
  test(id: string): Promise<ConnectionTestResult>;
}

/**
 * Factory. The implementer fills in the bodies; the stub throws so that the
 * test-first failure points to behavior, not module resolution.
 */
export function createConnectionsService(_workspaceDir: string): ConnectionsService {
  return {
    list() {
      throw new Error('not implemented: ConnectionsService.list');
    },
    save() {
      throw new Error('not implemented: ConnectionsService.save');
    },
    remove() {
      throw new Error('not implemented: ConnectionsService.remove');
    },
    use() {
      throw new Error('not implemented: ConnectionsService.use');
    },
    async test() {
      throw new Error('not implemented: ConnectionsService.test');
    },
  };
}
