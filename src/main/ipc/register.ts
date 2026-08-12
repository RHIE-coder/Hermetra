import { app, ipcMain, nativeImage, type BrowserWindow } from 'electron';
import { CHANNELS } from '@shared/ipc/channels';
import { SHOT_THUMBNAIL_WIDTH } from '@shared/dev-feedback';
import type { Scenario } from '@shared/types/bridge';
import type { Capability, Connection, SavedDevice } from '@shared/types/mobile';
import type { ScriptFileBody, ScriptMoveRequest, UrlBookmark } from '@shared/types/web';
import { createPlaywrightWebDriver } from '../drivers/web/playwright';
import { createMobileDriver } from '../drivers/mobile';
import {
  parseNativePageSource,
  parseWebviewPageSource,
} from '../drivers/mobile/inspector-parser';
import { VarBus } from '../bridge/varBus';
import { BridgeEventBus } from '../bridge/eventBus';
import { ScenarioOrchestrator } from '../bridge/orchestrator';
import { variablesService } from '../services/variables';
import { memoryStore } from '../services/storage';
import { scriptsService } from '../services/scripts';
import { workspaceManager } from '../services/workspaceManager';
import { myDevicesService } from '../services/myDevices';
import { connectionsService } from '../services/connections';
import { appleCertsService } from '../services/appleCerts';
import { BrowserInstaller } from '../services/browserInstall';
import { createSidecarSupervisor } from '../sidecar';
import { createStudioSession } from '../services/studioSession.connect';
import type { SidecarStatus } from '@shared/types/studio';
import { discardDraft, finishFeedback, readDraftShot, saveDraftStep } from '../services/devFeedback';
import type { Workspace } from '@shared/types/workspace';

export function registerIpc(getWindow: () => BrowserWindow | null) {
  const web = createPlaywrightWebDriver();
  const mobile = createMobileDriver();
  const bus = new VarBus();
  const events = new BridgeEventBus();
  const orchestrator = new ScenarioOrchestrator({ web, mobile, events });
  const workspace = workspaceManager();
  const installer = new BrowserInstaller();
  // The fetch sidecar is not started here — the pipeline asks for it when it
  // needs a browser, and a stealth browser idling for a user who never opens
  // that screen is pure cost.
  const sidecar = createSidecarSupervisor(__dirname);
  // The session holds the browser; the sidecar only starts one. Keeping them
  // apart is what lets the browser outlive every step a person runs.
  const session = createStudioSession();
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
  session.on('status', (s) => broadcast(CHANNELS.EVT_STUDIO_SESSION, s));
  session.on('log', (l) => broadcast(CHANNELS.EVT_STUDIO_LOG, l));
  sidecar.on('status', (s: SidecarStatus) => {
    broadcast(CHANNELS.EVT_SIDECAR_UPDATE, s);
    // A restart hands out a new endpoint and loses every tab. Following the
    // supervisor rather than caching the first address is what keeps the screen
    // from listing tabs that no longer exist.
    if (s.phase === 'ready' && s.endpoint) void session.attach(s.endpoint);
    else void session.detach();
  });
  // A sidecar that outlives its app is an orphaned browser holding a port. Let
  // go of the browser first — closing the socket after the process it belongs
  // to is gone is an unhandled rejection on the way out.
  app.on('before-quit', () => {
    void session.detach();
    sidecar.stop();
  });

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

  /* ── Mobile — Connection configs (per-workspace) — P4 ────────────── */
  ipcMain.handle(CHANNELS.CONN_LIST, () => connectionsService(workspace.activeDir()).list());
  ipcMain.handle(CHANNELS.CONN_SAVE, (_e, { connection }: { connection: Connection }) =>
    connectionsService(workspace.activeDir()).save(connection),
  );
  ipcMain.handle(CHANNELS.CONN_REMOVE, (_e, { id }: { id: string }) =>
    connectionsService(workspace.activeDir()).remove(id),
  );
  ipcMain.handle(CHANNELS.CONN_USE, (_e, { id }: { id: string | null }) =>
    connectionsService(workspace.activeDir()).use(id),
  );
  ipcMain.handle(CHANNELS.CONN_TEST, (_e, { id }: { id: string }) =>
    connectionsService(workspace.activeDir()).test(id),
  );
  ipcMain.handle(CHANNELS.APPLE_CERTS_LIST, () => appleCertsService().list());

  /* ── Mobile — Inspector (P5) ─────────────────────────────────────── */
  ipcMain.handle(CHANNELS.INSPECTOR_START_SESSION, async () => {
    try {
      await mobile.startInspector();
      return { ok: true as const };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  });
  ipcMain.handle(CHANNELS.INSPECTOR_STOP_SESSION, async () => {
    await mobile.stopSession();
    return { ok: true as const };
  });
  ipcMain.handle(CHANNELS.INSPECTOR_SCREENSHOT, () => mobile.screenshot());
  ipcMain.handle(CHANNELS.INSPECTOR_START_RECORD, async () => {
    await mobile.startRecording();
    return { ok: true as const };
  });
  ipcMain.handle(CHANNELS.INSPECTOR_STOP_RECORD, async () => {
    const { dataUrl } = await mobile.stopRecording();
    return { dataUrl };
  });
  ipcMain.handle(CHANNELS.INSPECTOR_SET_CONTEXT, async (_e, { context }: { context: 'native' | string }) => {
    await mobile.setContext(context);
    return { ok: true as const };
  });
  ipcMain.handle(CHANNELS.INSPECTOR_GET_ELEMENTS, async () => {
    const nativeXml = await mobile.getPageSource('native');
    const native = parseNativePageSource(nativeXml);
    const contexts = await mobile.getContexts();
    const webviewContext = contexts.find((c) => c.startsWith('WEBVIEW_'));
    let webview: ReturnType<typeof parseWebviewPageSource> = [];
    if (webviewContext) {
      try {
        await mobile.setContext(webviewContext);
        const html = await mobile.getPageSource(webviewContext);
        webview = parseWebviewPageSource(html);
      } finally {
        // Restore native context so subsequent script runs default to native.
        try {
          await mobile.setContext('NATIVE_APP');
        } catch {
          /* best-effort — ignore */
        }
      }
    }
    return { native, webview };
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
  ipcMain.handle(CHANNELS.STUDIO_SIDECAR_STATUS, () => sidecar.status());
  ipcMain.handle(CHANNELS.STUDIO_SIDECAR_START, (_e, p: { headless?: boolean } = {}) => {
    sidecar.start(p ?? {});
    return sidecar.status();
  });
  ipcMain.handle(CHANNELS.STUDIO_SIDECAR_STOP, () => { sidecar.stop(); return sidecar.status(); });

  /* ── Data pipeline — the live browser session ────────────────────── */
  ipcMain.handle(CHANNELS.STUDIO_SESSION_STATUS, () => session.status());
  ipcMain.handle(CHANNELS.STUDIO_SESSION_NAVIGATE, (_e, { url }: { url: string }) =>
    session.navigate(url),
  );
  ipcMain.handle(CHANNELS.STUDIO_SESSION_NEW_TAB, (_e, p: { url?: string }) =>
    session.newTab(p?.url),
  );
  ipcMain.handle(CHANNELS.STUDIO_SESSION_CLOSE_PAGE, (_e, { index }: { index: number }) =>
    session.closePage(index),
  );
  ipcMain.handle(CHANNELS.STUDIO_SESSION_SET_ACTIVE, (_e, { index }: { index: number }) =>
    session.setActive(index),
  );
  ipcMain.handle(CHANNELS.STUDIO_SESSION_RUN, (_e, p: { source: string; url?: string }) =>
    session.runStep(p.source, { url: p.url }),
  );

  /* ── Data pipeline — scripts ─────────────────────────────────────── */
  ipcMain.handle(CHANNELS.STUDIO_SCRIPTS_LIST, () => scriptsService.get().list('studio'));
  ipcMain.handle(CHANNELS.STUDIO_SCRIPTS_READ, (_e, { path: p }: { path: string }) =>
    scriptsService.get().read('studio', p),
  );
  ipcMain.handle(CHANNELS.STUDIO_SCRIPTS_SAVE, (_e, body: ScriptFileBody) =>
    scriptsService.get().save('studio', body),
  );
  ipcMain.handle(CHANNELS.STUDIO_SCRIPTS_DELETE, (_e, { path: p }: { path: string }) =>
    scriptsService.get().remove('studio', p),
  );
  ipcMain.handle(CHANNELS.STUDIO_SCRIPTS_MKDIR, (_e, { path: p }: { path: string }) =>
    scriptsService.get().mkdir('studio', p),
  );
  ipcMain.handle(CHANNELS.STUDIO_SCRIPTS_MOVE, (_e, { moves }: { moves: ScriptMoveRequest[] }) =>
    scriptsService.get().move('studio', moves),
  );

  ipcMain.handle(CHANNELS.WORKSPACE_LIST, () => workspace.list());
  ipcMain.handle(CHANNELS.WORKSPACE_SAVE, (_e, ws: Workspace) => workspace.save(ws));
  ipcMain.handle(CHANNELS.WORKSPACE_DELETE, (_e, { id }: { id: string }) => workspace.remove(id));
  ipcMain.handle(CHANNELS.WORKSPACE_SET_ACTIVE, (_e, { id }: { id: string }) =>
    workspace.setActive(id),
  );

  /* ── Browser binaries ────────────────────────────────────────────── */
  ipcMain.handle(CHANNELS.BROWSER_INSTALL_STATE, () => installer.state());
  ipcMain.handle(CHANNELS.BROWSER_INSTALL_RUN, () => ({ started: installer.install() }));

  /* ── Dev-only screen feedback ────────────────────────────────────── */
  // Absent from a packaged app entirely: it writes into the repo with no
  // guard, and the overlay that calls it is compiled out of a prod renderer.
  if (!app.isPackaged) {
    // The window screenshots itself. The renderer hides its own toolbars
    // before invoking and leaves the marks up, so what lands in the picture is
    // pixel-for-pixel what the user was looking at — no DOM cloning, no scroll
    // or sticky corrections to get wrong.
    const capture = async () => {
      const win = getWindow();
      if (!win || win.isDestroyed()) return null;
      const image = await win.webContents.capturePage();
      return image.isEmpty() ? null : image.toDataURL();
    };
    // Shrinking a collected screen for the review panel. It happens here rather
    // than in the renderer because the bytes are on disk, and a full-size window
    // PNG per screen would cross IPC for nothing.
    const thumbnail = (png: Buffer) => {
      const image = nativeImage.createFromBuffer(png);
      if (image.isEmpty()) return null;
      return image.resize({ width: SHOT_THUMBNAIL_WIDTH, quality: 'good' }).toDataURL();
    };
    // A round is collected screen by screen: STEP freezes the screen the user
    // is about to leave, SAVE ends the round, DISCARD throws it away. SHOT reads
    // one back so the panel can show what was collected.
    ipcMain.handle(CHANNELS.DEV_FEEDBACK_STEP, (_e, raw) => saveDraftStep(raw, { capture }));
    ipcMain.handle(CHANNELS.DEV_FEEDBACK_SAVE, (_e, raw) => finishFeedback(raw));
    ipcMain.handle(CHANNELS.DEV_FEEDBACK_DISCARD, (_e, raw) => discardDraft(raw));
    ipcMain.handle(CHANNELS.DEV_FEEDBACK_SHOT, (_e, raw) => readDraftShot(raw, { thumbnail }));
  }
}
