import fs from 'node:fs';
import path from 'node:path';
import type { SavedDevice } from '@shared/types/mobile';

/**
 * The "My Devices" service — manages a globally-scoped list of devices the
 * user has explicitly saved. Persists to `<baseDir>/devices.json`.
 *
 * `baseDir` is injected so tests can write to `os.tmpdir()` instead of the
 * real userData directory. In production, the caller passes
 * `app.getPath('userData')`.
 */
export interface MyDevicesService {
  /** Return the full saved list. Auto-seeds `{ devices: [] }` if file missing. */
  list(): { devices: SavedDevice[] };
  /** Insert or update a saved device by `id`. */
  save(device: SavedDevice): { ok: true };
  /** Remove by `id`. No-op if not found. */
  remove(id: string): { ok: true };
  /** Update only the `alias` field for an existing entry. */
  updateAlias(id: string, alias: string | null): { ok: true };
  /**
   * Mark a UDID as freshly detected: if it matches a saved entry's UDID,
   * update its `lastConnectedAt` to the current ISO timestamp.
   */
  touchLastConnected(udid: string): { ok: true };
}

interface RawShape {
  devices?: SavedDevice[];
  [extra: string]: unknown;
}

export function createMyDevicesService(baseDir: string): MyDevicesService {
  const filePath = path.join(baseDir, 'devices.json');

  function readRaw(): RawShape {
    if (!fs.existsSync(filePath)) {
      writeRaw({ devices: [] });
      return { devices: [] };
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as RawShape;
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      /* corrupt — fall through to seed */
    }
    writeRaw({ devices: [] });
    return { devices: [] };
  }

  function writeRaw(data: RawShape) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      /* noop */
    }
  }

  function readDevices(): { raw: RawShape; devices: SavedDevice[] } {
    const raw = readRaw();
    const devices = Array.isArray(raw.devices) ? raw.devices : [];
    return { raw, devices };
  }

  return {
    list() {
      const { devices } = readDevices();
      return { devices };
    },

    save(device) {
      const { raw, devices } = readDevices();
      const next = devices.slice();
      const idx = next.findIndex((d) => d.id === device.id);
      if (idx >= 0) next[idx] = device;
      else next.push(device);
      writeRaw({ ...raw, devices: next });
      return { ok: true };
    },

    remove(id) {
      const { raw, devices } = readDevices();
      const next = devices.filter((d) => d.id !== id);
      if (next.length !== devices.length) {
        writeRaw({ ...raw, devices: next });
      }
      return { ok: true };
    },

    updateAlias(id, alias) {
      const { raw, devices } = readDevices();
      const idx = devices.findIndex((d) => d.id === id);
      if (idx < 0) return { ok: true };
      const current = devices[idx]!;
      const updated: SavedDevice = { ...current };
      if (alias === null) {
        delete updated.alias;
      } else {
        updated.alias = alias;
      }
      const next = devices.slice();
      next[idx] = updated;
      writeRaw({ ...raw, devices: next });
      return { ok: true };
    },

    touchLastConnected(udid) {
      const { raw, devices } = readDevices();
      const idx = devices.findIndex((d) => d.udid === udid);
      if (idx < 0) return { ok: true };
      const next = devices.slice();
      next[idx] = { ...next[idx]!, lastConnectedAt: new Date().toISOString() };
      writeRaw({ ...raw, devices: next });
      return { ok: true };
    },
  };
}

let inst: MyDevicesService | null = null;
let instBaseDir: string | null = null;

/**
 * Lazy singleton accessor for production wiring. `baseDir` must be passed on
 * the first call (typically `app.getPath('userData')` from `register.ts`).
 * Subsequent calls reuse the instance. Pass a new `baseDir` to rebind (used
 * if Electron's userData changes; not expected at runtime).
 */
export function myDevicesService(baseDir?: string): MyDevicesService {
  if (!inst || (baseDir && baseDir !== instBaseDir)) {
    if (!baseDir) throw new Error('myDevicesService requires baseDir on first call');
    inst = createMyDevicesService(baseDir);
    instBaseDir = baseDir;
  }
  return inst;
}
