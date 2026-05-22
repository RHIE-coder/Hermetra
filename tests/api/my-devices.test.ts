import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createMyDevicesService, type MyDevicesService } from '@main/services/myDevices';
import type { SavedDevice } from '@shared/types/mobile';

let tmpDir: string;
let svc: MyDevicesService;
const filePath = () => path.join(tmpDir, 'devices.json');
const readFile = (): { devices: SavedDevice[] } =>
  JSON.parse(fs.readFileSync(filePath(), 'utf-8'));

const baseDevice = (overrides: Partial<SavedDevice> = {}): SavedDevice => ({
  id: 'ios:UDID-1',
  platform: 'ios',
  udid: 'UDID-1',
  name: 'My iPhone',
  lastConnectedAt: '2026-05-22T12:00:00.000Z',
  ...overrides,
});

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetra-mydevices-api-'));
  svc = createMyDevicesService(tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.useRealTimers();
});

describe('myDevicesService — list / save / remove / updateAlias (API layer)', () => {
  // AC1
  it('AC1: list() returns empty list and seeds devices.json when file missing', () => {
    expect(fs.existsSync(filePath())).toBe(false);
    const result = svc.list();
    expect(result).toEqual({ devices: [] });
    expect(fs.existsSync(filePath())).toBe(true);
  });

  // AC2
  it('AC2: save(device) writes to devices.json and list() returns it', () => {
    const device = baseDevice();
    svc.save(device);

    const persisted = readFile();
    expect(persisted.devices).toHaveLength(1);
    expect(persisted.devices[0]).toMatchObject({
      id: 'ios:UDID-1',
      platform: 'ios',
      udid: 'UDID-1',
      name: 'My iPhone',
    });

    const result = svc.list();
    expect(result.devices).toHaveLength(1);
    expect(result.devices[0]).toMatchObject({ id: 'ios:UDID-1' });
  });

  // AC2 — idempotent upsert: calling save twice with the same id replaces, not duplicates.
  it('AC2: save() upserts by id — does not duplicate entries', () => {
    svc.save(baseDevice({ name: 'Original Name' }));
    svc.save(baseDevice({ name: 'Renamed' }));

    const persisted = readFile();
    expect(persisted.devices).toHaveLength(1);
    expect(persisted.devices[0]!.name).toBe('Renamed');
  });

  // AC3
  it('AC3: remove(id) deletes entry from devices.json', () => {
    svc.save(baseDevice({ id: 'ios:A', udid: 'A' }));
    svc.save(baseDevice({ id: 'android:B', udid: 'B', platform: 'android', name: 'Pixel' }));

    svc.remove('ios:A');

    const persisted = readFile();
    expect(persisted.devices.map((d) => d.id)).toEqual(['android:B']);

    const result = svc.list();
    expect(result.devices.map((d) => d.id)).toEqual(['android:B']);
  });

  // AC3 — no-op on unknown id (matches removeScenario pattern in storage.ts).
  it('AC3: remove(unknown id) is a no-op (does not throw, does not delete)', () => {
    svc.save(baseDevice());
    expect(() => svc.remove('ios:DOES-NOT-EXIST')).not.toThrow();
    expect(svc.list().devices).toHaveLength(1);
  });

  // AC4
  it('AC4: updateAlias(id, alias) updates only alias and persists', () => {
    svc.save(baseDevice({ id: 'ios:X', udid: 'X', alias: 'old-alias' }));
    svc.updateAlias('ios:X', 'team-phone');

    const persisted = readFile();
    expect(persisted.devices[0]!.alias).toBe('team-phone');
    // Other fields are untouched.
    expect(persisted.devices[0]).toMatchObject({
      id: 'ios:X',
      udid: 'X',
      name: 'My iPhone',
      platform: 'ios',
    });
  });

  // AC4 — passing null clears the alias.
  it('AC4: updateAlias(id, null) clears the alias field', () => {
    svc.save(baseDevice({ alias: 'to-be-removed' }));
    svc.updateAlias('ios:UDID-1', null);

    const persisted = readFile();
    // Cleared aliases must not survive on disk (undefined or missing key).
    expect(persisted.devices[0]!.alias ?? null).toBeNull();
  });

  // AC5
  it('AC5: touchLastConnected(udid) updates lastConnectedAt for matching saved entry', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-22T12:00:00.000Z'));

    svc.save(baseDevice({ lastConnectedAt: '2025-01-01T00:00:00.000Z' }));

    vi.setSystemTime(new Date('2026-05-22T15:30:00.000Z'));
    svc.touchLastConnected('UDID-1');

    const persisted = readFile();
    expect(persisted.devices[0]!.lastConnectedAt).toBe('2026-05-22T15:30:00.000Z');
  });

  // AC5 — touch on an unknown UDID is a no-op (we never auto-create on detection).
  it('AC5: touchLastConnected(unknown udid) does not create a new entry', () => {
    svc.save(baseDevice({ udid: 'KNOWN' }));
    svc.touchLastConnected('UNKNOWN-UDID');

    const result = svc.list();
    expect(result.devices).toHaveLength(1);
    expect(result.devices[0]!.udid).toBe('KNOWN');
  });
});
