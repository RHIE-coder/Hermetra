import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { app } from 'electron';
import type { Workspace, WorkspaceState } from '@shared/types/workspace';

const newId = () =>
  `ws-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const safeSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'workspace';

interface RawWorkspaceFile {
  activeId?: string;
  workspaces?: Workspace[];
}

class WorkspaceManager extends EventEmitter {
  private root: string;
  private filePath: string;
  private state: WorkspaceState;

  constructor() {
    super();
    const base = app.isReady() ? app.getPath('userData') : path.join(process.cwd(), '.hermetra');
    this.root = path.join(base, 'workspaces');
    fs.mkdirSync(this.root, { recursive: true });
    this.filePath = path.join(base, 'workspaces.json');
    this.state = this.load();
  }

  private load(): WorkspaceState {
    try {
      if (fs.existsSync(this.filePath)) {
        const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf-8')) as RawWorkspaceFile;
        const list = (parsed.workspaces ?? []).map((w) => ({
          // Strip legacy fields (browser kind) silently.
          id: w.id,
          name: w.name,
          port: w.port ?? 9222,
          description: w.description,
          createdAt: w.createdAt ?? Date.now(),
          lastUsedAt: w.lastUsedAt,
        }));
        if (list.length > 0) {
          for (const w of list) this.ensureDir(w.id);
          const activeId = parsed.activeId && list.some((w) => w.id === parsed.activeId)
            ? parsed.activeId
            : list[0].id;
          return { workspaces: list, activeId };
        }
      }
    } catch {
      /* fall through */
    }
    const first: Workspace = {
      id: newId(),
      name: 'default',
      port: 9222,
      description: 'Initial workspace',
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
    };
    this.ensureDir(first.id);
    const state: WorkspaceState = { workspaces: [first], activeId: first.id };
    this.flush(state);
    return state;
  }

  private flush(state?: WorkspaceState) {
    const s = state ?? this.state;
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(s, null, 2), 'utf-8');
    } catch {
      /* noop */
    }
  }

  private ensureDir(id: string) {
    fs.mkdirSync(path.join(this.root, id), { recursive: true });
    fs.mkdirSync(path.join(this.root, id, 'scripts', 'web'), { recursive: true });
    fs.mkdirSync(path.join(this.root, id, 'scripts', 'mobile'), { recursive: true });
  }

  list(): WorkspaceState {
    return this.state;
  }

  active(): Workspace {
    const w = this.state.workspaces.find((x) => x.id === this.state.activeId);
    if (w) return w;
    return this.state.workspaces[0];
  }

  activeDir(): string {
    return path.join(this.root, this.active().id);
  }

  save(input: Workspace): WorkspaceState {
    const list = this.state.workspaces.slice();
    const i = list.findIndex((w) => w.id === input.id);
    const normalised: Workspace = {
      id: input.id,
      name: input.name.trim() || safeSlug(input.name),
      port: input.port || 9222,
      description: input.description,
      createdAt: input.createdAt || Date.now(),
      lastUsedAt: input.lastUsedAt,
    };
    if (i >= 0) {
      list[i] = normalised;
    } else {
      list.push(normalised);
      this.ensureDir(normalised.id);
    }
    this.state = { ...this.state, workspaces: list };
    this.flush();
    this.emit('change', this.state);
    return this.state;
  }

  setActive(id: string): WorkspaceState {
    if (!this.state.workspaces.some((w) => w.id === id)) return this.state;
    this.state = {
      ...this.state,
      activeId: id,
      workspaces: this.state.workspaces.map((w) =>
        w.id === id ? { ...w, lastUsedAt: Date.now() } : w,
      ),
    };
    this.flush();
    this.emit('change', this.state);
    return this.state;
  }

  remove(id: string): WorkspaceState {
    if (this.state.workspaces.length <= 1) return this.state;
    const remaining = this.state.workspaces.filter((w) => w.id !== id);
    const activeId = this.state.activeId === id ? remaining[0].id : this.state.activeId;
    try {
      fs.rmSync(path.join(this.root, id), { recursive: true, force: true });
    } catch {
      /* noop */
    }
    this.state = { workspaces: remaining, activeId };
    this.flush();
    this.emit('change', this.state);
    return this.state;
  }
}

let inst: WorkspaceManager | null = null;
export function workspaceManager(): WorkspaceManager {
  if (!inst) inst = new WorkspaceManager();
  return inst;
}
