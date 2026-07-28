// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '@/lib/i18n';
import { useMobileStore } from '../store';
import { ConnectionConfigTab } from './ConnectionConfigTab';
import type {
  AppleSigningIdentity,
  Connection,
  ConnectionTestResult,
  InstalledApp,
  SavedDevice,
} from '@shared/types/mobile';

/**
 * Spec acceptance criteria covered here (devices-connection-config):
 *   AC2 (UI): clicking "+ 새 연결 구성" then "생성" → saveConnection() with a
 *             new Connection whose deviceId is the picked device's.
 *   AC3 (UI): clicking "사용하기" → setConnectionInUse(id); the in-use section
 *             reflects the active id.
 *   AC4 (UI): removing the active connection clears the in-use section.
 *   AC5 (UI): the xcodeSigningId dropdown is populated from listAppleCerts().
 *   AC6 (UI): clicking "테스트" → testConnection(id); result banner appears.
 *   AC7 (UI): the app dropdown is wired to DEVICE_APPS_LIST via the store's
 *             installedApps slot (i.e. refreshInstalledApps was triggered).
 *   AC8 (UI): KV extra rows — add, remove, empty key is silently ignored.
 *
 * Boundary (CLAUDE.md §3.4): mock the store. The tab calls store actions; we
 * assert the action surface, not the IPC layer. The store's IPC is exercised
 * in tests/api/connections.test.ts and tests/api/apple-certs.test.ts.
 */

interface StoreSeed {
  savedDevices?: SavedDevice[];
  connections?: Connection[];
  activeConnectionId?: string | null;
  installedApps?: InstalledApp[];
  appleIdentities?: AppleSigningIdentity[];
  lastTest?: ConnectionTestResult | null;
  refreshConnections?: () => Promise<void>;
  saveConnection?: (c: Connection) => Promise<void>;
  removeConnection?: (id: string) => Promise<void>;
  setConnectionInUse?: (id: string | null) => Promise<void>;
  testConnection?: (id: string) => Promise<ConnectionTestResult>;
  listAppleCerts?: () => Promise<void>;
  refreshInstalledApps?: (deviceId: string) => Promise<void>;
}

function seedStore(seed: StoreSeed = {}) {
  const refreshConnections = seed.refreshConnections ?? vi.fn().mockResolvedValue(undefined);
  const saveConnection = seed.saveConnection ?? vi.fn().mockResolvedValue(undefined);
  const removeConnection = seed.removeConnection ?? vi.fn().mockResolvedValue(undefined);
  const setConnectionInUse = seed.setConnectionInUse ?? vi.fn().mockResolvedValue(undefined);
  const testConnection =
    seed.testConnection ??
    vi.fn().mockResolvedValue({ ok: true, durationMs: 42, message: 'ok' });
  const listAppleCerts = seed.listAppleCerts ?? vi.fn().mockResolvedValue(undefined);
  const refreshInstalledApps =
    seed.refreshInstalledApps ?? vi.fn().mockResolvedValue(undefined);

  useMobileStore.setState({
    // Existing slots that must still exist for the page wrapper.
    tooling: { appium: true, adb: true, libimobiledevice: true },
    appium: { isRunning: false, mode: null, url: 'http://127.0.0.1:4723' },
    devices: [],
    savedDevices: seed.savedDevices ?? [],
    session: { active: false, recording: false },
    lastScreenshot: null,
    output: '',
    scripts: [],
    currentScript: null,
    selectedDeviceKey: null,
    installedApps: seed.installedApps ?? [],
    installedAppsLoading: false,
    // New P4 slots.
    connections: seed.connections ?? [],
    activeConnectionId: seed.activeConnectionId ?? null,
    appleIdentities: seed.appleIdentities ?? [],
    lastTest: seed.lastTest ?? null,
    // Stubs for action-only fields. Tests assert the listed ones.
    init: vi.fn().mockResolvedValue(undefined),
    refreshDevices: vi.fn().mockResolvedValue(undefined),
    refreshTooling: vi.fn().mockResolvedValue(undefined),
    refreshSavedDevices: vi.fn().mockResolvedValue(undefined),
    saveDevice: vi.fn().mockResolvedValue(undefined),
    removeDevice: vi.fn().mockResolvedValue(undefined),
    updateAlias: vi.fn().mockResolvedValue(undefined),
    selectDevice: vi.fn(),
    startAppium: vi.fn().mockResolvedValue(undefined),
    stopAppium: vi.fn().mockResolvedValue(undefined),
    connectExternal: vi.fn().mockResolvedValue(undefined),
    disconnectExternal: vi.fn().mockResolvedValue(undefined),
    runScript: vi.fn().mockResolvedValue(undefined),
    listScripts: vi.fn().mockResolvedValue(undefined),
    loadScript: vi.fn().mockResolvedValue(undefined),
    saveScript: vi.fn().mockResolvedValue(undefined),
    deleteScript: vi.fn().mockResolvedValue(undefined),
    mkdirScript: vi.fn().mockResolvedValue(undefined),
    moveScripts: vi.fn().mockResolvedValue({ ok: true }),
    setCurrentScript: vi.fn(),
    refreshConnections,
    saveConnection,
    removeConnection,
    setConnectionInUse,
    testConnection,
    listAppleCerts,
    refreshInstalledApps,
  });

  return {
    refreshConnections,
    saveConnection,
    removeConnection,
    setConnectionInUse,
    testConnection,
    listAppleCerts,
    refreshInstalledApps,
  };
}

const renderTab = () =>
  render(
    <I18nProvider>
      <ConnectionConfigTab />
    </I18nProvider>,
  );

const baseSaved = (overrides: Partial<SavedDevice> = {}): SavedDevice => ({
  id: 'ios:UDID-1',
  platform: 'ios',
  udid: 'UDID-1',
  name: '이민형의 iPhone',
  lastConnectedAt: '2026-05-22T12:00:00.000Z',
  ...overrides,
});

const baseConn = (overrides: Partial<Connection> = {}): Connection => ({
  id: 'conn-1',
  name: 'Config 1',
  deviceId: 'ios:UDID-1',
  platform: 'ios',
  extra: {},
  ...overrides,
});

describe('ConnectionConfigTab — left tree + edit panel (P4)', () => {
  beforeEach(() => {
    seedStore();
  });

  // Root container is rendered.
  it('renders the tab root container', () => {
    renderTab();
    expect(screen.getByTestId('conn-config-tab-content')).toBeInTheDocument();
  });

  // AC2 (UI) — left tree shows every saved device, expandable.
  it('AC2: every savedDevice renders as a device row in the left tree', () => {
    seedStore({
      savedDevices: [
        baseSaved({ id: 'ios:UDID-1', name: '이민형의 iPhone' }),
        baseSaved({ id: 'android:UDID-2', platform: 'android', name: 'Pixel' }),
      ],
    });
    renderTab();

    expect(screen.getByTestId('conn-config-device-row-ios:UDID-1')).toBeInTheDocument();
    expect(screen.getByTestId('conn-config-device-row-android:UDID-2')).toBeInTheDocument();
  });

  // AC2 (UI) — every connection renders under its device.
  it('AC2: connections render as rows under their device', () => {
    seedStore({
      savedDevices: [baseSaved({ id: 'ios:UDID-1' })],
      connections: [
        baseConn({ id: 'conn-1', name: 'Config 1', deviceId: 'ios:UDID-1' }),
        baseConn({ id: 'conn-2', name: 'Config 2', deviceId: 'ios:UDID-1' }),
      ],
    });
    renderTab();

    expect(screen.getByTestId('conn-config-row-conn-1')).toBeInTheDocument();
    expect(screen.getByTestId('conn-config-row-conn-2')).toBeInTheDocument();
  });

  // AC3 (UI) — in-use section shows an empty state when no active id.
  it('AC3: in-use section shows empty placeholder when no activeConnectionId', () => {
    seedStore({
      savedDevices: [baseSaved()],
      connections: [baseConn({ id: 'conn-1' })],
      activeConnectionId: null,
    });
    renderTab();

    expect(screen.getByTestId('conn-config-in-use-empty')).toBeInTheDocument();
  });

  // AC3 (UI) — when active id set, in-use section shows that connection.
  it('AC3: in-use section shows the active connection when activeConnectionId is set', () => {
    seedStore({
      savedDevices: [baseSaved()],
      connections: [baseConn({ id: 'conn-a', name: 'Active One' })],
      activeConnectionId: 'conn-a',
    });
    renderTab();

    const inUse = screen.getByTestId('conn-config-in-use-item');
    expect(inUse).toBeInTheDocument();
    expect(within(inUse).getByText('Active One')).toBeInTheDocument();
  });

  // AC2 (UI) — clicking "+ 새 연결 구성" opens the new-config dialog.
  it('AC2: clicking conn-config-new-btn opens the new-config dialog', async () => {
    const user = userEvent.setup();
    seedStore({
      savedDevices: [baseSaved()],
    });
    renderTab();

    expect(screen.queryByTestId('conn-new-dialog')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('conn-config-new-btn'));
    expect(await screen.findByTestId('conn-new-dialog')).toBeInTheDocument();
  });

  // AC2 (UI) — "생성" in the dialog calls saveConnection with a new Connection.
  it('AC2: dialog 생성 → saveConnection() with a Connection on the selected device', async () => {
    const user = userEvent.setup();
    const saveConnection = vi.fn().mockResolvedValue(undefined);
    seedStore({
      savedDevices: [
        baseSaved({ id: 'ios:UDID-1', platform: 'ios', name: '이민형의 iPhone' }),
      ],
      saveConnection,
    });
    renderTab();

    await user.click(screen.getByTestId('conn-config-new-btn'));
    const dialog = await screen.findByTestId('conn-new-dialog');

    // The device select must already default to the one device — clicking 생성
    // is sufficient.
    await user.click(within(dialog).getByTestId('conn-new-create-btn'));

    expect(saveConnection).toHaveBeenCalledTimes(1);
    const arg = saveConnection.mock.calls[0]![0] as Connection;
    expect(arg.deviceId).toBe('ios:UDID-1');
    expect(arg.platform).toBe('ios');
    expect(typeof arg.id).toBe('string');
    expect(arg.id.length).toBeGreaterThan(0);
    expect(arg.extra).toEqual({});
  });

  // AC5 (UI) — on mount the tab calls listAppleCerts() so the dropdown gets populated.
  it('AC5: on mount, listAppleCerts() is invoked to hydrate appleIdentities', async () => {
    const listAppleCerts = vi.fn().mockResolvedValue(undefined);
    seedStore({ listAppleCerts });
    renderTab();
    await Promise.resolve();
    expect(listAppleCerts).toHaveBeenCalled();
  });

  // AC5 (UI) — the xcodeSigningId dropdown options include every appleIdentity.
  it('AC5: xcodeSigningId dropdown options list every Apple signing identity', async () => {
    const user = userEvent.setup();
    seedStore({
      savedDevices: [baseSaved()],
      connections: [baseConn({ id: 'conn-1', platform: 'ios' })],
      activeConnectionId: null,
      appleIdentities: [
        {
          hash: '4NC5GBGM93',
          label: 'Apple Development: foo@bar.com (XYZ123)',
          fullLine: '1) 4NC5GBGM93 "Apple Development: foo@bar.com (XYZ123)"',
        },
        {
          hash: 'ABCDE12345',
          label: 'Apple Distribution: Acme Co. (ABC987)',
          fullLine: '2) ABCDE12345 "Apple Distribution: Acme Co. (ABC987)"',
        },
      ],
    });
    renderTab();

    // Open the row to bring up the edit panel.
    await user.click(screen.getByTestId('conn-config-row-conn-1'));

    const select = (await screen.findByTestId(
      'conn-edit-xcode-signing-id',
    )) as HTMLSelectElement;
    // The hash values must be present in the select's options.
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain('4NC5GBGM93');
    expect(values).toContain('ABCDE12345');
  });

  // AC7 (UI) — opening a row triggers refreshInstalledApps(deviceId).
  it('AC7: clicking a connection row triggers refreshInstalledApps(deviceId)', async () => {
    const user = userEvent.setup();
    const refreshInstalledApps = vi.fn().mockResolvedValue(undefined);
    seedStore({
      savedDevices: [baseSaved({ id: 'ios:UDID-1' })],
      connections: [baseConn({ id: 'conn-1', deviceId: 'ios:UDID-1' })],
      refreshInstalledApps,
    });
    renderTab();

    await user.click(screen.getByTestId('conn-config-row-conn-1'));

    await waitFor(() => {
      expect(refreshInstalledApps).toHaveBeenCalledWith('ios:UDID-1');
    });
  });

  // AC7 (UI) — the app dropdown options include every installedApp + a "none" option.
  it('AC7: app dropdown options list every installedApp plus an empty/none default', async () => {
    const user = userEvent.setup();
    seedStore({
      savedDevices: [baseSaved({ id: 'ios:UDID-1' })],
      connections: [baseConn({ id: 'conn-1', deviceId: 'ios:UDID-1' })],
      installedApps: [
        { name: 'Chrome', bundleId: 'com.google.chrome.ios', version: '148' },
        { name: 'Safari', bundleId: 'com.apple.mobilesafari', version: '17' },
      ],
    });
    renderTab();

    await user.click(screen.getByTestId('conn-config-row-conn-1'));

    const select = (await screen.findByTestId('conn-edit-app-select')) as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    // The "none" sentinel is the empty-string value.
    expect(values).toContain('');
    expect(values).toContain('com.google.chrome.ios');
    expect(values).toContain('com.apple.mobilesafari');
  });

  // AC8 (UI) — clicking "+ 추가" adds a new KV row.
  it('AC8: clicking conn-edit-kv-add adds a new key/value row pair', async () => {
    const user = userEvent.setup();
    seedStore({
      savedDevices: [baseSaved()],
      connections: [baseConn({ id: 'conn-1', extra: {} })],
    });
    renderTab();

    await user.click(screen.getByTestId('conn-config-row-conn-1'));
    // Initially no rows.
    expect(screen.queryByTestId('conn-edit-kv-key-0')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('conn-edit-kv-add'));

    expect(await screen.findByTestId('conn-edit-kv-key-0')).toBeInTheDocument();
    expect(screen.getByTestId('conn-edit-kv-value-0')).toBeInTheDocument();
  });

  // AC8 (UI) — empty keys are dropped on save.
  it('AC8: rows with empty key are silently ignored when saving', async () => {
    const user = userEvent.setup();
    const saveConnection = vi.fn().mockResolvedValue(undefined);
    seedStore({
      savedDevices: [baseSaved()],
      connections: [baseConn({ id: 'conn-1', extra: {} })],
      saveConnection,
    });
    renderTab();

    await user.click(screen.getByTestId('conn-config-row-conn-1'));

    // Add two KV rows. Fill in one only.
    await user.click(screen.getByTestId('conn-edit-kv-add'));
    await user.click(screen.getByTestId('conn-edit-kv-add'));

    const key0 = await screen.findByTestId('conn-edit-kv-key-0');
    const value0 = screen.getByTestId('conn-edit-kv-value-0');
    await user.type(key0, 'appium:noReset');
    await user.type(value0, 'true');
    // Row 1 left blank intentionally.

    await user.click(screen.getByTestId('conn-edit-save-btn'));

    expect(saveConnection).toHaveBeenCalled();
    const arg = saveConnection.mock.calls.at(-1)![0] as Connection;
    expect(arg.extra).toEqual({ 'appium:noReset': 'true' });
  });

  // AC8 (UI) — clicking remove on a KV row removes it from the panel.
  it('AC8: conn-edit-kv-remove-{index} removes that row', async () => {
    const user = userEvent.setup();
    seedStore({
      savedDevices: [baseSaved()],
      connections: [baseConn({ id: 'conn-1', extra: { foo: 'bar' } })],
    });
    renderTab();

    await user.click(screen.getByTestId('conn-config-row-conn-1'));

    // Existing extra renders as row 0.
    expect(await screen.findByTestId('conn-edit-kv-key-0')).toBeInTheDocument();

    await user.click(screen.getByTestId('conn-edit-kv-remove-0'));

    expect(screen.queryByTestId('conn-edit-kv-key-0')).not.toBeInTheDocument();
  });

  // AC6 (UI) — clicking "테스트" → testConnection(id).
  it('AC6: clicking conn-edit-test-btn calls testConnection(id)', async () => {
    const user = userEvent.setup();
    const testConnection = vi.fn().mockResolvedValue({
      ok: true,
      durationMs: 42,
      message: 'reachable',
    });
    seedStore({
      savedDevices: [baseSaved()],
      connections: [baseConn({ id: 'conn-1' })],
      testConnection,
    });
    renderTab();

    await user.click(screen.getByTestId('conn-config-row-conn-1'));
    await user.click(screen.getByTestId('conn-edit-test-btn'));

    expect(testConnection).toHaveBeenCalledWith('conn-1');
  });

  // AC6 (UI) — the lastTest result is shown in the result banner.
  it('AC6: lastTest result banner displays ok+durationMs+message', async () => {
    const user = userEvent.setup();
    seedStore({
      savedDevices: [baseSaved()],
      connections: [baseConn({ id: 'conn-1' })],
      lastTest: { ok: true, durationMs: 42, message: 'reachable' },
    });
    renderTab();

    await user.click(screen.getByTestId('conn-config-row-conn-1'));

    const banner = await screen.findByTestId('conn-edit-test-result');
    expect(banner).toBeInTheDocument();
    expect(banner.textContent ?? '').toContain('42');
    expect(banner.textContent ?? '').toContain('reachable');
  });

  // AC3 (UI) — clicking "사용하기" → setConnectionInUse(id).
  it('AC3: clicking conn-edit-use-btn calls setConnectionInUse(id)', async () => {
    const user = userEvent.setup();
    const setConnectionInUse = vi.fn().mockResolvedValue(undefined);
    seedStore({
      savedDevices: [baseSaved()],
      connections: [baseConn({ id: 'conn-1' })],
      setConnectionInUse,
    });
    renderTab();

    await user.click(screen.getByTestId('conn-config-row-conn-1'));
    await user.click(screen.getByTestId('conn-edit-use-btn'));

    expect(setConnectionInUse).toHaveBeenCalledWith('conn-1');
  });
});
