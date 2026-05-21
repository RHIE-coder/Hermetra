import { create } from 'zustand';
import type { BridgeEvent, BusVar, Scenario, ScenarioRunUpdate } from '@shared/types/bridge';
import { invoke, subscribe } from '@/services/ipc';
import { CHANNELS } from '@shared/ipc/channels';

let subscribed = false;

interface BridgeState {
  vars: BusVar[];
  events: BridgeEvent[];
  scenarios: Scenario[];
  scenarioRuns: Record<string, ScenarioRunUpdate[]>;
  currentRunId: string | null;

  init: () => Promise<void>;
  setVar: (key: string, value: string) => Promise<void>;
  removeVar: (key: string) => Promise<void>;
  clearBus: () => Promise<void>;
  emitEvent: (channel: string, side: 'web' | 'mobile' | 'bridge', payload?: unknown) => Promise<void>;
  removeEvent: (id: string) => Promise<void>;
  clearEvents: () => Promise<void>;
  runScenario: (id: string) => Promise<void>;
  stopScenario: (runId: string) => Promise<void>;
  saveScenario: (s: Scenario) => Promise<void>;
  deleteScenario: (id: string) => Promise<void>;
}

export const useBridgeStore = create<BridgeState>((set, get) => ({
  vars: [],
  events: [],
  scenarios: [],
  scenarioRuns: {},
  currentRunId: null,

  init: async () => {
    const [vars, events, scenarios] = await Promise.all([
      invoke(CHANNELS.BRIDGE_BUS_LIST),
      invoke(CHANNELS.BRIDGE_EVENT_HISTORY),
      invoke(CHANNELS.BRIDGE_SCENARIO_LIST),
    ]);
    set({ vars, events, scenarios });

    if (subscribed) return;
    subscribed = true;
    subscribe(CHANNELS.EVT_BRIDGE_EVENT, (evt) => {
      set((state) => ({ events: [...state.events, evt].slice(-200) }));
    });

    subscribe(CHANNELS.EVT_BUS_UPDATE, (entry) => {
      set((state) => {
        const next = state.vars.filter((v) => v.key !== entry.key);
        next.push(entry);
        next.sort((a, b) => a.key.localeCompare(b.key));
        return { vars: next };
      });
    });

    subscribe(CHANNELS.EVT_SCENARIO_UPDATE, (update) => {
      const { currentRunId } = get();
      if (!currentRunId) return;
      set((state) => {
        const runs = { ...state.scenarioRuns };
        const list = runs[currentRunId] ? runs[currentRunId].slice() : [];
        list.push(update);
        runs[currentRunId] = list;
        return { scenarioRuns: runs };
      });
    });
  },

  setVar: async (key, value) => {
    await invoke(CHANNELS.BRIDGE_BUS_SET, { key, value, updatedBy: 'bridge' });
    const vars = await invoke(CHANNELS.BRIDGE_BUS_LIST);
    set({ vars });
  },

  removeVar: async (key) => {
    const vars = await invoke(CHANNELS.BRIDGE_BUS_REMOVE, { key });
    set({ vars });
  },

  clearBus: async () => {
    const vars = await invoke(CHANNELS.BRIDGE_BUS_CLEAR);
    set({ vars });
  },

  emitEvent: async (channel, side, payload = null) => {
    await invoke(CHANNELS.BRIDGE_EVENT_EMIT, { channel, side, payload });
  },

  removeEvent: async (id) => {
    const events = await invoke(CHANNELS.BRIDGE_EVENT_REMOVE, { id });
    set({ events });
  },

  clearEvents: async () => {
    const events = await invoke(CHANNELS.BRIDGE_EVENT_CLEAR);
    set({ events });
  },

  runScenario: async (id) => {
    const { runId } = await invoke(CHANNELS.BRIDGE_SCENARIO_RUN, { id });
    set({ currentRunId: runId, scenarioRuns: { ...get().scenarioRuns, [runId]: [] } });
  },

  stopScenario: async (runId) => {
    await invoke(CHANNELS.BRIDGE_SCENARIO_STOP, { runId });
  },

  saveScenario: async (s) => {
    const scenarios = await invoke(CHANNELS.BRIDGE_SCENARIO_SAVE, s);
    set({ scenarios });
  },

  deleteScenario: async (id) => {
    const scenarios = await invoke(CHANNELS.BRIDGE_SCENARIO_DELETE, { id });
    set({ scenarios });
  },
}));
