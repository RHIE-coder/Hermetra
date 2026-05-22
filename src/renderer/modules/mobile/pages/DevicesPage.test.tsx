// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '@/lib/i18n';
import { useMobileStore } from '../store';
import { DevicesPage } from './DevicesPage';
import type { InstalledApp, MobileDevice, SavedDevice, ToolingStatus } from '@shared/types/mobile';

/**
 * Spec acceptance criteria covered here:
 *   AC2: Save button → device persisted (via store action) + appears in 내 디바이스 list.
 *   AC6: Saved entries render 연결됨/연결안됨 by matching live `devices[]` by UDID.
 *   AC7: Selecting an entry → 기기 상세 panel shows its info.
 *   AC8: Persistence across page refresh (re-render preserves saved entries from store).
 *
 * (AC1, AC3, AC4, AC5 are exercised in tests/api/my-devices.test.ts at the
 *  service layer. AC3/AC4 also have UI wiring tests below for the buttons
 *  that the spec explicitly calls out in the detail panel.)
 */

interface StoreSeed {
  devices?: MobileDevice[];
  savedDevices?: SavedDevice[];
  selectedDeviceKey?: string | null;
  installedApps?: InstalledApp[];
  installedAppsLoading?: boolean;
  tooling?: ToolingStatus;
  saveDevice?: (d: SavedDevice) => Promise<void>;
  removeDevice?: (id: string) => Promise<void>;
  updateAlias?: (id: string, alias: string | null) => Promise<void>;
  selectDevice?: (key: string | null) => void;
  refreshSavedDevices?: () => Promise<void>;
  refreshInstalledApps?: (deviceId: string) => Promise<void>;
}

function seedStore(seed: StoreSeed = {}) {
  const saveDevice = seed.saveDevice ?? vi.fn().mockResolvedValue(undefined);
  const removeDevice = seed.removeDevice ?? vi.fn().mockResolvedValue(undefined);
  const updateAlias = seed.updateAlias ?? vi.fn().mockResolvedValue(undefined);
  const selectDevice = seed.selectDevice ?? vi.fn();
  const refreshSavedDevices = seed.refreshSavedDevices ?? vi.fn().mockResolvedValue(undefined);
  const refreshInstalledApps = seed.refreshInstalledApps ?? vi.fn().mockResolvedValue(undefined);

  useMobileStore.setState({
    tooling: seed.tooling ?? { appium: true, adb: true, libimobiledevice: true },
    appium: { isRunning: false, mode: null, url: 'http://127.0.0.1:4723' },
    devices: seed.devices ?? [],
    savedDevices: seed.savedDevices ?? [],
    capabilities: [],
    activeCapabilityId: null,
    session: { active: false, recording: false },
    lastScreenshot: null,
    lastTest: null,
    output: '',
    scripts: [],
    currentScript: null,
    selectedDeviceKey: seed.selectedDeviceKey ?? null,
    installedApps: seed.installedApps ?? [],
    installedAppsLoading: seed.installedAppsLoading ?? false,
    // Stubs for actions the page must not actually run during tests.
    init: vi.fn().mockResolvedValue(undefined),
    refreshDevices: vi.fn().mockResolvedValue(undefined),
    refreshTooling: vi.fn().mockResolvedValue(undefined),
    startAppium: vi.fn().mockResolvedValue(undefined),
    stopAppium: vi.fn().mockResolvedValue(undefined),
    connectExternal: vi.fn().mockResolvedValue(undefined),
    disconnectExternal: vi.fn().mockResolvedValue(undefined),
    setActiveCapability: vi.fn(),
    saveCapability: vi.fn().mockResolvedValue(undefined),
    removeCapability: vi.fn().mockResolvedValue(undefined),
    testCapability: vi.fn().mockResolvedValue({ ok: true, message: '', durationMs: 0 }),
    startSession: vi.fn().mockResolvedValue(undefined),
    stopSession: vi.fn().mockResolvedValue(undefined),
    screenshot: vi.fn().mockResolvedValue(undefined),
    startRecording: vi.fn().mockResolvedValue(undefined),
    stopRecording: vi.fn().mockResolvedValue(null),
    runScript: vi.fn().mockResolvedValue(undefined),
    listScripts: vi.fn().mockResolvedValue(undefined),
    loadScript: vi.fn().mockResolvedValue(undefined),
    saveScript: vi.fn().mockResolvedValue(undefined),
    deleteScript: vi.fn().mockResolvedValue(undefined),
    mkdirScript: vi.fn().mockResolvedValue(undefined),
    moveScripts: vi.fn().mockResolvedValue({ ok: true }),
    setCurrentScript: vi.fn(),
    saveDevice,
    removeDevice,
    updateAlias,
    selectDevice,
    refreshSavedDevices,
    refreshInstalledApps,
  });

  return {
    saveDevice,
    removeDevice,
    updateAlias,
    selectDevice,
    refreshSavedDevices,
    refreshInstalledApps,
  };
}

const renderPage = () =>
  render(
    <I18nProvider>
      <DevicesPage />
    </I18nProvider>,
  );

const baseLive = (overrides: Partial<MobileDevice> = {}): MobileDevice => ({
  id: 'UDID-1',
  name: 'My iPhone',
  platform: 'ios',
  status: 'connected',
  kind: 'real',
  ...overrides,
});

const baseSaved = (overrides: Partial<SavedDevice> = {}): SavedDevice => ({
  id: 'ios:UDID-1',
  platform: 'ios',
  udid: 'UDID-1',
  name: 'My iPhone',
  lastConnectedAt: '2026-05-22T12:00:00.000Z',
  ...overrides,
});

describe('DevicesPage — my devices + detail panel', () => {
  beforeEach(() => {
    seedStore();
  });

  // AC2 (UI side): when a live device is shown, there is a "save to my devices"
  // CTA that calls saveDevice with a SavedDevice derived from the live one.
  it('AC2: clicking "save to my devices" on a live row calls saveDevice with a SavedDevice payload', async () => {
    const saveDevice = vi.fn().mockResolvedValue(undefined);
    seedStore({
      devices: [baseLive({ id: 'UDID-1', name: 'iPhone 15', platform: 'ios' })],
      saveDevice,
    });
    renderPage();

    const btn = await screen.findByTestId('device-save-btn-UDID-1');
    await userEvent.click(btn);

    expect(saveDevice).toHaveBeenCalledTimes(1);
    const arg = saveDevice.mock.calls[0]![0] as SavedDevice;
    expect(arg).toMatchObject({
      id: 'ios:UDID-1',
      platform: 'ios',
      udid: 'UDID-1',
      name: 'iPhone 15',
    });
    // lastConnectedAt must be a non-empty ISO string from "now".
    expect(typeof arg.lastConnectedAt).toBe('string');
    expect(arg.lastConnectedAt.length).toBeGreaterThan(0);
  });

  // AC2 (UI side): saved devices render in the "my devices" section.
  it('AC2: every entry in savedDevices renders as a row in the my-devices list', () => {
    seedStore({
      savedDevices: [
        baseSaved({ id: 'ios:A', udid: 'A', name: 'iPhone Alice' }),
        baseSaved({ id: 'android:B', udid: 'B', platform: 'android', name: 'Pixel Bob' }),
      ],
    });
    renderPage();

    const list = screen.getByTestId('my-devices-list');
    expect(within(list).getByTestId('my-device-item-ios:A')).toBeInTheDocument();
    expect(within(list).getByTestId('my-device-item-android:B')).toBeInTheDocument();
  });

  // AC6: 연결됨 vs 연결안됨 badge driven by live `devices[]` UDID match.
  it('AC6: saved entry whose UDID is in live devices shows a "connected" status', () => {
    seedStore({
      devices: [baseLive({ id: 'UDID-1', status: 'connected' })],
      savedDevices: [baseSaved({ id: 'ios:UDID-1', udid: 'UDID-1' })],
    });
    renderPage();

    const badge = screen.getByTestId('my-device-status-ios:UDID-1');
    // The badge must carry a stable data attribute the implementer pins, so the
    // test does not depend on translated text.
    expect(badge.getAttribute('data-status')).toBe('connected');
  });

  it('AC6: saved entry whose UDID is NOT in live devices shows "disconnected"', () => {
    seedStore({
      devices: [], // nothing detected
      savedDevices: [baseSaved({ id: 'ios:UDID-1', udid: 'UDID-1' })],
    });
    renderPage();

    const badge = screen.getByTestId('my-device-status-ios:UDID-1');
    expect(badge.getAttribute('data-status')).toBe('disconnected');
  });

  // AC7: selecting a saved entry populates the detail panel with its info.
  it('AC7: clicking a saved entry calls selectDevice(id) and shows the detail panel populated', async () => {
    const selectDevice = vi.fn();
    seedStore({
      savedDevices: [
        baseSaved({ id: 'ios:UDID-1', udid: 'UDID-1', name: 'My iPhone', alias: 'team-ios' }),
      ],
      selectedDeviceKey: 'ios:UDID-1',
      selectDevice,
    });
    renderPage();

    // Detail panel must exist and reflect the selected device.
    const panel = screen.getByTestId('device-detail-panel');
    expect(within(panel).getByTestId('device-detail-name')).toHaveTextContent('My iPhone');
    expect(within(panel).getByTestId('device-detail-udid')).toHaveTextContent('UDID-1');

    // Clicking another row triggers selectDevice with that id.
    cleanup();
    seedStore({
      savedDevices: [
        baseSaved({ id: 'ios:UDID-1', udid: 'UDID-1' }),
        baseSaved({ id: 'android:UDID-2', udid: 'UDID-2', platform: 'android' }),
      ],
      selectDevice,
    });
    renderPage();

    const row = await screen.findByTestId('my-device-item-android:UDID-2');
    await userEvent.click(row);
    expect(selectDevice).toHaveBeenCalledWith('android:UDID-2');
  });

  // AC7: selecting an UNSAVED (live-only) device must show a "save to my devices"
  // CTA in the detail panel (per spec UI flow).
  it('AC7: detail panel for an unsaved live device shows a save-to-my-devices CTA', async () => {
    const saveDevice = vi.fn().mockResolvedValue(undefined);
    seedStore({
      devices: [baseLive({ id: 'UDID-3', name: 'Unsaved iPhone' })],
      savedDevices: [],
      selectedDeviceKey: 'ios:UDID-3', // live device is selected, but not in savedDevices
      saveDevice,
    });
    renderPage();

    const panel = screen.getByTestId('device-detail-panel');
    const cta = within(panel).getByTestId('device-detail-save-btn');
    await userEvent.click(cta);
    expect(saveDevice).toHaveBeenCalledTimes(1);
  });

  // AC7: detail panel for a saved device shows a remove button.
  it('AC7: detail panel for a saved device shows a remove-from-my-devices button → calls removeDevice(id)', async () => {
    const removeDevice = vi.fn().mockResolvedValue(undefined);
    seedStore({
      savedDevices: [baseSaved({ id: 'ios:UDID-1', udid: 'UDID-1' })],
      selectedDeviceKey: 'ios:UDID-1',
      removeDevice,
    });
    renderPage();

    const panel = screen.getByTestId('device-detail-panel');
    const removeBtn = within(panel).getByTestId('device-detail-remove-btn');
    await userEvent.click(removeBtn);
    expect(removeDevice).toHaveBeenCalledWith('ios:UDID-1');
  });

  // AC4 wiring: alias input blur → updateAlias(id, value).
  it('AC4: blurring the alias input in the detail panel calls updateAlias(id, value)', async () => {
    const updateAlias = vi.fn().mockResolvedValue(undefined);
    seedStore({
      savedDevices: [baseSaved({ id: 'ios:UDID-1', udid: 'UDID-1' })],
      selectedDeviceKey: 'ios:UDID-1',
      updateAlias,
    });
    renderPage();

    const panel = screen.getByTestId('device-detail-panel');
    const input = within(panel).getByTestId('device-detail-alias-input') as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, 'team-phone');
    // Blur by tabbing out.
    input.blur();
    expect(updateAlias).toHaveBeenCalledWith('ios:UDID-1', 'team-phone');
  });

  // AC8: re-rendering preserves saved entries because they come from the store
  // (which the implementer will sync from devices.json on init). We assert
  // that on a fresh render, refreshSavedDevices is invoked (so the page picks
  // up the persisted list).
  it('AC8: on mount, the page invokes refreshSavedDevices() to hydrate from devices.json', async () => {
    const refreshSavedDevices = vi.fn().mockResolvedValue(undefined);
    seedStore({ refreshSavedDevices });
    renderPage();
    // The hydrate call must happen at least once on first render.
    // Awaiting a microtask flushes any useEffect.
    await Promise.resolve();
    expect(refreshSavedDevices).toHaveBeenCalled();
  });

});

/*
 * P3 — devices-tabbed-detail-apps
 *
 * Acceptance criteria pinned below (spec §Acceptance criteria, items 1–10):
 *   AC1  Page tabs: 기기 관리 (default active) + 연결 구성.
 *   AC2  기기 관리 keeps P2 layout (live + my-devices + detail panel render).
 *   AC3  Detail panel exposes 정보 / 앱 tabs; the 앱 tab is no longer disabled.
 *   AC4  Activating 앱 → refreshInstalledApps(deviceId) is called and apps render.
 *   AC5  Search input filters by name / bundleId / version (case-insensitive substring).
 *   AC6  Refresh button → refreshInstalledApps(deviceId) is called again.
 *   AC7  Tooling status badge sits in header; userEvent.hover() reveals the overlay.
 *   AC8  Badge data-status="ok" when every tool installed, "missing" when any absent.
 *   AC9  Mock-driver 13-app guarantee is pinned at the API layer (tests/api/device-apps.test.ts).
 *   AC10 연결 구성 tab body shows a single placeholder.
 */
describe('DevicesPage — P3 tabs + apps tab + tooling badge', () => {
  beforeEach(() => {
    seedStore();
  });

  const baseApp = (overrides: Partial<InstalledApp> = {}): InstalledApp => ({
    name: 'Example',
    bundleId: 'com.example.app',
    version: '1.0',
    ...overrides,
  });

  // AC1: both page tabs rendered, 기기 관리 active by default.
  it('AC1: page tabs render and "devices-tab-management" is active by default', () => {
    renderPage();

    const mgmtTab = screen.getByTestId('devices-tab-management');
    const connTab = screen.getByTestId('devices-tab-connection');
    expect(mgmtTab).toBeInTheDocument();
    expect(connTab).toBeInTheDocument();
    // Radix sets data-state="active" on the active trigger.
    expect(mgmtTab.getAttribute('data-state')).toBe('active');
    expect(connTab.getAttribute('data-state')).toBe('inactive');
  });

  // AC1: clicking 연결 구성 switches active tab.
  it('AC1: clicking devices-tab-connection makes it active', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByTestId('devices-tab-connection'));

    expect(screen.getByTestId('devices-tab-connection').getAttribute('data-state')).toBe('active');
    expect(screen.getByTestId('devices-tab-management').getAttribute('data-state')).toBe(
      'inactive',
    );
  });

  // AC2: P2 layout testIds still render inside 기기 관리.
  it('AC2: 기기 관리 (default) keeps P2 layout — my-devices-list & detail panel render', () => {
    seedStore({
      savedDevices: [baseSaved({ id: 'ios:UDID-1', udid: 'UDID-1' })],
      selectedDeviceKey: 'ios:UDID-1',
    });
    renderPage();

    // Live + saved sections (P2) must still be reachable on the default tab.
    expect(screen.getByTestId('my-devices-list')).toBeInTheDocument();
    expect(screen.getByTestId('device-detail-panel')).toBeInTheDocument();
  });

  // AC3: 정보 / 앱 tabs both render; 앱 is no longer disabled (P2 placeholder lifted).
  it('AC3: detail panel has 정보 (default active) and 앱 tabs, 앱 is enabled', () => {
    seedStore({
      savedDevices: [baseSaved({ id: 'ios:UDID-1', udid: 'UDID-1' })],
      selectedDeviceKey: 'ios:UDID-1',
    });
    renderPage();

    const panel = screen.getByTestId('device-detail-panel');
    const infoTab = within(panel).getByTestId('device-detail-tab-info');
    const appsTab = within(panel).getByTestId('device-detail-tab-apps');

    expect(infoTab).toBeInTheDocument();
    expect(appsTab).toBeInTheDocument();
    // Spec AC3: the apps tab is enabled (no longer the disabled placeholder).
    expect(appsTab).not.toBeDisabled();
    // Spec AC3: info tab is the default-active one.
    expect(infoTab.getAttribute('data-state')).toBe('active');
    expect(appsTab.getAttribute('data-state')).toBe('inactive');
  });

  // AC4: activating 앱 → refreshInstalledApps(deviceId) is called.
  it('AC4: clicking 앱 tab calls refreshInstalledApps(deviceId)', async () => {
    const user = userEvent.setup();
    const refreshInstalledApps = vi.fn().mockResolvedValue(undefined);
    seedStore({
      savedDevices: [baseSaved({ id: 'ios:UDID-1', udid: 'UDID-1' })],
      selectedDeviceKey: 'ios:UDID-1',
      refreshInstalledApps,
    });
    renderPage();

    const panel = screen.getByTestId('device-detail-panel');
    await user.click(within(panel).getByTestId('device-detail-tab-apps'));

    await waitFor(() => {
      expect(refreshInstalledApps).toHaveBeenCalled();
    });
    expect(refreshInstalledApps).toHaveBeenCalledWith('ios:UDID-1');
  });

  // AC4: when installedApps state holds entries, they render in a list.
  it('AC4: installedApps entries render as rows under data-testid="device-apps-list"', async () => {
    const user = userEvent.setup();
    seedStore({
      savedDevices: [baseSaved({ id: 'ios:UDID-1', udid: 'UDID-1' })],
      selectedDeviceKey: 'ios:UDID-1',
      installedApps: [
        baseApp({ name: 'Chrome', bundleId: 'com.google.chrome.ios', version: '148.7778.100' }),
        baseApp({ name: 'Safari', bundleId: 'com.apple.mobilesafari', version: '17.0' }),
      ],
    });
    renderPage();

    const panel = screen.getByTestId('device-detail-panel');
    await user.click(within(panel).getByTestId('device-detail-tab-apps'));

    const list = await screen.findByTestId('device-apps-list');
    expect(within(list).getAllByTestId(/^device-apps-row-/)).toHaveLength(2);
    expect(within(list).getByText('Chrome')).toBeInTheDocument();
    expect(within(list).getByText('Safari')).toBeInTheDocument();
  });

  // AC5: substring filter (case-insensitive) on name / bundleId / version.
  it('AC5: search input filters by name (case-insensitive substring)', async () => {
    const user = userEvent.setup();
    seedStore({
      savedDevices: [baseSaved({ id: 'ios:UDID-1', udid: 'UDID-1' })],
      selectedDeviceKey: 'ios:UDID-1',
      installedApps: [
        baseApp({ name: 'Chrome', bundleId: 'com.google.chrome.ios', version: '1.0' }),
        baseApp({ name: 'Safari', bundleId: 'com.apple.mobilesafari', version: '1.0' }),
        baseApp({ name: 'Calculator', bundleId: 'com.apple.calculator', version: '1.0' }),
      ],
    });
    renderPage();

    const panel = screen.getByTestId('device-detail-panel');
    await user.click(within(panel).getByTestId('device-detail-tab-apps'));

    const search = await screen.findByTestId('device-apps-search');
    await user.type(search, 'CHRO'); // upper-case to prove case-insensitive

    const list = screen.getByTestId('device-apps-list');
    const rows = within(list).getAllByTestId(/^device-apps-row-/);
    expect(rows).toHaveLength(1);
    expect(within(rows[0]!).getByText('Chrome')).toBeInTheDocument();
  });

  // AC5: substring filter matches bundleId too.
  it('AC5: search input matches against bundleId', async () => {
    const user = userEvent.setup();
    seedStore({
      savedDevices: [baseSaved({ id: 'ios:UDID-1', udid: 'UDID-1' })],
      selectedDeviceKey: 'ios:UDID-1',
      installedApps: [
        baseApp({ name: 'Chrome', bundleId: 'com.google.chrome.ios', version: '1.0' }),
        baseApp({ name: 'Safari', bundleId: 'com.apple.mobilesafari', version: '1.0' }),
      ],
    });
    renderPage();

    const panel = screen.getByTestId('device-detail-panel');
    await user.click(within(panel).getByTestId('device-detail-tab-apps'));

    const search = await screen.findByTestId('device-apps-search');
    await user.type(search, 'apple');

    const rows = within(screen.getByTestId('device-apps-list')).getAllByTestId(
      /^device-apps-row-/,
    );
    expect(rows).toHaveLength(1);
    expect(within(rows[0]!).getByText('Safari')).toBeInTheDocument();
  });

  // AC5: substring filter matches version too.
  it('AC5: search input matches against version', async () => {
    const user = userEvent.setup();
    seedStore({
      savedDevices: [baseSaved({ id: 'ios:UDID-1', udid: 'UDID-1' })],
      selectedDeviceKey: 'ios:UDID-1',
      installedApps: [
        baseApp({ name: 'A', bundleId: 'com.a', version: '2.7' }),
        baseApp({ name: 'B', bundleId: 'com.b', version: '3.1' }),
      ],
    });
    renderPage();

    const panel = screen.getByTestId('device-detail-panel');
    await user.click(within(panel).getByTestId('device-detail-tab-apps'));

    const search = await screen.findByTestId('device-apps-search');
    await user.type(search, '3.1');

    const rows = within(screen.getByTestId('device-apps-list')).getAllByTestId(
      /^device-apps-row-/,
    );
    expect(rows).toHaveLength(1);
    expect(within(rows[0]!).getByText('B')).toBeInTheDocument();
  });

  // AC6: refresh button → second refreshInstalledApps call.
  it('AC6: refresh button re-calls refreshInstalledApps(deviceId)', async () => {
    const user = userEvent.setup();
    const refreshInstalledApps = vi.fn().mockResolvedValue(undefined);
    seedStore({
      savedDevices: [baseSaved({ id: 'ios:UDID-1', udid: 'UDID-1' })],
      selectedDeviceKey: 'ios:UDID-1',
      installedApps: [baseApp()],
      refreshInstalledApps,
    });
    renderPage();

    const panel = screen.getByTestId('device-detail-panel');
    await user.click(within(panel).getByTestId('device-detail-tab-apps'));

    // First call from tab activation. Reset counter to isolate the refresh click.
    await waitFor(() => expect(refreshInstalledApps).toHaveBeenCalled());
    refreshInstalledApps.mockClear();

    await user.click(await screen.findByTestId('device-apps-refresh'));

    await waitFor(() => {
      expect(refreshInstalledApps).toHaveBeenCalledWith('ios:UDID-1');
    });
  });

  // AC7: tooling status badge sits in the page header (sibling of <h1>) and is hoverable.
  it('AC7: tooling-status-badge renders in header; hover reveals tooling-status-overlay', async () => {
    const user = userEvent.setup();
    seedStore({
      tooling: { appium: true, adb: true, libimobiledevice: true },
    });
    renderPage();

    const badge = screen.getByTestId('tooling-status-badge');
    expect(badge).toBeInTheDocument();

    // Overlay should NOT be visible (not in DOM) before hover.
    expect(screen.queryByTestId('tooling-status-overlay')).not.toBeInTheDocument();

    await user.hover(badge);

    // Overlay appears on hover.
    const overlay = await screen.findByTestId('tooling-status-overlay');
    expect(overlay).toBeInTheDocument();
  });

  // AC7: overlay surfaces all three tools (Appium / ADB / libimobiledevice).
  it('AC7: hover overlay surfaces appium / adb / libimobiledevice rows', async () => {
    const user = userEvent.setup();
    seedStore({
      tooling: { appium: true, adb: false, libimobiledevice: true },
    });
    renderPage();

    await user.hover(screen.getByTestId('tooling-status-badge'));

    const overlay = await screen.findByTestId('tooling-status-overlay');
    expect(within(overlay).getByTestId('tooling-row-appium')).toBeInTheDocument();
    expect(within(overlay).getByTestId('tooling-row-adb')).toBeInTheDocument();
    expect(within(overlay).getByTestId('tooling-row-libimobiledevice')).toBeInTheDocument();
  });

  // AC8: all tools installed → data-status="ok".
  it('AC8: all tools installed → badge data-status="ok"', () => {
    seedStore({
      tooling: { appium: true, adb: true, libimobiledevice: true },
    });
    renderPage();

    const badge = screen.getByTestId('tooling-status-badge');
    expect(badge.getAttribute('data-status')).toBe('ok');
  });

  // AC8: any tool missing → data-status="missing".
  it('AC8: any tool missing → badge data-status="missing"', () => {
    seedStore({
      tooling: { appium: true, adb: false, libimobiledevice: true },
    });
    renderPage();

    const badge = screen.getByTestId('tooling-status-badge');
    expect(badge.getAttribute('data-status')).toBe('missing');
  });

  // AC10: 연결 구성 tab content is just a placeholder testId.
  it('AC10: 연결 구성 tab content shows connection-config-placeholder only', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByTestId('devices-tab-connection'));

    const placeholder = await screen.findByTestId('connection-config-placeholder');
    expect(placeholder).toBeInTheDocument();
    // P2 layout testIds must NOT be visible while the 연결 구성 tab is active.
    expect(screen.queryByTestId('my-devices-list')).not.toBeInTheDocument();
  });

  // The previously-existing P2 layout cards ("도구" / "Appium 서버") were moved
  // into the hover overlay per spec §Scope ("기존 '도구' 카드와 'Appium 서버'
  // 카드는 페이지 본문에서 제거"). The page body must not show them as
  // top-level cards anymore — they only live inside the overlay (revealed on hover).
  it('AC7: legacy tooling/server cards are gone — tooling-row-* invisible until hover', () => {
    seedStore({
      // Force a "missing" state so the install code-block would be rendered if
      // the legacy card were still in the body.
      tooling: { appium: false, adb: false, libimobiledevice: false },
    });
    renderPage();

    // The tooling rows (named per AC7) only exist inside the overlay. Before
    // hover, none of them should be in the DOM.
    expect(screen.queryByTestId('tooling-row-appium')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tooling-row-adb')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tooling-row-libimobiledevice')).not.toBeInTheDocument();
    // The install hint code-blocks (one per missing tool) used to live in the
    // body. After P3 the only place they may appear is inside the hover overlay.
    // Before hover, the install-command code blocks must be absent from the page.
    expect(screen.queryByText('npm i -g appium')).not.toBeInTheDocument();
    expect(screen.queryByText('brew install android-platform-tools')).not.toBeInTheDocument();
    expect(screen.queryByText('brew install libimobiledevice')).not.toBeInTheDocument();
  });
});
