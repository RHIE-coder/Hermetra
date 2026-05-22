import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { MobileDriverApi } from '@main/drivers/types';
import type { InstalledApp } from '@shared/types/mobile';

/**
 * Spec acceptance criteria covered here:
 *   AC4: MobileDriver exposes `listInstalledApps(deviceId)` that returns InstalledApp[].
 *   AC9: Mock driver returns exactly 13 dummy apps, immediately (no async delay
 *        from real subprocess spawn).
 *
 * Test boundary (per CLAUDE.md §3.4): no Electron, no spawn. We construct the
 * driver via `createMobileDriver()` with `HERMETRA_DRIVERS=mock` so the mock
 * branch is exercised and no `ideviceinstaller`/`adb` subprocess is touched.
 */

const importFreshDriver = async (): Promise<MobileDriverApi> => {
  vi.resetModules();
  const mod = await import('@main/drivers/mobile');
  return mod.createMobileDriver();
};

describe('MobileDriver.listInstalledApps — mock mode', () => {
  let prevEnv: string | undefined;

  beforeEach(() => {
    prevEnv = process.env.HERMETRA_DRIVERS;
    process.env.HERMETRA_DRIVERS = 'mock';
  });

  afterEach(() => {
    if (prevEnv === undefined) delete process.env.HERMETRA_DRIVERS;
    else process.env.HERMETRA_DRIVERS = prevEnv;
  });

  // AC4: shape of the method.
  it('AC4: listInstalledApps(deviceId) returns Promise<InstalledApp[]>', async () => {
    const driver = await importFreshDriver();
    const apps = await driver.listInstalledApps('ios:UDID-1');
    expect(Array.isArray(apps)).toBe(true);
  });

  // AC9: hard-coded 13-app dummy list.
  it('AC9: mock driver returns exactly 13 dummy apps', async () => {
    const driver = await importFreshDriver();
    const apps = await driver.listInstalledApps('ios:UDID-1');
    expect(apps).toHaveLength(13);
  });

  // AC9: each app must conform to InstalledApp shape (non-empty fields).
  it('AC9: every returned app has non-empty name / bundleId / version', async () => {
    const driver = await importFreshDriver();
    const apps = await driver.listInstalledApps('ios:UDID-1');
    for (const app of apps as InstalledApp[]) {
      expect(typeof app.name).toBe('string');
      expect(app.name.length).toBeGreaterThan(0);
      expect(typeof app.bundleId).toBe('string');
      expect(app.bundleId.length).toBeGreaterThan(0);
      expect(typeof app.version).toBe('string');
      expect(app.version.length).toBeGreaterThan(0);
    }
  });

  // AC9: "immediately (no delay)". A subprocess spawn would take ≥50ms; the
  // mock path must resolve in well under that.
  it('AC9: mock listInstalledApps resolves immediately (<50ms)', async () => {
    const driver = await importFreshDriver();
    const t0 = Date.now();
    await driver.listInstalledApps('ios:UDID-1');
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(50);
  });

  // AC9: the dummy list is deterministic — calling twice returns the same set.
  it('AC9: mock list is deterministic across calls', async () => {
    const driver = await importFreshDriver();
    const first = await driver.listInstalledApps('ios:UDID-1');
    const second = await driver.listInstalledApps('ios:UDID-1');
    expect(second).toEqual(first);
  });
});
