import { create } from 'zustand';
import type {
  BrowserInstallLog,
  BrowserInstallState,
  Workspace,
  WorkspaceState,
} from '@shared/types/workspace';
import { CHANNELS } from '@shared/ipc/channels';
import { invoke, subscribe } from '@/services/ipc';

let subscribed = false;

interface WorkspaceStoreState {
  state: WorkspaceState | null;
  install: BrowserInstallState | null;
  installLogs: string[];
  installRunning: boolean;

  init: () => Promise<void>;
  saveWorkspace: (w: Workspace) => Promise<void>;
  setActive: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  createWorkspace: (name: string) => Promise<void>;

  refreshInstall: () => Promise<void>;
  installBrowser: () => Promise<void>;
  clearInstallLog: () => void;
}

export const useWorkspaceStore = create<WorkspaceStoreState>((set, get) => ({
  state: null,
  install: null,
  installLogs: [],
  installRunning: false,

  init: async () => {
    const [state, install] = await Promise.all([
      invoke(CHANNELS.WORKSPACE_LIST),
      invoke(CHANNELS.BROWSER_INSTALL_STATE),
    ]);
    set({ state, install });

    if (subscribed) return;
    subscribed = true;
    subscribe(CHANNELS.EVT_WORKSPACE_UPDATE, (s) => set({ state: s }));
    subscribe(CHANNELS.EVT_BROWSER_INSTALL, (log: BrowserInstallLog) => {
      set({ installLogs: [...get().installLogs, log.line] });
      if (log.done) {
        set({ installRunning: false });
        void get().refreshInstall();
      } else {
        set({ installRunning: true });
      }
    });
  },

  saveWorkspace: async (w) => {
    const state = await invoke(CHANNELS.WORKSPACE_SAVE, w);
    set({ state });
  },

  setActive: async (id) => {
    const state = await invoke(CHANNELS.WORKSPACE_SET_ACTIVE, { id });
    set({ state });
  },

  remove: async (id) => {
    const state = await invoke(CHANNELS.WORKSPACE_DELETE, { id });
    set({ state });
  },

  createWorkspace: async (name) => {
    const draft: Workspace = {
      id: `ws-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name,
      port: 9222,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
    };
    const state = await invoke(CHANNELS.WORKSPACE_SAVE, draft);
    const next = await invoke(CHANNELS.WORKSPACE_SET_ACTIVE, { id: draft.id });
    set({ state: next ?? state });
  },

  refreshInstall: async () => {
    const install = await invoke(CHANNELS.BROWSER_INSTALL_STATE);
    set({ install });
  },

  installBrowser: async () => {
    set({ installLogs: [], installRunning: true });
    await invoke(CHANNELS.BROWSER_INSTALL_RUN);
  },

  clearInstallLog: () => set({ installLogs: [] }),
}));

export const activeWorkspace = (s: WorkspaceStoreState): Workspace | null => {
  if (!s.state) return null;
  return s.state.workspaces.find((w) => w.id === s.state!.activeId) ?? s.state.workspaces[0] ?? null;
};
