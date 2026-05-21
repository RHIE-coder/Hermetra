import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { BridgeEvent, BridgeSide } from '@shared/types/bridge';

const MAX_HISTORY = 200;

export class BridgeEventBus extends EventEmitter {
  private history: BridgeEvent[] = [];

  emitEvent(channel: string, side: BridgeSide, payload: unknown): BridgeEvent {
    const evt: BridgeEvent = {
      id: randomUUID(),
      channel,
      side,
      payload,
      timestamp: Date.now(),
    };
    this.history.push(evt);
    if (this.history.length > MAX_HISTORY) {
      this.history.splice(0, this.history.length - MAX_HISTORY);
    }
    this.emit('event', evt);
    this.emit(channel, evt);
    return evt;
  }

  recent(): BridgeEvent[] {
    return this.history.slice();
  }

  remove(id: string): BridgeEvent[] {
    const i = this.history.findIndex((e) => e.id === id);
    if (i < 0) return this.recent();
    this.history.splice(i, 1);
    this.emit('remove', { id });
    return this.recent();
  }

  clearHistory(): BridgeEvent[] {
    this.history.length = 0;
    this.emit('clear');
    return [];
  }

  /** Resolves when an event on the given channel is received. */
  waitFor(channel: string, timeoutMs = 30_000): Promise<BridgeEvent> {
    return new Promise((resolve, reject) => {
      const handler = (evt: BridgeEvent) => {
        clearTimeout(timer);
        resolve(evt);
      };
      const timer = setTimeout(() => {
        this.off(channel, handler);
        reject(new Error(`Bridge event "${channel}" timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.once(channel, handler);
    });
  }
}
