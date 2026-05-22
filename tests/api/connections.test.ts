import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createConnectionsService, type ConnectionsService } from '@main/services/connections';
import type { Connection } from '@shared/types/mobile';

/**
 * Spec acceptance criteria covered here (devices-connection-config):
 *   AC2: CONN_SAVE adds a connection; subsequent list() reflects it.
 *   AC3: CONN_USE(id) sets activeConnectionId; switching unsets any prior in-use
 *        (1-active-at-a-time invariant).
 *   AC4: CONN_REMOVE deletes; if it was active, activeConnectionId becomes null.
 *   AC6: CONN_TEST returns ok + durationMs + message (mocked Appium reach).
 *   AC9: delete + re-create same device → works (no stale state).
 *   AC10: per-workspace isolation — two services on two tmp dirs do not see
 *         each other's data.
 *
 * Boundary (CLAUDE.md §3.4): pure service over fs in tmpDir. No Electron.
 * No real network — CONN_TEST collaborator is mocked.
 */

let tmpDir: string;
let svc: ConnectionsService;
const filePath = () => path.join(tmpDir, 'store.json');
const readFile = (): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(filePath(), 'utf-8'));

const baseConn = (overrides: Partial<Connection> = {}): Connection => ({
  id: 'conn-1',
  name: 'New Config',
  deviceId: 'ios:UDID-1',
  platform: 'ios',
  extra: {},
  ...overrides,
});

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetra-connections-api-'));
  svc = createConnectionsService(tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.useRealTimers();
});

describe('connectionsService — list / save / remove / use (API layer)', () => {
  // AC2 — save then list reflects it.
  it('AC2: save(connection) → list() returns the new connection', () => {
    const c = baseConn();
    svc.save(c);

    const result = svc.list();
    expect(result.connections).toHaveLength(1);
    expect(result.connections[0]).toMatchObject({
      id: 'conn-1',
      name: 'New Config',
      deviceId: 'ios:UDID-1',
      platform: 'ios',
    });
    expect(result.activeId).toBeNull();
  });

  // AC2 — upsert by id; not duplicate.
  it('AC2: save() upserts by id — does not duplicate', () => {
    svc.save(baseConn({ name: 'Original' }));
    svc.save(baseConn({ name: 'Renamed' }));

    const result = svc.list();
    expect(result.connections).toHaveLength(1);
    expect(result.connections[0]!.name).toBe('Renamed');
  });

  // AC3 — use(id) sets activeId.
  it('AC3: use(id) sets activeConnectionId in the persisted store', () => {
    svc.save(baseConn({ id: 'conn-a' }));
    svc.use('conn-a');

    const persisted = readFile();
    expect(persisted.activeConnectionId).toBe('conn-a');

    const result = svc.list();
    expect(result.activeId).toBe('conn-a');
  });

  // AC3 — switching active unsets the previous one (1-active invariant).
  it('AC3: use(otherId) replaces the previously-active id (only one active)', () => {
    svc.save(baseConn({ id: 'conn-a' }));
    svc.save(baseConn({ id: 'conn-b' }));
    svc.use('conn-a');
    expect(svc.list().activeId).toBe('conn-a');

    svc.use('conn-b');

    const result = svc.list();
    expect(result.activeId).toBe('conn-b');
  });

  // AC3 — use(null) clears the active slot.
  it('AC3: use(null) clears activeConnectionId', () => {
    svc.save(baseConn({ id: 'conn-a' }));
    svc.use('conn-a');
    expect(svc.list().activeId).toBe('conn-a');

    svc.use(null);

    expect(svc.list().activeId).toBeNull();
  });

  // AC4 — remove(id) deletes; if active, activeId becomes null.
  it('AC4: remove(id) on the active connection clears activeConnectionId', () => {
    svc.save(baseConn({ id: 'conn-a' }));
    svc.save(baseConn({ id: 'conn-b' }));
    svc.use('conn-a');

    svc.remove('conn-a');

    const result = svc.list();
    expect(result.connections.map((c) => c.id)).toEqual(['conn-b']);
    expect(result.activeId).toBeNull();
  });

  // AC4 — remove(id) on a non-active connection leaves activeId alone.
  it('AC4: remove(id) on a non-active connection leaves activeConnectionId intact', () => {
    svc.save(baseConn({ id: 'conn-a' }));
    svc.save(baseConn({ id: 'conn-b' }));
    svc.use('conn-a');

    svc.remove('conn-b');

    const result = svc.list();
    expect(result.connections.map((c) => c.id)).toEqual(['conn-a']);
    expect(result.activeId).toBe('conn-a');
  });

  // AC4 — remove(unknown id) is a no-op.
  it('AC4: remove(unknown id) is a no-op (does not throw, does not delete)', () => {
    svc.save(baseConn({ id: 'conn-a' }));
    expect(() => svc.remove('does-not-exist')).not.toThrow();
    expect(svc.list().connections).toHaveLength(1);
  });

  // AC9 — delete + re-create same device works (no stale state by deviceId).
  it('AC9: delete + re-create a connection with the same deviceId persists and lists', () => {
    svc.save(baseConn({ id: 'conn-old', deviceId: 'ios:UDID-1' }));
    svc.remove('conn-old');
    expect(svc.list().connections).toEqual([]);

    svc.save(baseConn({ id: 'conn-new', deviceId: 'ios:UDID-1', name: 'Fresh' }));
    const result = svc.list();
    expect(result.connections).toHaveLength(1);
    expect(result.connections[0]).toMatchObject({
      id: 'conn-new',
      deviceId: 'ios:UDID-1',
      name: 'Fresh',
    });
  });

  // AC10 — per-workspace isolation: two services on two tmp dirs do not share data.
  it('AC10: per-workspace isolation — separate workspace dirs have separate connection lists', () => {
    const otherDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetra-connections-other-'));
    try {
      const otherSvc = createConnectionsService(otherDir);

      svc.save(baseConn({ id: 'conn-ws1', name: 'Workspace 1' }));
      otherSvc.save(baseConn({ id: 'conn-ws2', name: 'Workspace 2' }));

      expect(svc.list().connections.map((c) => c.id)).toEqual(['conn-ws1']);
      expect(otherSvc.list().connections.map((c) => c.id)).toEqual(['conn-ws2']);
    } finally {
      fs.rmSync(otherDir, { recursive: true, force: true });
    }
  });

  // AC2 — extra KV is persisted as a record.
  it('AC2: save() persists the extra KV record verbatim', () => {
    svc.save(
      baseConn({
        id: 'conn-extra',
        extra: { 'appium:noReset': 'true', 'appium:newCommandTimeout': '90' },
      }),
    );

    const persisted = readFile();
    const conns = persisted.connections as Connection[];
    expect(conns[0]!.extra).toEqual({
      'appium:noReset': 'true',
      'appium:newCommandTimeout': '90',
    });
  });
});

describe('connectionsService.test — CONN_TEST (AC6)', () => {
  // AC6 — test() returns ok + durationMs + message for an existing connection.
  it('AC6: test(id) returns a ConnectionTestResult with ok / durationMs / message', async () => {
    svc.save(baseConn({ id: 'conn-test' }));

    const result = await svc.test('conn-test');

    expect(typeof result.ok).toBe('boolean');
    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.message).toBe('string');
  });

  // AC6 — test(unknown id) returns ok: false with an informative message.
  it('AC6: test(unknown id) returns { ok: false } without throwing', async () => {
    const result = await svc.test('does-not-exist');

    expect(result.ok).toBe(false);
    expect(typeof result.message).toBe('string');
    expect(result.message.length).toBeGreaterThan(0);
  });
});
