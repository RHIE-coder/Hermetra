import type {
  RemoteBrowserStatus,
  BrowserPage,
  UrlBookmark,
  WebScriptRunResult,
  ScriptFile,
  ScriptFileBody,
} from '../types/web';
import type {
  Workspace,
  WorkspaceState,
  BrowserInstallState,
  BrowserInstallLog,
} from '../types/workspace';
import type {
  ToolingStatus,
  MobileDevice,
  Capability,
  AppiumServerStatus,
  MobileSessionStatus,
  CapabilityTestResult,
} from '../types/mobile';
import type { VariablesDocument } from '../types/variables';
import type {
  BridgeEvent,
  BusVar,
  Scenario,
  ScenarioRunUpdate,
} from '../types/bridge';

/**
 * Typed registry of every IPC channel.
 *
 * Channel names live in `CHANNELS` for grep-ability; the `IpcContract`
 * type pins request/response shape per channel so the renderer's
 * `window.bridge.<channel>(input)` call is type-checked end-to-end.
 */
export const CHANNELS = {
  // Web — Remote Browser
  WEB_RB_STATUS: 'web:rb:status',
  WEB_RB_START: 'web:rb:start',
  WEB_RB_STOP: 'web:rb:stop',
  WEB_RB_LIST_PAGES: 'web:rb:list-pages',
  WEB_RB_NAVIGATE: 'web:rb:navigate',
  WEB_RB_NEW_TAB: 'web:rb:new-tab',
  WEB_RB_CLOSE_PAGE: 'web:rb:close-page',
  WEB_RB_SET_ACTIVE: 'web:rb:set-active',
  WEB_RB_LIST_BOOKMARKS: 'web:rb:list-bookmarks',
  WEB_RB_SAVE_BOOKMARK: 'web:rb:save-bookmark',
  WEB_RB_REMOVE_BOOKMARK: 'web:rb:remove-bookmark',
  WEB_RUN_SCRIPT: 'web:run-script',

  // Web — Scripts (file management)
  WEB_SCRIPTS_LIST: 'web:scripts:list',
  WEB_SCRIPTS_READ: 'web:scripts:read',
  WEB_SCRIPTS_SAVE: 'web:scripts:save',
  WEB_SCRIPTS_DELETE: 'web:scripts:delete',

  // Mobile
  MOBILE_TOOLING_STATUS: 'mobile:tooling-status',
  MOBILE_APPIUM_STATUS: 'mobile:appium:status',
  MOBILE_APPIUM_START: 'mobile:appium:start',
  MOBILE_APPIUM_STOP: 'mobile:appium:stop',
  MOBILE_APPIUM_CONNECT_EXTERNAL: 'mobile:appium:connect-external',
  MOBILE_APPIUM_DISCONNECT_EXTERNAL: 'mobile:appium:disconnect-external',
  MOBILE_LIST_DEVICES: 'mobile:list-devices',
  MOBILE_LIST_CAPABILITIES: 'mobile:list-capabilities',
  MOBILE_SAVE_CAPABILITY: 'mobile:save-capability',
  MOBILE_REMOVE_CAPABILITY: 'mobile:remove-capability',
  MOBILE_TEST_CAPABILITY: 'mobile:test-capability',
  MOBILE_SESSION_STATUS: 'mobile:session:status',
  MOBILE_SESSION_START: 'mobile:session:start',
  MOBILE_SESSION_STOP: 'mobile:session:stop',
  MOBILE_SESSION_SCREENSHOT: 'mobile:session:screenshot',
  MOBILE_SESSION_RECORD_START: 'mobile:session:record-start',
  MOBILE_SESSION_RECORD_STOP: 'mobile:session:record-stop',
  MOBILE_RUN_SCRIPT: 'mobile:run-script',

  // Mobile — Scripts
  MOBILE_SCRIPTS_LIST: 'mobile:scripts:list',
  MOBILE_SCRIPTS_READ: 'mobile:scripts:read',
  MOBILE_SCRIPTS_SAVE: 'mobile:scripts:save',
  MOBILE_SCRIPTS_DELETE: 'mobile:scripts:delete',

  // Variables (shared between web & mobile by design — that's the point)
  VARS_LOAD: 'vars:load',
  VARS_SAVE: 'vars:save',

  // Bridge
  BRIDGE_BUS_GET: 'bridge:bus:get',
  BRIDGE_BUS_SET: 'bridge:bus:set',
  BRIDGE_BUS_LIST: 'bridge:bus:list',
  BRIDGE_BUS_CLEAR: 'bridge:bus:clear',
  BRIDGE_BUS_REMOVE: 'bridge:bus:remove',
  BRIDGE_EVENT_EMIT: 'bridge:event:emit',
  BRIDGE_EVENT_HISTORY: 'bridge:event:history',
  BRIDGE_EVENT_REMOVE: 'bridge:event:remove',
  BRIDGE_EVENT_CLEAR: 'bridge:event:clear',
  BRIDGE_SCENARIO_LIST: 'bridge:scenario:list',
  BRIDGE_SCENARIO_SAVE: 'bridge:scenario:save',
  BRIDGE_SCENARIO_DELETE: 'bridge:scenario:delete',
  BRIDGE_SCENARIO_RUN: 'bridge:scenario:run',
  BRIDGE_SCENARIO_STOP: 'bridge:scenario:stop',

  // Workspace
  WORKSPACE_LIST: 'workspace:list',
  WORKSPACE_SAVE: 'workspace:save',
  WORKSPACE_DELETE: 'workspace:delete',
  WORKSPACE_SET_ACTIVE: 'workspace:set-active',

  // Browser binaries
  BROWSER_INSTALL_STATE: 'browser:install:state',
  BROWSER_INSTALL_RUN: 'browser:install:run',

  // Subscriptions (main → renderer)
  EVT_BRIDGE_EVENT: 'evt:bridge:event',
  EVT_BUS_UPDATE: 'evt:bus:update',
  EVT_SCENARIO_UPDATE: 'evt:scenario:update',
  EVT_DEVICE_UPDATE: 'evt:device:update',
  EVT_APPIUM_UPDATE: 'evt:appium:update',
  EVT_SESSION_UPDATE: 'evt:session:update',
  EVT_BROWSER_UPDATE: 'evt:browser:update',
  EVT_WORKSPACE_UPDATE: 'evt:workspace:update',
  EVT_BROWSER_INSTALL: 'evt:browser:install',
} as const;

export type ChannelName = typeof CHANNELS[keyof typeof CHANNELS];

export interface IpcContract {
  [CHANNELS.WEB_RB_STATUS]: { input: void; output: RemoteBrowserStatus };
  [CHANNELS.WEB_RB_START]: { input: { port: number }; output: RemoteBrowserStatus };
  [CHANNELS.WEB_RB_STOP]: { input: void; output: RemoteBrowserStatus };
  [CHANNELS.WEB_RB_LIST_PAGES]: { input: void; output: BrowserPage[] };
  [CHANNELS.WEB_RB_NAVIGATE]: { input: { url: string }; output: BrowserPage[] };
  [CHANNELS.WEB_RB_NEW_TAB]: { input: { url?: string }; output: BrowserPage[] };
  [CHANNELS.WEB_RB_CLOSE_PAGE]: { input: { index: number }; output: BrowserPage[] };
  [CHANNELS.WEB_RB_SET_ACTIVE]: { input: { index: number }; output: BrowserPage[] };
  [CHANNELS.WEB_RB_LIST_BOOKMARKS]: { input: void; output: UrlBookmark[] };
  [CHANNELS.WEB_RB_SAVE_BOOKMARK]: { input: UrlBookmark; output: UrlBookmark[] };
  [CHANNELS.WEB_RB_REMOVE_BOOKMARK]: { input: { id: string }; output: UrlBookmark[] };
  [CHANNELS.WEB_RUN_SCRIPT]: { input: { source: string }; output: WebScriptRunResult };

  [CHANNELS.WEB_SCRIPTS_LIST]: { input: void; output: ScriptFile[] };
  [CHANNELS.WEB_SCRIPTS_READ]: { input: { path: string }; output: ScriptFileBody };
  [CHANNELS.WEB_SCRIPTS_SAVE]: { input: ScriptFileBody; output: ScriptFile[] };
  [CHANNELS.WEB_SCRIPTS_DELETE]: { input: { path: string }; output: ScriptFile[] };

  [CHANNELS.MOBILE_TOOLING_STATUS]: { input: void; output: ToolingStatus };
  [CHANNELS.MOBILE_APPIUM_STATUS]: { input: void; output: AppiumServerStatus };
  [CHANNELS.MOBILE_APPIUM_START]: { input: { port?: number }; output: AppiumServerStatus };
  [CHANNELS.MOBILE_APPIUM_STOP]: { input: void; output: AppiumServerStatus };
  [CHANNELS.MOBILE_APPIUM_CONNECT_EXTERNAL]: { input: { url: string }; output: AppiumServerStatus };
  [CHANNELS.MOBILE_APPIUM_DISCONNECT_EXTERNAL]: { input: void; output: AppiumServerStatus };
  [CHANNELS.MOBILE_LIST_DEVICES]: { input: void; output: MobileDevice[] };
  [CHANNELS.MOBILE_LIST_CAPABILITIES]: { input: void; output: Capability[] };
  [CHANNELS.MOBILE_SAVE_CAPABILITY]: { input: Capability; output: Capability[] };
  [CHANNELS.MOBILE_REMOVE_CAPABILITY]: { input: { id: string }; output: Capability[] };
  [CHANNELS.MOBILE_TEST_CAPABILITY]: { input: { id: string }; output: CapabilityTestResult };
  [CHANNELS.MOBILE_SESSION_STATUS]: { input: void; output: MobileSessionStatus };
  [CHANNELS.MOBILE_SESSION_START]: { input: { capabilityId: string }; output: MobileSessionStatus };
  [CHANNELS.MOBILE_SESSION_STOP]: { input: void; output: MobileSessionStatus };
  [CHANNELS.MOBILE_SESSION_SCREENSHOT]: { input: void; output: { dataUrl: string } };
  [CHANNELS.MOBILE_SESSION_RECORD_START]: { input: void; output: MobileSessionStatus };
  [CHANNELS.MOBILE_SESSION_RECORD_STOP]: { input: void; output: { dataUrl: string; status: MobileSessionStatus } };
  [CHANNELS.MOBILE_RUN_SCRIPT]: { input: { source: string; capabilityId: string }; output: WebScriptRunResult };

  [CHANNELS.MOBILE_SCRIPTS_LIST]: { input: void; output: ScriptFile[] };
  [CHANNELS.MOBILE_SCRIPTS_READ]: { input: { path: string }; output: ScriptFileBody };
  [CHANNELS.MOBILE_SCRIPTS_SAVE]: { input: ScriptFileBody; output: ScriptFile[] };
  [CHANNELS.MOBILE_SCRIPTS_DELETE]: { input: { path: string }; output: ScriptFile[] };

  [CHANNELS.VARS_LOAD]: { input: void; output: VariablesDocument };
  [CHANNELS.VARS_SAVE]: { input: VariablesDocument; output: VariablesDocument };

  [CHANNELS.BRIDGE_BUS_GET]: { input: { key: string }; output: BusVar | null };
  [CHANNELS.BRIDGE_BUS_SET]: { input: Omit<BusVar, 'updatedAt'>; output: BusVar };
  [CHANNELS.BRIDGE_BUS_LIST]: { input: void; output: BusVar[] };
  [CHANNELS.BRIDGE_BUS_CLEAR]: { input: void; output: BusVar[] };
  [CHANNELS.BRIDGE_BUS_REMOVE]: { input: { key: string }; output: BusVar[] };
  [CHANNELS.BRIDGE_EVENT_EMIT]: { input: Omit<BridgeEvent, 'id' | 'timestamp'>; output: BridgeEvent };
  [CHANNELS.BRIDGE_EVENT_HISTORY]: { input: void; output: BridgeEvent[] };
  [CHANNELS.BRIDGE_EVENT_REMOVE]: { input: { id: string }; output: BridgeEvent[] };
  [CHANNELS.BRIDGE_EVENT_CLEAR]: { input: void; output: BridgeEvent[] };
  [CHANNELS.BRIDGE_SCENARIO_LIST]: { input: void; output: Scenario[] };
  [CHANNELS.BRIDGE_SCENARIO_SAVE]: { input: Scenario; output: Scenario[] };
  [CHANNELS.BRIDGE_SCENARIO_DELETE]: { input: { id: string }; output: Scenario[] };
  [CHANNELS.BRIDGE_SCENARIO_RUN]: { input: { id: string }; output: { runId: string } };
  [CHANNELS.BRIDGE_SCENARIO_STOP]: { input: { runId: string }; output: { ok: boolean } };

  [CHANNELS.EVT_BRIDGE_EVENT]: { input: never; output: BridgeEvent };
  [CHANNELS.EVT_BUS_UPDATE]: { input: never; output: BusVar };
  [CHANNELS.EVT_SCENARIO_UPDATE]: { input: never; output: ScenarioRunUpdate };
  [CHANNELS.EVT_DEVICE_UPDATE]: { input: never; output: MobileDevice[] };
  [CHANNELS.EVT_APPIUM_UPDATE]: { input: never; output: AppiumServerStatus };
  [CHANNELS.EVT_SESSION_UPDATE]: { input: never; output: MobileSessionStatus };
  [CHANNELS.EVT_BROWSER_UPDATE]: { input: never; output: RemoteBrowserStatus };
  [CHANNELS.EVT_WORKSPACE_UPDATE]: { input: never; output: WorkspaceState };
  [CHANNELS.EVT_BROWSER_INSTALL]: { input: never; output: BrowserInstallLog };

  [CHANNELS.WORKSPACE_LIST]: { input: void; output: WorkspaceState };
  [CHANNELS.WORKSPACE_SAVE]: { input: Workspace; output: WorkspaceState };
  [CHANNELS.WORKSPACE_DELETE]: { input: { id: string }; output: WorkspaceState };
  [CHANNELS.WORKSPACE_SET_ACTIVE]: { input: { id: string }; output: WorkspaceState };

  [CHANNELS.BROWSER_INSTALL_STATE]: { input: void; output: BrowserInstallState };
  [CHANNELS.BROWSER_INSTALL_RUN]: { input: void; output: { started: boolean } };
}

export type RequestOf<C extends ChannelName> = IpcContract[C]['input'];
export type ResponseOf<C extends ChannelName> = IpcContract[C]['output'];
