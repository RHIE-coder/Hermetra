import { app, ipcMain, type BrowserWindow } from 'electron';
import { CHANNELS } from '@shared/ipc/channels';
import type { Scenario } from '@shared/types/bridge';
import type { Capability, SavedDevice } from '@shared/types/mobile';
import type { ScriptFileBody, ScriptMoveRequest, UrlBookmark } from '@shared/types/web';
import { createPlaywrightWebDriver } from '../drivers/web/playwright';
import { createMobileDriver } from '../drivers/mobile';
import { VarBus } from '../bridge/varBus';
import { BridgeEventBus } from '../bridge/eventBus';
import { ScenarioOrchestrator } from '../bridge/orchestrator';
import { variablesService } from '../services/variables';
import { memoryStore } from '../services/storage';
import { scriptsService } from '../services/scripts';
import { workspaceManager } from '../services/workspaceManager';
import { myDevicesService } from '../services/myDevices';
import { BrowserInstaller } from '../services/browserInstall';
import type { Workspace } from '@shared/types/workspace';

export function registerIpc(getWindow: () => BrowserWindow | null) {
  const web = createPlaywrightWebDriver();
  const mobile = createMobileDriver();
  const bus = new VarBus();
  const events = new BridgeEventBus();
  const orchestrator = new ScenarioOrchestrator({ web, mobile, events });
  const workspace = workspaceManager();
  const installer = new BrowserInstaller();
  const userDataDir = app.isReady() ? app.getPath('userData') : process.cwd();
  const myDevices = myDevicesService(userDataDir);

  const broadcast = <T>(channel: string, payload: T) => {
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  };

  events.on('event', (evt) => broadcast(CHANNELS.EVT_BRIDGE_EVENT, evt));
  bus.on('update', (v) => broadcast(CHANNELS.EVT_BUS_UPDATE, v));
  orchestrator.on('update', (u) => broadcast(CHANNELS.EVT_SCENARIO_UPDATE, u));
  mobile.onSession((s) => broadcast(CHANNELS.EVT_SESSION_UPDATE, s));
  mobile.onAppium((s) => broadcast(CHANNELS.EVT_APPIUM_UPDATE, s));
  web.onChange(() => {
    void web.status().then((s) => broadcast(CHANNELS.EVT_BROWSER_UPDATE, s));
  });
  workspace.on('change', (s) => broadcast(CHANNELS.EVT_WORKSPACE_UPDATE, s));
  installer.on('log', (log) => broadcast(CHANNELS.EVT_BROWSER_INSTALL, log));

  // Periodic device discovery (every 5s) for live-connect view
  let lastDevicesJson = '';
  const tick = async () => {
    try {
      const devices = await mobile.listDevices();
      // AC5: update lastConnectedAt for any saved entry whose UDID is live.
      for (const d of devices) myDevices.touchLastConnected(d.id);
      const j = JSON.stringify(devices);
      if (j !== lastDevicesJson) {
        lastDevicesJson = j;
        broadcast(CHANNELS.EVT_DEVICE_UPDATE, devices);
      }
    } catch {
      /* ignore */
    }
  };
  setInterval(tick, 5000);
  setTimeout(() => void tick(), 800);

  /* ── Web ─────────────────────────────────────────────────────────── */
  ipcMain.handle(CHANNELS.WEB_RB_STATUS, () => web.status());
  ipcMain.handle(CHANNELS.WEB_RB_START, (_e, { port }: { port: number }) => web.start(port));
  ipcMain.handle(CHANNELS.WEB_RB_STOP, () => web.stop());
  ipcMain.handle(CHANNELS.WEB_RB_LIST_PAGES, () => web.listPages());
  ipcMain.handle(CHANNELS.WEB_RB_NAVIGATE, (_e, { url }: { url: string }) => web.navigate(url));
  ipcMain.handle(CHANNELS.WEB_RB_NEW_TAB, (_e, p: { url?: string }) => web.newTab(p?.url));
  ipcMain.handle(CHANNELS.WEB_RB_CLOSE_PAGE, (_e, { index }: { index: number }) => web.closePage(index));
  ipcMain.handle(CHANNELS.WEB_RB_SET_ACTIVE, (_e, { index }: { index: number }) => web.setActive(index));
  ipcMain.handle(CHANNELS.WEB_RB_LIST_BOOKMARKS, () => memoryStore.bookmarks);
  ipcMain.handle(CHANNELS.WEB_RB_SAVE_BOOKMARK, (_e, bm: UrlBookmark) => {
    const list = memoryStore.bookmarks.slice();
    const i = list.findIndex((b) => b.id === bm.id);
    if (i >= 0) list[i] = bm;
    else list.push(bm);
    memoryStore.bookmarks = list;
    return memoryStore.bookmarks;
  });
  ipcMain.handle(CHANNELS.WEB_RB_REMOVE_BOOKMARK, (_e, { id }: { id: string }) => {
    memoryStore.bookmarks = memoryStore.bookmarks.filter((b) => b.id !== id);
    return memoryStore.bookmarks;
  });
  ipcMain.handle(CHANNELS.WEB_RUN_SCRIPT, (_e, { source }: { source: string }) => web.runScript(source));

  /* ── Web Scripts ─────────────────────────────────────────────────── */
  ipcMain.handle(CHANNELS.WEB_SCRIPTS_LIST, () => scriptsService.get().list('web'));
  ipcMain.handle(CHANNELS.WEB_SCRIPTS_READ, (_e, { path: p }: { path: string }) =>
    scriptsService.get().read('web', p),
  );
  ipcMain.handle(CHANNELS.WEB_SCRIPTS_SAVE, (_e, body: ScriptFileBody) =>
    scriptsService.get().save('web', body),
  );
  ipcMain.handle(CHANNELS.WEB_SCRIPTS_DELETE, (_e, { path: p }: { path: string }) =>
    scriptsService.get().remove('web', p),
  );
  ipcMain.handle(CHANNELS.WEB_SCRIPTS_MKDIR, (_e, { path: p }: { path: string }) =>
    scriptsService.get().mkdir('web', p),
  );
  ipcMain.handle(CHANNELS.WEB_SCRIPTS_MOVE, (_e, { moves }: { moves: ScriptMoveRequest[] }) =>
    scriptsService.get().move('web', moves),
  );

  /* ── Mobile ──────────────────────────────────────────────────────── */
  ipcMain.handle(CHANNELS.MOBILE_TOOLING_STATUS, () => mobile.toolingStatus());
  ipcMain.handle(CHANNELS.MOBILE_APPIUM_STATUS, () => mobile.appiumStatus());
  ipcMain.handle(CHANNELS.MOBILE_APPIUM_START, (_e, p: { port?: number }) =>
    mobile.startAppium(p?.port),
  );
  ipcMain.handle(CHANNELS.MOBILE_APPIUM_STOP, () => mobile.stopAppium());
  ipcMain.handle(CHANNELS.MOBILE_APPIUM_CONNECT_EXTERNAL, (_e, p: { url: string }) =>
    mobile.connectExternal(p.url),
  );
  ipcMain.handle(CHANNELS.MOBILE_APPIUM_DISCONNECT_EXTERNAL, () => mobile.disconnectExternal());
  ipcMain.handle(CHANNELS.MOBILE_LIST_DEVICES, () => mobile.listDevices());
  ipcMain.handle(CHANNELS.MOBILE_LIST_CAPABILITIES, () => memoryStore.capabilities);
  ipcMain.handle(CHANNELS.MOBILE_SAVE_CAPABILITY, (_e, c: Capability) => {
    const list = memoryStore.capabilities.slice();
    const i = list.findIndex((x) => x.id === c.id);
    if (i >= 0) list[i] = c;
    else list.push(c);
    memoryStore.capabilities = list;
    return memoryStore.capabilities;
  });
  ipcMain.handle(CHANNELS.MOBILE_REMOVE_CAPABILITY, (_e, { id }: { id: string }) => {
    memoryStore.capabilities = memoryStore.capabilities.filter((x) => x.id !== id);
    return memoryStore.capabilities;
  });
  ipcMain.handle(CHANNELS.MOBILE_TEST_CAPABILITY, async (_e, { id }: { id: string }) => {
    const cap = memoryStore.capabilities.find((c) => c.id === id);
    if (!cap) return { ok: false, message: '프로파일을 찾을 수 없습니다.', durationMs: 0 };
    return mobile.testCapability(cap);
  });
  ipcMain.handle(CHANNELS.MOBILE_SESSION_STATUS, () => mobile.sessionStatus());
  ipcMain.handle(CHANNELS.MOBILE_SESSION_START, async (_e, { capabilityId }: { capabilityId: string }) => {
    const cap = memoryStore.capabilities.find((c) => c.id === capabilityId);
    if (!cap) throw new Error('프로파일을 찾을 수 없습니다.');
    return mobile.startSession(cap);
  });
  ipcMain.handle(CHANNELS.MOBILE_SESSION_STOP, () => mobile.stopSession());
  ipcMain.handle(CHANNELS.MOBILE_SESSION_SCREENSHOT, () => mobile.screenshot());
  ipcMain.handle(CHANNELS.MOBILE_SESSION_RECORD_START, () => mobile.startRecording());
  ipcMain.handle(CHANNELS.MOBILE_SESSION_RECORD_STOP, () => mobile.stopRecording());
  ipcMain.handle(CHANNELS.MOBILE_RUN_SCRIPT, (_e, input: { source: string; capabilityId: string }) => {
    const cap = memoryStore.capabilities.find((c) => c.id === input.capabilityId) ?? null;
    return mobile.runScript(input, cap);
  });

  /* ── Mobile — Saved devices ("My Devices") ───────────────────────── */
  ipcMain.handle(CHANNELS.DEVICE_LIST_SAVED, () => myDevices.list());
  ipcMain.handle(CHANNELS.DEVICE_SAVE, (_e, { device }: { device: SavedDevice }) =>
    myDevices.save(device),
  );
  ipcMain.handle(CHANNELS.DEVICE_REMOVE, (_e, { id }: { id: string }) => myDevices.remove(id));
  ipcMain.handle(CHANNELS.DEVICE_UPDATE_ALIAS, (_e, p: { id: string; alias: string | null }) =>
    myDevices.updateAlias(p.id, p.alias),
  );
  ipcMain.handle(CHANNELS.DEVICE_APPS_LIST, async (_e, { deviceId }: { deviceId: string }) => {
    const apps = await mobile.listInstalledApps(deviceId);
    return { apps };
  });

  /* ── Mobile Scripts ──────────────────────────────────────────────── */
  ipcMain.handle(CHANNELS.MOBILE_SCRIPTS_LIST, () => scriptsService.get().list('mobile'));
  ipcMain.handle(CHANNELS.MOBILE_SCRIPTS_READ, (_e, { path: p }: { path: string }) =>
    scriptsService.get().read('mobile', p),
  );
  ipcMain.handle(CHANNELS.MOBILE_SCRIPTS_SAVE, (_e, body: ScriptFileBody) =>
    scriptsService.get().save('mobile', body),
  );
  ipcMain.handle(CHANNELS.MOBILE_SCRIPTS_DELETE, (_e, { path: p }: { path: string }) =>
    scriptsService.get().remove('mobile', p),
  );
  ipcMain.handle(CHANNELS.MOBILE_SCRIPTS_MKDIR, (_e, { path: p }: { path: string }) =>
    scriptsService.get().mkdir('mobile', p),
  );
  ipcMain.handle(CHANNELS.MOBILE_SCRIPTS_MOVE, (_e, { moves }: { moves: ScriptMoveRequest[] }) =>
    scriptsService.get().move('mobile', moves),
  );

  /* ── Variables ───────────────────────────────────────────────────── */
  ipcMain.handle(CHANNELS.VARS_LOAD, () => variablesService.load());
  ipcMain.handle(CHANNELS.VARS_SAVE, (_e, doc) => variablesService.save(doc));

  /* ── Bridge ──────────────────────────────────────────────────────── */
  ipcMain.handle(CHANNELS.BRIDGE_BUS_GET, (_e, { key }: { key: string }) => bus.get(key));
  ipcMain.handle(CHANNELS.BRIDGE_BUS_SET, (_e, v) => bus.set(v.key, v.value, v.updatedBy));
  ipcMain.handle(CHANNELS.BRIDGE_BUS_LIST, () => bus.list());
  ipcMain.handle(CHANNELS.BRIDGE_BUS_CLEAR, () => bus.clear());
  ipcMain.handle(CHANNELS.BRIDGE_BUS_REMOVE, (_e, { key }: { key: string }) => bus.remove(key));
  ipcMain.handle(CHANNELS.BRIDGE_EVENT_EMIT, (_e, input) =>
    events.emitEvent(input.channel, input.side, input.payload),
  );
  ipcMain.handle(CHANNELS.BRIDGE_EVENT_HISTORY, () => events.recent());
  ipcMain.handle(CHANNELS.BRIDGE_EVENT_REMOVE, (_e, { id }: { id: string }) => events.remove(id));
  ipcMain.handle(CHANNELS.BRIDGE_EVENT_CLEAR, () => events.clearHistory());
  ipcMain.handle(CHANNELS.BRIDGE_SCENARIO_LIST, () => memoryStore.scenarios);
  ipcMain.handle(CHANNELS.BRIDGE_SCENARIO_SAVE, (_e, s: Scenario) => {
    const list = memoryStore.scenarios.slice();
    const i = list.findIndex((x) => x.id === s.id);
    if (i >= 0) list[i] = s;
    else list.push(s);
    memoryStore.scenarios = list;
    return memoryStore.scenarios;
  });
  ipcMain.handle(CHANNELS.BRIDGE_SCENARIO_DELETE, (_e, { id }: { id: string }) =>
    memoryStore.removeScenario(id),
  );
  ipcMain.handle(CHANNELS.BRIDGE_SCENARIO_RUN, (_e, { id }: { id: string }) => {
    const scenario = memoryStore.scenarios.find((s) => s.id === id);
    if (!scenario) throw new Error(`Scenario ${id} not found`);
    return { runId: orchestrator.start(scenario) };
  });
  ipcMain.handle(CHANNELS.BRIDGE_SCENARIO_STOP, (_e, { runId }: { runId: string }) => ({
    ok: orchestrator.stop(runId),
  }));

  /* ── Workspace ───────────────────────────────────────────────────── */
  ipcMain.handle(CHANNELS.WORKSPACE_LIST, () => workspace.list());
  ipcMain.handle(CHANNELS.WORKSPACE_SAVE, (_e, ws: Workspace) => workspace.save(ws));
  ipcMain.handle(CHANNELS.WORKSPACE_DELETE, (_e, { id }: { id: string }) => workspace.remove(id));
  ipcMain.handle(CHANNELS.WORKSPACE_SET_ACTIVE, (_e, { id }: { id: string }) =>
    workspace.setActive(id),
  );

  /* ── Browser binaries ────────────────────────────────────────────── */
  ipcMain.handle(CHANNELS.BROWSER_INSTALL_STATE, () => installer.state());
  ipcMain.handle(CHANNELS.BROWSER_INSTALL_RUN, () => ({ started: installer.install() }));
}
