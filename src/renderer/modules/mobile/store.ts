import { create } from 'zustand';
import type {
  AppiumServerStatus,
  Capability,
  CapabilityTestResult,
  MobileDevice,
  MobileSessionStatus,
  ToolingStatus,
} from '@shared/types/mobile';
import type { ScriptFile, ScriptFileBody } from '@shared/types/web';
import { invoke, subscribe } from '@/services/ipc';
import { CHANNELS } from '@shared/ipc/channels';

let subscribed = false;

interface MobileState {
  tooling: ToolingStatus;
  appium: AppiumServerStatus;
  devices: MobileDevice[];
  capabilities: Capability[];
  activeCapabilityId: string | null;
  session: MobileSessionStatus;
  lastScreenshot: string | null;
  lastTest: CapabilityTestResult | null;
  output: string;
  scripts: ScriptFile[];
  currentScript: ScriptFileBody | null;

  init: () => Promise<void>;
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
  setCurrentScript: (body: ScriptFileBody | null) => void;
}

export const useMobileStore = create<MobileState>((set, get) => ({
  tooling: { appium: false, adb: false, libimobiledevice: false },
  appium: { isRunning: false, mode: null, url: 'http://127.0.0.1:4723' },
  devices: [],
  capabilities: [],
  activeCapabilityId: null,
  session: { active: false, recording: false },
  lastScreenshot: null,
  lastTest: null,
  output: '',
  scripts: [],
  currentScript: null,

  init: async () => {
    const [tooling, appium, devices, capabilities, session, scripts] = await Promise.all([
      invoke(CHANNELS.MOBILE_TOOLING_STATUS),
      invoke(CHANNELS.MOBILE_APPIUM_STATUS),
      invoke(CHANNELS.MOBILE_LIST_DEVICES),
      invoke(CHANNELS.MOBILE_LIST_CAPABILITIES),
      invoke(CHANNELS.MOBILE_SESSION_STATUS),
      invoke(CHANNELS.MOBILE_SCRIPTS_LIST),
    ]);
    set({
      tooling,
      appium,
      devices,
      capabilities,
      session,
      scripts,
      activeCapabilityId: capabilities[0]?.id ?? null,
    });

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

  setCurrentScript: (body) => set({ currentScript: body }),
}));
