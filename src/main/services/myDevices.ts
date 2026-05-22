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
  /** Insert or update a saved device by `id`. Returns the new list length. */
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

export function createMyDevicesService(_baseDir: string): MyDevicesService {
  return {
    list() {
      throw new Error('not implemented');
    },
    save(_device: SavedDevice) {
      throw new Error('not implemented');
    },
    remove(_id: string) {
      throw new Error('not implemented');
    },
    updateAlias(_id: string, _alias: string | null) {
      throw new Error('not implemented');
    },
    touchLastConnected(_udid: string) {
      throw new Error('not implemented');
    },
  };
}
