import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Connection } from '@shared/types/mobile';

/**
 * Spec acceptance criteria covered here (devices-connection-config):
 *   AC1: store.json with legacy `capabilities[]` / `activeCapabilityId` is read
 *        without error AND a subsequent write does NOT re-emit those keys.
 *   AC10 (schema side): connections persist round-trip in `<workspaceDir>/store.json`
 *        with the documented shape (`connections[]` + `activeConnectionId`).
 *
 * Boundary (CLAUDE.md §3.4): no Electron, no real fs outside tmpdir. We mock
 * `workspaceManager` so `storage.ts` writes inside the test's tmpDir.
 */

let tmpDir: string;

vi.mock('@main/services/workspaceManager', () => ({
  workspaceManager: () => ({ activeDir: () => tmpDir }),
}));

const importFresh = async () => {
  vi.resetModules();
  return import('@main/services/storage');
};

const filePath = () => path.join(tmpDir, 'store.json');
const readFile = (): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(filePath(), 'utf-8'));

const conn = (overrides: Partial<Connection> = {}): Connection => ({
  id: 'conn-1',
  name: 'New Config',
  deviceId: 'ios:UDID-1',
  platform: 'ios',
  extra: {},
  ...overrides,
});

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetra-conn-schema-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('storage.ts — connections schema (devices-connection-config)', () => {
  // AC1 — legacy fields are read silently (no throw).
  it('AC1: store.json with legacy capabilities[] / activeCapabilityId reads without error', async () => {
    fs.writeFileSync(
      filePath(),
      JSON.stringify({
        // Legacy P3 shape — must be tolerated.
        capabilities: [
          { id: 'cap-1', name: 'old', deviceId: 'ios:UDID-1', platform: 'ios' },
        ],
        activeCapabilityId: 'cap-1',
        // No connections[] yet — must default to empty list, not crash.
      }),
      'utf-8',
    );

    const { memoryStore } = await importFresh();

    // The legacy keys are silently ignored. New API returns the default empty list.
    expect(memoryStore.connections).toEqual([]);
    expect(memoryStore.activeConnectionId).toBeNull();
  });

  // AC1 — writing connections does NOT re-emit capabilities/activeCapabilityId.
  it('AC1: writing connections never re-emits legacy capabilities/activeCapabilityId', async () => {
    // Seed a file that has both legacy keys.
    fs.writeFileSync(
      filePath(),
      JSON.stringify({
        capabilities: [
          { id: 'cap-1', name: 'old', deviceId: 'ios:UDID-1', platform: 'ios' },
        ],
        activeCapabilityId: 'cap-1',
      }),
      'utf-8',
    );

    const { memoryStore } = await importFresh();

    // Trigger a write through the new API.
    memoryStore.connections = [conn()];

    const parsed = readFile();
    expect(parsed).not.toHaveProperty('capabilities');
    expect(parsed).not.toHaveProperty('activeCapabilityId');
    // The new keys are present.
    expect(parsed).toHaveProperty('connections');
    expect((parsed.connections as Connection[]).map((c) => c.id)).toEqual(['conn-1']);
  });

  // AC10 (schema side) — connections round-trip with all documented fields.
  it('AC10: connections persist round-trip with all documented fields', async () => {
    const { memoryStore } = await importFresh();

    memoryStore.connections = [
      conn({
        id: 'conn-roundtrip',
        name: 'iOS Dev',
        deviceId: 'ios:UDID-1',
        platform: 'ios',
        bundleId: 'com.example.app',
        xcodeOrgId: 'ABCD1234EF',
        xcodeSigningId: '4NC5GBGM93',
        extra: { 'appium:noReset': 'true', 'appium:wdaPort': '8100' },
      }),
    ];

    // Round-trip via disk. The file must exist (proves the setter persisted).
    expect(fs.existsSync(filePath())).toBe(true);
    const parsed = readFile();
    const conns = parsed.connections as Connection[];
    expect(conns).toHaveLength(1);
    expect(conns[0]).toMatchObject({
      id: 'conn-roundtrip',
      name: 'iOS Dev',
      deviceId: 'ios:UDID-1',
      platform: 'ios',
      bundleId: 'com.example.app',
      xcodeOrgId: 'ABCD1234EF',
      xcodeSigningId: '4NC5GBGM93',
      extra: { 'appium:noReset': 'true', 'appium:wdaPort': '8100' },
    });

    // Also reading via the accessor returns the same shape.
    const reread = memoryStore.connections;
    expect(reread).toHaveLength(1);
    expect(reread[0]).toMatchObject({ id: 'conn-roundtrip' });
  });

  // AC10 — activeConnectionId persists and may be null.
  it('AC10: activeConnectionId persists across reads (default null)', async () => {
    const { memoryStore } = await importFresh();

    // Default — null on a fresh store.
    expect(memoryStore.activeConnectionId).toBeNull();

    memoryStore.connections = [conn({ id: 'conn-a' })];
    memoryStore.activeConnectionId = 'conn-a';

    const parsed = readFile();
    expect(parsed.activeConnectionId).toBe('conn-a');

    // Re-read.
    expect(memoryStore.activeConnectionId).toBe('conn-a');
  });

  // AC1 (corollary) — bookmarks / scenarios are still preserved across the
  // capability-removal refactor. Regression guard.
  it('AC1: bookmarks and scenarios still survive a save that touches connections', async () => {
    const { memoryStore } = await importFresh();

    // Capture defaults.
    const initialBookmarks = memoryStore.bookmarks;
    const initialScenarios = memoryStore.scenarios;
    expect(initialBookmarks.length).toBeGreaterThan(0);
    expect(initialScenarios.length).toBeGreaterThan(0);

    memoryStore.connections = [conn()];

    // After writing connections, the legacy non-capability keys remain intact.
    const parsed = readFile();
    expect(Array.isArray(parsed.bookmarks)).toBe(true);
    expect(Array.isArray(parsed.scenarios)).toBe(true);
    expect((parsed.bookmarks as unknown[]).length).toBe(initialBookmarks.length);
    expect((parsed.scenarios as unknown[]).length).toBe(initialScenarios.length);
  });
});
