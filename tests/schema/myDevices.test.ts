import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createMyDevicesService } from '@main/services/myDevices';
import type { SavedDevice } from '@shared/types/mobile';

let tmpDir: string;
const filePath = () => path.join(tmpDir, 'devices.json');

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetra-mydevices-schema-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('myDevices.ts (DB schema)', () => {
  // AC1: auto-seed when file missing.
  it('AC1: returns { devices: [] } when devices.json does not exist', () => {
    const svc = createMyDevicesService(tmpDir);
    const result = svc.list();
    expect(result).toEqual({ devices: [] });
  });

  // AC1 (corollary): a fresh list() call writes the file so subsequent reads
  // are deterministic and the file is observable on disk.
  it('AC1: writes a `{ devices: [] }` file on first list() if missing', () => {
    const svc = createMyDevicesService(tmpDir);
    svc.list();
    expect(fs.existsSync(filePath())).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(filePath(), 'utf-8'));
    expect(parsed).toEqual({ devices: [] });
  });

  it('persists a saved SavedDevice round-trip with all required fields', () => {
    const svc = createMyDevicesService(tmpDir);
    const device: SavedDevice = {
      id: 'ios:UDID-1',
      platform: 'ios',
      udid: 'UDID-1',
      name: 'My iPhone',
      lastConnectedAt: '2026-05-22T12:00:00.000Z',
    };
    svc.save(device);

    // On disk: shape locked to `{ devices: SavedDevice[] }`.
    const parsed = JSON.parse(fs.readFileSync(filePath(), 'utf-8'));
    expect(Array.isArray(parsed.devices)).toBe(true);
    expect(parsed.devices).toHaveLength(1);
    expect(parsed.devices[0]).toMatchObject({
      id: 'ios:UDID-1',
      platform: 'ios',
      udid: 'UDID-1',
      name: 'My iPhone',
      lastConnectedAt: '2026-05-22T12:00:00.000Z',
    });

    // Re-load returns the same shape.
    const reread = svc.list();
    expect(reread.devices[0]).toMatchObject(device);
  });

  it('persists optional fields (alias, kind) when present', () => {
    const svc = createMyDevicesService(tmpDir);
    svc.save({
      id: 'android:SERIAL-9',
      platform: 'android',
      udid: 'SERIAL-9',
      name: 'Pixel 8',
      alias: 'team-phone',
      kind: 'real',
      lastConnectedAt: '2026-05-22T13:00:00.000Z',
    });

    const parsed = JSON.parse(fs.readFileSync(filePath(), 'utf-8'));
    expect(parsed.devices[0].alias).toBe('team-phone');
    expect(parsed.devices[0].kind).toBe('real');
  });

  it('falls back to seed when devices.json is corrupt JSON', () => {
    fs.writeFileSync(filePath(), '{ not json', 'utf-8');
    const svc = createMyDevicesService(tmpDir);
    const result = svc.list();
    // Spec §"Error handling": parse failure → backup + fresh seed.
    expect(result).toEqual({ devices: [] });
  });

  it('keeps unknown top-level keys silent — does not crash on extra fields', () => {
    // Match the existing storage.test.ts permissive policy: extra/missing
    // top-level keys are tolerated; only `devices` is required.
    fs.writeFileSync(
      filePath(),
      JSON.stringify({ devices: [], schemaVersion: 99 }),
      'utf-8',
    );
    const svc = createMyDevicesService(tmpDir);
    const result = svc.list();
    expect(result.devices).toEqual([]);
  });
});
