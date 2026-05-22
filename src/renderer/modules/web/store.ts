import { create } from 'zustand';
import type {
  RemoteBrowserStatus,
  BrowserPage,
  UrlBookmark,
  ScriptFile,
  ScriptFileBody,
} from '@shared/types/web';
import { CHANNELS } from '@shared/ipc/channels';
import { invoke, subscribe } from '@/services/ipc';

let subscribed = false;

interface WebState {
  status: RemoteBrowserStatus;
  pages: BrowserPage[];
  bookmarks: UrlBookmark[];
  loading: boolean;
  error: string | null;
  output: string;
  scripts: ScriptFile[];
  currentScript: ScriptFileBody | null;

  init: () => Promise<void>;
  start: (port: number) => Promise<void>;
  stop: () => Promise<void>;
  refreshPages: () => Promise<void>;
  navigate: (url: string) => Promise<void>;
  newTab: (url?: string) => Promise<void>;
  closePage: (index: number) => Promise<void>;
  setActive: (index: number) => Promise<void>;
  saveBookmark: (bm: UrlBookmark) => Promise<void>;
  removeBookmark: (id: string) => Promise<void>;
  runScript: (source: string) => Promise<void>;
  setError: (e: string | null) => void;

  listScripts: () => Promise<void>;
  loadScript: (path: string) => Promise<void>;
  saveScript: (body: ScriptFileBody) => Promise<void>;
  deleteScript: (path: string) => Promise<void>;
  mkdirScript: (path: string) => Promise<void>;
  setCurrentScript: (body: ScriptFileBody | null) => void;
}

export const useWebStore = create<WebState>((set, get) => ({
  status: { isRunning: false, port: 9222, wsEndpoint: null, driverAvailable: false },
  pages: [],
  bookmarks: [],
  loading: false,
  error: null,
  output: '',
  scripts: [],
  currentScript: null,

  init: async () => {
    const [status, bookmarks, scripts] = await Promise.all([
      invoke(CHANNELS.WEB_RB_STATUS),
      invoke(CHANNELS.WEB_RB_LIST_BOOKMARKS),
      invoke(CHANNELS.WEB_SCRIPTS_LIST),
    ]);
    set({ status, bookmarks, scripts });
    if (status.isRunning) await get().refreshPages();

    if (subscribed) return;
    subscribed = true;
    subscribe(CHANNELS.EVT_BROWSER_UPDATE, (s) => {
      set({ status: s });
      void get().refreshPages();
    });
  },

  start: async (port) => {
    set({ loading: true, error: null });
    try {
      const status = await invoke(CHANNELS.WEB_RB_START, { port });
      set({ status });
      if (status.driverHint && !status.isRunning) {
        set({ error: status.driverHint });
      }
      await get().refreshPages();
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ loading: false });
    }
  },

  stop: async () => {
    set({ loading: true });
    const status = await invoke(CHANNELS.WEB_RB_STOP);
    set({ status, pages: [], loading: false });
  },

  refreshPages: async () => {
    try {
      const pages = await invoke(CHANNELS.WEB_RB_LIST_PAGES);
      set({ pages });
    } catch {
      /* ignore */
    }
  },

  navigate: async (url) => {
    try {
      const pages = await invoke(CHANNELS.WEB_RB_NAVIGATE, { url });
      set({ pages });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  newTab: async (url) => {
    const pages = await invoke(CHANNELS.WEB_RB_NEW_TAB, { url });
    set({ pages });
  },

  closePage: async (index) => {
    const pages = await invoke(CHANNELS.WEB_RB_CLOSE_PAGE, { index });
    set({ pages });
  },

  setActive: async (index) => {
    const pages = await invoke(CHANNELS.WEB_RB_SET_ACTIVE, { index });
    set({ pages });
  },

  saveBookmark: async (bm) => {
    const bookmarks = await invoke(CHANNELS.WEB_RB_SAVE_BOOKMARK, bm);
    set({ bookmarks });
  },

  removeBookmark: async (id) => {
    const bookmarks = await invoke(CHANNELS.WEB_RB_REMOVE_BOOKMARK, { id });
    set({ bookmarks });
  },

  runScript: async (source) => {
    const result = await invoke(CHANNELS.WEB_RUN_SCRIPT, { source });
    set({ output: result.output });
  },

  setError: (e) => set({ error: e }),

  listScripts: async () => {
    const scripts = await invoke(CHANNELS.WEB_SCRIPTS_LIST);
    set({ scripts });
  },

  loadScript: async (path) => {
    const body = await invoke(CHANNELS.WEB_SCRIPTS_READ, { path });
    set({ currentScript: body });
  },

  saveScript: async (body) => {
    const scripts = await invoke(CHANNELS.WEB_SCRIPTS_SAVE, body);
    set({ scripts, currentScript: body });
  },

  deleteScript: async (path) => {
    const scripts = await invoke(CHANNELS.WEB_SCRIPTS_DELETE, { path });
    set({ scripts });
    if (get().currentScript?.path === path) set({ currentScript: null });
  },

  mkdirScript: async (path) => {
    const scripts = await invoke(CHANNELS.WEB_SCRIPTS_MKDIR, { path });
    set({ scripts });
  },

  setCurrentScript: (body) => set({ currentScript: body }),
}));
