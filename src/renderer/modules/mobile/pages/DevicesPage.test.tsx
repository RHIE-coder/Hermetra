// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '@/lib/i18n';
import { useMobileStore } from '../store';
import { DevicesPage } from './DevicesPage';
import type { MobileDevice, SavedDevice } from '@shared/types/mobile';

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
  saveDevice?: (d: SavedDevice) => Promise<void>;
  removeDevice?: (id: string) => Promise<void>;
  updateAlias?: (id: string, alias: string | null) => Promise<void>;
  selectDevice?: (key: string | null) => void;
  refreshSavedDevices?: () => Promise<void>;
}

function seedStore(seed: StoreSeed = {}) {
  const saveDevice = seed.saveDevice ?? vi.fn().mockResolvedValue(undefined);
  const removeDevice = seed.removeDevice ?? vi.fn().mockResolvedValue(undefined);
  const updateAlias = seed.updateAlias ?? vi.fn().mockResolvedValue(undefined);
  const selectDevice = seed.selectDevice ?? vi.fn();
  const refreshSavedDevices = seed.refreshSavedDevices ?? vi.fn().mockResolvedValue(undefined);

  useMobileStore.setState({
    tooling: { appium: true, adb: true, libimobiledevice: true },
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
  });

  return { saveDevice, removeDevice, updateAlias, selectDevice, refreshSavedDevices };
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

  // P3 placeholder: Apps tab is rendered as disabled in P2 (spec §"Open notes").
  it('P3 placeholder: detail panel renders a disabled "apps" tab trigger', () => {
    seedStore({
      savedDevices: [baseSaved({ id: 'ios:UDID-1', udid: 'UDID-1' })],
      selectedDeviceKey: 'ios:UDID-1',
    });
    renderPage();

    const panel = screen.getByTestId('device-detail-panel');
    const appsTab = within(panel).getByTestId('device-detail-tab-apps');
    expect(appsTab).toBeDisabled();
  });
});
