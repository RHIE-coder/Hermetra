import { EventEmitter } from 'node:events';
import type { BusVar, BridgeSide } from '@shared/types/bridge';

/**
 * In-memory shared variable bus. Both web and mobile drivers
 * (and the renderer) read/write through here, so a value written
 * by one side is immediately observable by the other.
 */
export class VarBus extends EventEmitter {
  private store = new Map<string, BusVar>();

  list(): BusVar[] {
    return Array.from(this.store.values()).sort((a, b) => a.key.localeCompare(b.key));
  }

  get(key: string): BusVar | null {
    return this.store.get(key) ?? null;
  }

  set(key: string, value: string, by: BridgeSide): BusVar {
    const entry: BusVar = { key, value, updatedAt: Date.now(), updatedBy: by };
    this.store.set(key, entry);
    this.emit('update', entry);
    return entry;
  }

  clear(): BusVar[] {
    this.store.clear();
    this.emit('clear');
    return [];
  }

  remove(key: string): BusVar[] {
    if (!this.store.has(key)) return this.list();
    this.store.delete(key);
    this.emit('remove', { key });
    return this.list();
  }
}
