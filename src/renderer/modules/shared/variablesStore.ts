import { create } from 'zustand';
import type { VariablesDocument } from '@shared/types/variables';
import { invoke } from '@/services/ipc';
import { CHANNELS } from '@shared/ipc/channels';

interface VariablesState {
  doc: VariablesDocument | null;
  selectedProfileId: string | null;
  loading: boolean;

  init: () => Promise<void>;
  selectProfile: (id: string) => void;
  save: (doc: VariablesDocument) => Promise<void>;

  setSharedValue: (key: string, value: string) => void;
  addShared: (key: string, value: string) => void;
  removeShared: (key: string) => void;

  setPrivateValue: (key: string, value: string) => void;
  addPrivate: (key: string, value: string) => void;
  removePrivate: (key: string) => void;

  addProfile: (name: string) => void;
  removeProfile: (id: string) => void;
}

const normaliseKey = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9_]/g, '');

export const useVariablesStore = create<VariablesState>((set, get) => ({
  doc: null,
  selectedProfileId: null,
  loading: false,

  init: async () => {
    set({ loading: true });
    const doc = await invoke(CHANNELS.VARS_LOAD);
    set({
      doc,
      selectedProfileId: doc.profiles[0]?.id ?? null,
      loading: false,
    });
  },

  selectProfile: (id) => set({ selectedProfileId: id }),

  save: async (doc) => {
    const saved = await invoke(CHANNELS.VARS_SAVE, doc);
    set({ doc: saved });
  },

  setSharedValue: (key, value) => {
    const { doc, selectedProfileId } = get();
    if (!doc || !selectedProfileId) return;
    const list = (doc.sharedVariables[selectedProfileId] || []).map((v) =>
      v.key === key ? { ...v, value } : v,
    );
    const next: VariablesDocument = {
      ...doc,
      sharedVariables: { ...doc.sharedVariables, [selectedProfileId]: list },
    };
    set({ doc: next });
    void get().save(next);
  },

  addShared: (key, value) => {
    const { doc, selectedProfileId } = get();
    if (!doc || !selectedProfileId) return;
    const k = normaliseKey(key);
    if (!k) return;
    const existing = doc.sharedVariables[selectedProfileId] || [];
    if (existing.some((v) => v.key === k)) return;
    const next: VariablesDocument = {
      ...doc,
      sharedVariables: {
        ...doc.sharedVariables,
        [selectedProfileId]: [...existing, { key: k, value }],
      },
    };
    set({ doc: next });
    void get().save(next);
  },

  removeShared: (key) => {
    const { doc, selectedProfileId } = get();
    if (!doc || !selectedProfileId) return;
    const next: VariablesDocument = {
      ...doc,
      sharedVariables: {
        ...doc.sharedVariables,
        [selectedProfileId]: (doc.sharedVariables[selectedProfileId] || []).filter((v) => v.key !== key),
      },
    };
    set({ doc: next });
    void get().save(next);
  },

  setPrivateValue: (key, value) => {
    const { doc, selectedProfileId } = get();
    if (!doc || !selectedProfileId) return;
    const list = (doc.privateVariables[selectedProfileId] || []).map((v) =>
      v.key === key ? { ...v, value } : v,
    );
    const next: VariablesDocument = {
      ...doc,
      privateVariables: { ...doc.privateVariables, [selectedProfileId]: list },
    };
    set({ doc: next });
    void get().save(next);
  },

  addPrivate: (key, value) => {
    const { doc, selectedProfileId } = get();
    if (!doc || !selectedProfileId) return;
    const k = normaliseKey(key);
    if (!k) return;
    const existing = doc.privateVariables[selectedProfileId] || [];
    if (existing.some((v) => v.key === k)) return;
    const next: VariablesDocument = {
      ...doc,
      privateVariables: {
        ...doc.privateVariables,
        [selectedProfileId]: [...existing, { key: k, value }],
      },
    };
    set({ doc: next });
    void get().save(next);
  },

  removePrivate: (key) => {
    const { doc, selectedProfileId } = get();
    if (!doc || !selectedProfileId) return;
    const next: VariablesDocument = {
      ...doc,
      privateVariables: {
        ...doc.privateVariables,
        [selectedProfileId]: (doc.privateVariables[selectedProfileId] || []).filter((v) => v.key !== key),
      },
    };
    set({ doc: next });
    void get().save(next);
  },

  addProfile: (name) => {
    const { doc } = get();
    if (!doc) return;
    const id = name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (!id || doc.profiles.some((p) => p.id === id)) return;
    const next: VariablesDocument = {
      profiles: [...doc.profiles, { id, name: name.trim() }],
      sharedVariables: { ...doc.sharedVariables, [id]: [] },
      privateVariables: { ...doc.privateVariables, [id]: [] },
    };
    set({ doc: next, selectedProfileId: id });
    void get().save(next);
  },

  removeProfile: (id) => {
    const { doc } = get();
    if (!doc) return;
    if (doc.profiles.length <= 1) return;
    const profiles = doc.profiles.filter((p) => p.id !== id);
    const { [id]: _shared, ...sharedRest } = doc.sharedVariables;
    const { [id]: _priv, ...privRest } = doc.privateVariables;
    void _shared;
    void _priv;
    const next: VariablesDocument = {
      profiles,
      sharedVariables: sharedRest,
      privateVariables: privRest,
    };
    set({ doc: next, selectedProfileId: profiles[0]?.id ?? null });
    void get().save(next);
  },
}));
