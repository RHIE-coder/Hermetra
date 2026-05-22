import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { MobileDriverApi } from '@main/drivers/types';

/**
 * Spec acceptance criteria covered here (mobile-inspector-page §Affected layers):
 *
 *   AC5 (driver): startInspector() opens an Appium session (mock: ok immediately).
 *   AC6 (driver): screenshot() returns a non-empty data URL.
 *   AC7 (driver): startRecording() / stopRecording() flip session state and
 *                 stopRecording returns a video data URL.
 *   AC8 (driver): getPageSource('native' | <wv>) returns hard-coded XML / HTML
 *                 + getContexts() returns ['NATIVE_APP', 'WEBVIEW_*'].
 *  AC11 (driver): stopSession() can always be called safely (even if no session).
 *  AC12: mock driver returns hard-coded minimal-but-valid data for every new API.
 *
 * Test boundary (CLAUDE.md §3.4): we exercise the MobileDriver via
 * `createMobileDriver()` with `HERMETRA_DRIVERS=mock` so no Appium / WebdriverIO
 * subprocess is touched. The IPC handlers are wired in `src/main/ipc/register.ts`
 * but per project convention we test the driver surface directly.
 */

const importFreshDriver = async (): Promise<MobileDriverApi> => {
  vi.resetModules();
  const mod = await import('@main/drivers/mobile');
  return mod.createMobileDriver();
};

describe('MobileDriver — inspector extensions (mock mode)', () => {
  let prevEnv: string | undefined;

  beforeEach(() => {
    prevEnv = process.env.HERMETRA_DRIVERS;
    process.env.HERMETRA_DRIVERS = 'mock';
  });

  afterEach(() => {
    if (prevEnv === undefined) delete process.env.HERMETRA_DRIVERS;
    else process.env.HERMETRA_DRIVERS = prevEnv;
  });

  // AC5: startInspector() exists on the driver surface and resolves successfully.
  it('AC5: driver.startInspector() resolves to { ok: true } in mock mode', async () => {
    const driver = await importFreshDriver();
    expect(typeof driver.startInspector).toBe('function');
    const result = await driver.startInspector();
    expect(result).toMatchObject({ ok: true });
  });

  // AC6 / AC12: screenshot() returns a base64 data URL (image/png).
  it('AC6: driver.screenshot() returns a non-empty image data URL after startInspector', async () => {
    const driver = await importFreshDriver();
    await driver.startInspector();
    const { dataUrl } = await driver.screenshot();
    expect(typeof dataUrl).toBe('string');
    expect(dataUrl.startsWith('data:image/')).toBe(true);
    expect(dataUrl.length).toBeGreaterThan('data:image/png;base64,'.length);
  });

  // AC7 / AC12: startRecording() / stopRecording() are wired through.
  it('AC7: driver.startRecording() resolves; stopRecording() returns a video data URL', async () => {
    const driver = await importFreshDriver();
    await driver.startInspector();
    const start = await driver.startRecording();
    expect(start).toBeDefined();
    const { dataUrl } = await driver.stopRecording();
    expect(typeof dataUrl).toBe('string');
    expect(dataUrl.startsWith('data:video/')).toBe(true);
  });

  // AC8: getContexts() lists at least NATIVE_APP and one WEBVIEW_* context.
  it('AC8: driver.getContexts() returns ["NATIVE_APP", "WEBVIEW_*"] in mock mode', async () => {
    const driver = await importFreshDriver();
    expect(typeof driver.getContexts).toBe('function');
    const contexts = await driver.getContexts();
    expect(Array.isArray(contexts)).toBe(true);
    expect(contexts).toContain('NATIVE_APP');
    expect(contexts.some((c) => c.startsWith('WEBVIEW_'))).toBe(true);
  });

  // AC8: setContext(name) returns ok in mock mode and accepts native + webview.
  it('AC8: driver.setContext(name) accepts NATIVE_APP and WEBVIEW_* names', async () => {
    const driver = await importFreshDriver();
    expect(typeof driver.setContext).toBe('function');
    await expect(driver.setContext('NATIVE_APP')).resolves.toMatchObject({ ok: true });
    await expect(driver.setContext('WEBVIEW_com.example')).resolves.toMatchObject({
      ok: true,
    });
  });

  // AC8 / AC12: getPageSource('native') returns a hard-coded UIAutomator/XCUITest XML.
  it('AC8: driver.getPageSource("native") returns a non-empty XML string in mock mode', async () => {
    const driver = await importFreshDriver();
    expect(typeof driver.getPageSource).toBe('function');
    const xml = await driver.getPageSource('native');
    expect(typeof xml).toBe('string');
    expect(xml.length).toBeGreaterThan(0);
    // Mock spec: hard-coded XML with at least one button/label element.
    // The parser test pins format details; here we just confirm we got XML.
    expect(xml).toMatch(/<\/?[A-Za-z]/); // contains at least one XML tag.
  });

  // AC8 / AC12: getPageSource(<webview>) returns HTML document in mock mode.
  it('AC8: driver.getPageSource(<webview-name>) returns an HTML document in mock mode', async () => {
    const driver = await importFreshDriver();
    const html = await driver.getPageSource('WEBVIEW_com.example');
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(0);
    // Crude HTML signal: a <body> or doctype somewhere.
    expect(html.toLowerCase()).toMatch(/<(body|html|!doctype)/);
  });

  // AC11: stopSession() resolves without throwing, even on a fresh driver.
  it('AC11: driver.stopSession() resolves cleanly even without an active session', async () => {
    const driver = await importFreshDriver();
    expect(typeof driver.stopSession).toBe('function');
    await expect(driver.stopSession()).resolves.toBeDefined();
  });

  // AC12: mock data must be deterministic — repeated calls return identical content.
  it('AC12: mock screenshot / getPageSource / getContexts are deterministic across calls', async () => {
    const driver = await importFreshDriver();
    await driver.startInspector();
    const [a, b] = await Promise.all([driver.screenshot(), driver.screenshot()]);
    expect(a.dataUrl).toEqual(b.dataUrl);

    const [xmlA, xmlB] = await Promise.all([
      driver.getPageSource('native'),
      driver.getPageSource('native'),
    ]);
    expect(xmlA).toEqual(xmlB);

    const [c1, c2] = await Promise.all([driver.getContexts(), driver.getContexts()]);
    expect(c1).toEqual(c2);
  });

  // AC12: mock screenshot resolves immediately (<50ms) — real Appium would take
  // hundreds of ms; the mock branch must not be doing network I/O.
  it('AC12: mock screenshot resolves immediately (<50ms)', async () => {
    const driver = await importFreshDriver();
    await driver.startInspector();
    const t0 = Date.now();
    await driver.screenshot();
    expect(Date.now() - t0).toBeLessThan(50);
  });
});
