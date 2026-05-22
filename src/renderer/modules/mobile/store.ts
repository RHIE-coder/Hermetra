import { create } from 'zustand';
import type {
  AppiumServerStatus,
  AppleSigningIdentity,
  Capability,
  CapabilityTestResult,
  Connection,
  ConnectionTestResult,
  InspectorElement,
  InspectorSessionState,
  InstalledApp,
  MobileDevice,
  MobileSessionStatus,
  SavedDevice,
  ToolingStatus,
} from '@shared/types/mobile';
import type {
  ScriptFile,
  ScriptFileBody,
  ScriptMoveRequest,
  ScriptMoveResult,
} from '@shared/types/web';
import { invoke, subscribe } from '@/services/ipc';
import { CHANNELS } from '@shared/ipc/channels';

let subscribed = false;

interface MobileState {
  tooling: ToolingStatus;
  appium: AppiumServerStatus;
  devices: MobileDevice[];
  savedDevices: SavedDevice[];
  capabilities: Capability[];
  activeCapabilityId: string | null;
  // P4 — connection configs (per-workspace). Replaces capability concept.
  connections: Connection[];
  activeConnectionId: string | null;
  appleIdentities: AppleSigningIdentity[];
  session: MobileSessionStatus;
  lastScreenshot: string | null;
  lastTest: CapabilityTestResult | ConnectionTestResult | null;
  output: string;
  scripts: ScriptFile[];
  currentScript: ScriptFileBody | null;
  selectedDeviceKey: string | null;
  installedApps: InstalledApp[];
  installedAppsLoading: boolean;
  // Inspector (mobile-inspector-page / P5)
  inspectorSession: InspectorSessionState;
  inspectorScreenshot: string | null;
  inspectorVideo: string | null;
  nativeTree: InspectorElement[];
  webviewTree: InspectorElement[];
  selectedElementId: string | null;

  init: () => Promise<void>;
  refreshInstalledApps: (deviceId: string) => Promise<void>;
  refreshSavedDevices: () => Promise<void>;
  saveDevice: (device: SavedDevice) => Promise<void>;
  removeDevice: (id: string) => Promise<void>;
  updateAlias: (id: string, alias: string | null) => Promise<void>;
  selectDevice: (key: string | null) => void;
  refreshDevices: () => Promise<void>;
  refreshTooling: () => Promise<void>;
  startAppium: (port?: number) => Promise<void>;
  stopAppium: () => Promise<void>;
  connectExternal: (url: string) => Promise<void>;
  disconnectExternal: () => Promise<void>;
  setActiveCapability: (id: string | null) => void;
  saveCapability: (c: Capability) => Promise<void>;
  removeCapability: (id: string) => Promise<void>;
  testCapability: (id: string) => Promise<CapabilityTestResult>;
  // P4 — connection actions.
  refreshConnections: () => Promise<void>;
  saveConnection: (c: Connection) => Promise<void>;
  removeConnection: (id: string) => Promise<void>;
  useConnection: (id: string | null) => Promise<void>;
  testConnection: (id: string) => Promise<ConnectionTestResult>;
  listAppleCerts: () => Promise<void>;
  startSession: (capabilityId: string) => Promise<void>;
  stopSession: () => Promise<void>;
  screenshot: () => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<{ dataUrl: string } | null>;
  runScript: (source: string) => Promise<void>;
  // scripts
  listScripts: () => Promise<void>;
  loadScript: (path: string) => Promise<void>;
  saveScript: (body: ScriptFileBody) => Promise<void>;
  deleteScript: (path: string) => Promise<void>;
  mkdirScript: (path: string) => Promise<void>;
  moveScripts: (moves: ScriptMoveRequest[]) => Promise<ScriptMoveResult>;
  setCurrentScript: (body: ScriptFileBody | null) => void;
  // Inspector actions (P5)
  startInspectorSession: () => Promise<void>;
  stopInspectorSession: () => Promise<void>;
  captureInspectorScreenshot: () => Promise<void>;
  startInspectorRecording: () => Promise<void>;
  stopInspectorRecording: () => Promise<void>;
  fetchInspectorElements: () => Promise<void>;
  selectInspectorElement: (id: string | null) => void;
}

export const useMobileStore = create<MobileState>((set, get) => ({
  tooling: { appium: false, adb: false, libimobiledevice: false },
  appium: { isRunning: false, mode: null, url: 'http://127.0.0.1:4723' },
  devices: [],
  savedDevices: [],
  capabilities: [],
  activeCapabilityId: null,
  connections: [],
  activeConnectionId: null,
  appleIdentities: [],
  session: { active: false, recording: false },
  lastScreenshot: null,
  lastTest: null,
  output: '',
  scripts: [],
  currentScript: null,
  selectedDeviceKey: null,
  installedApps: [],
  installedAppsLoading: false,
  inspectorSession: { active: false, recording: false, context: null },
  inspectorScreenshot: null,
  inspectorVideo: null,
  nativeTree: [],
  webviewTree: [],
  selectedElementId: null,

  refreshInstalledApps: async (deviceId: string) => {
    set({ installedAppsLoading: true });
    try {
      const { apps } = await invoke(CHANNELS.DEVICE_APPS_LIST, { deviceId });
      set({ installedApps: apps });
    } catch {
      set({ installedApps: [] });
    } finally {
      set({ installedAppsLoading: false });
    }
  },

  refreshSavedDevices: async () => {
    const { devices } = await invoke(CHANNELS.DEVICE_LIST_SAVED);
    set({ savedDevices: devices });
  },
  saveDevice: async (device: SavedDevice) => {
    await invoke(CHANNELS.DEVICE_SAVE, { device });
    const { devices } = await invoke(CHANNELS.DEVICE_LIST_SAVED);
    set({ savedDevices: devices });
  },
  removeDevice: async (id: string) => {
    await invoke(CHANNELS.DEVICE_REMOVE, { id });
    const { devices } = await invoke(CHANNELS.DEVICE_LIST_SAVED);
    set({ savedDevices: devices });
  },
  updateAlias: async (id: string, alias: string | null) => {
    await invoke(CHANNELS.DEVICE_UPDATE_ALIAS, { id, alias });
    const { devices } = await invoke(CHANNELS.DEVICE_LIST_SAVED);
    set({ savedDevices: devices });
  },
  selectDevice: (key: string | null) => set({ selectedDeviceKey: key }),

  init: async () => {
    const [tooling, appium, devices, session, scripts] = await Promise.all([
      invoke(CHANNELS.MOBILE_TOOLING_STATUS),
      invoke(CHANNELS.MOBILE_APPIUM_STATUS),
      invoke(CHANNELS.MOBILE_LIST_DEVICES),
      invoke(CHANNELS.MOBILE_SESSION_STATUS),
      invoke(CHANNELS.MOBILE_SCRIPTS_LIST),
    ]);
    set({ tooling, appium, devices, session, scripts });

    if (subscribed) return;
    subscribed = true;
    subscribe(CHANNELS.EVT_DEVICE_UPDATE, (devs) => set({ devices: devs }));
    subscribe(CHANNELS.EVT_APPIUM_UPDATE, (s) => set({ appium: s }));
    subscribe(CHANNELS.EVT_SESSION_UPDATE, (s) => set({ session: s }));
  },

  refreshDevices: async () => {
    const devices = await invoke(CHANNELS.MOBILE_LIST_DEVICES);
    set({ devices });
  },

  refreshTooling: async () => {
    const tooling = await invoke(CHANNELS.MOBILE_TOOLING_STATUS);
    set({ tooling });
  },

  startAppium: async (port) => {
    const appium = await invoke(CHANNELS.MOBILE_APPIUM_START, { port });
    set({ appium });
  },

  stopAppium: async () => {
    const appium = await invoke(CHANNELS.MOBILE_APPIUM_STOP);
    set({ appium });
  },

  connectExternal: async (url) => {
    const appium = await invoke(CHANNELS.MOBILE_APPIUM_CONNECT_EXTERNAL, { url });
    set({ appium });
  },

  disconnectExternal: async () => {
    const appium = await invoke(CHANNELS.MOBILE_APPIUM_DISCONNECT_EXTERNAL);
    set({ appium });
  },

  setActiveCapability: (id) => set({ activeCapabilityId: id }),

  saveCapability: async (c) => {
    const capabilities = await invoke(CHANNELS.MOBILE_SAVE_CAPABILITY, c);
    set({ capabilities });
    if (!get().activeCapabilityId) set({ activeCapabilityId: c.id });
  },

  removeCapability: async (id) => {
    const capabilities = await invoke(CHANNELS.MOBILE_REMOVE_CAPABILITY, { id });
    set({ capabilities });
    if (get().activeCapabilityId === id) set({ activeCapabilityId: capabilities[0]?.id ?? null });
  },

  testCapability: async (id) => {
    const result = await invoke(CHANNELS.MOBILE_TEST_CAPABILITY, { id });
    set({ lastTest: result });
    return result;
  },

  /* P4 — connection actions (per-workspace). */
  refreshConnections: async () => {
    try {
      const { connections, activeId } = await invoke(CHANNELS.CONN_LIST);
      set({ connections, activeConnectionId: activeId });
    } catch {
      /* bridge unavailable (e.g. happy-dom test without preload) — leave state. */
    }
  },

  saveConnection: async (connection) => {
    await invoke(CHANNELS.CONN_SAVE, { connection });
    const { connections, activeId } = await invoke(CHANNELS.CONN_LIST);
    set({ connections, activeConnectionId: activeId });
  },

  removeConnection: async (id) => {
    await invoke(CHANNELS.CONN_REMOVE, { id });
    const { connections, activeId } = await invoke(CHANNELS.CONN_LIST);
    set({ connections, activeConnectionId: activeId });
  },

  useConnection: async (id) => {
    await invoke(CHANNELS.CONN_USE, { id });
    const { connections, activeId } = await invoke(CHANNELS.CONN_LIST);
    set({ connections, activeConnectionId: activeId });
  },

  testConnection: async (id) => {
    const result = await invoke(CHANNELS.CONN_TEST, { id });
    set({ lastTest: result });
    return result;
  },

  listAppleCerts: async () => {
    try {
      const { identities } = await invoke(CHANNELS.APPLE_CERTS_LIST);
      set({ appleIdentities: identities });
    } catch {
      /* bridge unavailable (e.g. happy-dom test without preload) — leave state. */
    }
  },

  startSession: async (capabilityId) => {
    const session = await invoke(CHANNELS.MOBILE_SESSION_START, { capabilityId });
    set({ session });
  },

  stopSession: async () => {
    const session = await invoke(CHANNELS.MOBILE_SESSION_STOP);
    set({ session, lastScreenshot: null });
  },

  screenshot: async () => {
    const { dataUrl } = await invoke(CHANNELS.MOBILE_SESSION_SCREENSHOT);
    set({ lastScreenshot: dataUrl });
  },

  startRecording: async () => {
    const session = await invoke(CHANNELS.MOBILE_SESSION_RECORD_START);
    set({ session });
  },

  stopRecording: async () => {
    const { dataUrl, status } = await invoke(CHANNELS.MOBILE_SESSION_RECORD_STOP);
    set({ session: status });
    return { dataUrl };
  },

  runScript: async (source) => {
    const cap = get().activeCapabilityId;
    if (!cap) return;
    const result = await invoke(CHANNELS.MOBILE_RUN_SCRIPT, { source, capabilityId: cap });
    set({ output: result.output });
  },

  listScripts: async () => {
    const scripts = await invoke(CHANNELS.MOBILE_SCRIPTS_LIST);
    set({ scripts });
  },

  loadScript: async (path) => {
    const body = await invoke(CHANNELS.MOBILE_SCRIPTS_READ, { path });
    set({ currentScript: body });
  },

  saveScript: async (body) => {
    const scripts = await invoke(CHANNELS.MOBILE_SCRIPTS_SAVE, body);
    set({ scripts, currentScript: body });
  },

  deleteScript: async (path) => {
    const scripts = await invoke(CHANNELS.MOBILE_SCRIPTS_DELETE, { path });
    set({ scripts });
    if (get().currentScript?.path === path) set({ currentScript: null });
  },

  mkdirScript: async (path) => {
    const scripts = await invoke(CHANNELS.MOBILE_SCRIPTS_MKDIR, { path });
    set({ scripts });
  },

  moveScripts: async (moves) => {
    try {
      const scripts = await invoke(CHANNELS.MOBILE_SCRIPTS_MOVE, { moves });
      set({ scripts });
      return { ok: true };
    } catch (e) {
      const err = e as { message?: string; conflicts?: string[] };
      const message = err.message ?? String(e);
      const conflicts = Array.isArray(err.conflicts) ? err.conflicts : [];
      return { ok: false, error: message, conflicts };
    }
  },

  setCurrentScript: (body) => set({ currentScript: body }),

  /* Inspector (P5). Mirrors the IPC channel surface 1:1. */
  startInspectorSession: async () => {
    const result = await invoke(CHANNELS.INSPECTOR_START_SESSION);
    if (result.ok) {
      set((s) => ({
        inspectorSession: { ...s.inspectorSession, active: true, context: 'NATIVE_APP' },
      }));
    }
  },

  stopInspectorSession: async () => {
    await invoke(CHANNELS.INSPECTOR_STOP_SESSION);
    set({
      inspectorSession: { active: false, recording: false, context: null },
      inspectorScreenshot: null,
      inspectorVideo: null,
      nativeTree: [],
      webviewTree: [],
      selectedElementId: null,
    });
  },

  captureInspectorScreenshot: async () => {
    const { dataUrl } = await invoke(CHANNELS.INSPECTOR_SCREENSHOT);
    set({ inspectorScreenshot: dataUrl });
  },

  startInspectorRecording: async () => {
    await invoke(CHANNELS.INSPECTOR_START_RECORD);
    set((s) => ({
      inspectorSession: { ...s.inspectorSession, recording: true },
    }));
  },

  stopInspectorRecording: async () => {
    const { dataUrl } = await invoke(CHANNELS.INSPECTOR_STOP_RECORD);
    set((s) => ({
      inspectorSession: { ...s.inspectorSession, recording: false },
      inspectorVideo: dataUrl,
    }));
  },

  fetchInspectorElements: async () => {
    const { native, webview } = await invoke(CHANNELS.INSPECTOR_GET_ELEMENTS);
    set({ nativeTree: native, webviewTree: webview });
  },

  selectInspectorElement: (id) => set({ selectedElementId: id }),
}));
