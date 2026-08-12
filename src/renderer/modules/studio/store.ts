import { create } from 'zustand';
import type {
  StudioLogLine,
  StudioSessionStatus,
  SidecarStatus,
} from '@shared/types/studio';
import { IDLE_SESSION, IDLE_SIDECAR } from '@shared/types/studio';
import type {
  ScriptFile,
  ScriptFileBody,
  ScriptMoveRequest,
  ScriptMoveResult,
} from '@shared/types/web';
import { CHANNELS } from '@shared/ipc/channels';
import { invoke, subscribe } from '@/services/ipc';

/**
 * The Data Pipeline's state: the browser the sidecar runs, the session that
 * drives it, and the scripts run against it.
 *
 * Two statuses rather than one, because they fail apart: the sidecar can be
 * `ready` while the connection to it refuses, and saying which of the two went
 * wrong is the difference between a fixable message and "it doesn't work".
 */

let subscribed = false;

/**
 * A run that loops can print without end. The panel keeps the tail — the last
 * lines are the ones that say what just happened, and an unbounded array in a
 * long-lived renderer is a leak.
 */
const MAX_LOG_LINES = 500;

interface PipelineState {
  sidecar: SidecarStatus;
  session: StudioSessionStatus;
  log: StudioLogLine[];
  scripts: ScriptFile[];
  currentScript: ScriptFileBody | null;
  busy: boolean;

  init: () => Promise<void>;
  startBrowser: (headless: boolean) => Promise<void>;
  stopBrowser: () => Promise<void>;
  navigate: (url: string) => Promise<void>;
  newTab: (url?: string) => Promise<void>;
  closePage: (index: number) => Promise<void>;
  setActive: (index: number) => Promise<void>;
  runStep: (source: string, url?: string) => Promise<void>;
  clearLog: () => void;

  listScripts: () => Promise<void>;
  loadScript: (path: string) => Promise<void>;
  saveScript: (body: ScriptFileBody) => Promise<void>;
  deleteScript: (path: string) => Promise<void>;
  mkdirScript: (path: string) => Promise<void>;
  moveScripts: (moves: ScriptMoveRequest[]) => Promise<ScriptMoveResult>;
  setCurrentScript: (body: ScriptFileBody | null) => void;
}

export const useStudioStore = create<PipelineState>((set, get) => ({
  sidecar: { ...IDLE_SIDECAR },
  session: { ...IDLE_SESSION },
  log: [],
  scripts: [],
  currentScript: null,
  busy: false,

  init: async () => {
    const [sidecar, session, scripts] = await Promise.all([
      invoke(CHANNELS.STUDIO_SIDECAR_STATUS),
      invoke(CHANNELS.STUDIO_SESSION_STATUS),
      invoke(CHANNELS.STUDIO_SCRIPTS_LIST),
    ]);
    set({ sidecar, session, scripts });

    if (subscribed) return;
    subscribed = true;
    subscribe(CHANNELS.EVT_SIDECAR_UPDATE, (s) => set({ sidecar: s }));
    subscribe(CHANNELS.EVT_STUDIO_SESSION, (s) => set({ session: s }));
    subscribe(CHANNELS.EVT_STUDIO_LOG, (line) => {
      const log = [...get().log, line];
      set({ log: log.length > MAX_LOG_LINES ? log.slice(-MAX_LOG_LINES) : log });
    });
  },

  startBrowser: async (headless) => {
    // Only the sidecar is asked. The session attaches on its own when the
    // supervisor reports an endpoint — the screen does not sequence that.
    const sidecar = await invoke(CHANNELS.STUDIO_SIDECAR_START, { headless });
    set({ sidecar });
  },

  stopBrowser: async () => {
    const sidecar = await invoke(CHANNELS.STUDIO_SIDECAR_STOP);
    set({ sidecar });
  },

  navigate: async (url) => {
    const pages = await invoke(CHANNELS.STUDIO_SESSION_NAVIGATE, { url });
    set({ session: { ...get().session, pages } });
  },

  newTab: async (url) => {
    const pages = await invoke(CHANNELS.STUDIO_SESSION_NEW_TAB, { url });
    set({ session: { ...get().session, pages } });
  },

  closePage: async (index) => {
    const pages = await invoke(CHANNELS.STUDIO_SESSION_CLOSE_PAGE, { index });
    set({ session: { ...get().session, pages } });
  },

  setActive: async (index) => {
    const pages = await invoke(CHANNELS.STUDIO_SESSION_SET_ACTIVE, { index });
    set({ session: { ...get().session, pages } });
  },

  runStep: async (source, url) => {
    set({ busy: true });
    try {
      // The output already arrived line by line on EVT_STUDIO_LOG; what comes
      // back is the verdict, and only a failure adds anything the log missed.
      await invoke(CHANNELS.STUDIO_SESSION_RUN, { source, url });
    } finally {
      set({ busy: false });
    }
  },

  clearLog: () => set({ log: [] }),

  listScripts: async () => set({ scripts: await invoke(CHANNELS.STUDIO_SCRIPTS_LIST) }),

  loadScript: async (path) => {
    set({ currentScript: await invoke(CHANNELS.STUDIO_SCRIPTS_READ, { path }) });
  },

  saveScript: async (body) => {
    const scripts = await invoke(CHANNELS.STUDIO_SCRIPTS_SAVE, body);
    set({ scripts, currentScript: body });
  },

  deleteScript: async (path) => {
    const scripts = await invoke(CHANNELS.STUDIO_SCRIPTS_DELETE, { path });
    set({ scripts });
    if (get().currentScript?.path === path) set({ currentScript: null });
  },

  mkdirScript: async (path) => {
    set({ scripts: await invoke(CHANNELS.STUDIO_SCRIPTS_MKDIR, { path }) });
  },

  moveScripts: async (moves) => {
    try {
      set({ scripts: await invoke(CHANNELS.STUDIO_SCRIPTS_MOVE, { moves }) });
      return { ok: true };
    } catch (e) {
      const err = e as { message?: string; conflicts?: string[] };
      return {
        ok: false,
        error: err.message ?? String(e),
        conflicts: Array.isArray(err.conflicts) ? err.conflicts : [],
      };
    }
  },

  setCurrentScript: (body) => set({ currentScript: body }),
}));
