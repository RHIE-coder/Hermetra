import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BridgeEventBus } from '@main/bridge/eventBus';

describe('BridgeEventBus (biz logic)', () => {
  let bus: BridgeEventBus;

  beforeEach(() => {
    bus = new BridgeEventBus();
  });

  it('starts with empty history', () => {
    expect(bus.recent()).toEqual([]);
  });

  it('emitEvent() appends to history with id/timestamp and emits both "event" and the channel name', () => {
    const onAny = vi.fn();
    const onChannel = vi.fn();
    bus.on('event', onAny);
    bus.on('order.created', onChannel);

    const evt = bus.emitEvent('order.created', 'web', { id: 42 });

    expect(evt.id).toMatch(/[0-9a-f-]{36}/);
    expect(evt.channel).toBe('order.created');
    expect(evt.side).toBe('web');
    expect(evt.payload).toEqual({ id: 42 });
    expect(typeof evt.timestamp).toBe('number');

    expect(bus.recent()).toEqual([evt]);
    expect(onAny).toHaveBeenCalledWith(evt);
    expect(onChannel).toHaveBeenCalledWith(evt);
  });

  it('caps history at 200 entries (FIFO)', () => {
    for (let i = 0; i < 250; i++) bus.emitEvent(`ch.${i}`, 'web', null);

    const recent = bus.recent();
    expect(recent).toHaveLength(200);
    expect(recent[0]!.channel).toBe('ch.50');
    expect(recent[199]!.channel).toBe('ch.249');
  });

  it('waitFor() resolves with the next event on the given channel', async () => {
    const promise = bus.waitFor('login.completed');
    bus.emitEvent('login.completed', 'web', { ok: true });

    const evt = await promise;
    expect(evt.channel).toBe('login.completed');
    expect(evt.payload).toEqual({ ok: true });
  });

  it('waitFor() rejects on timeout', async () => {
    vi.useFakeTimers();
    const promise = bus.waitFor('never.fires', 100);
    vi.advanceTimersByTime(101);
    await expect(promise).rejects.toThrow(/timed out/);
    vi.useRealTimers();
  });

  it('waitFor() ignores other channels', async () => {
    const promise = bus.waitFor('a.done');
    bus.emitEvent('b.done', 'web', null);
    bus.emitEvent('a.done', 'web', { hit: true });

    await expect(promise).resolves.toMatchObject({ channel: 'a.done', payload: { hit: true } });
  });

  describe('remove(id)', () => {
    it('removes the matching event from history and emits "remove"', () => {
      const onRemove = vi.fn();
      bus.on('remove', onRemove);

      const a = bus.emitEvent('a', 'web', null);
      const b = bus.emitEvent('b', 'web', null);

      const after = bus.remove(a.id);

      expect(after).toEqual([b]);
      expect(bus.recent()).toEqual([b]);
      expect(onRemove).toHaveBeenCalledWith({ id: a.id });
    });

    it('is a no-op for unknown ids', () => {
      const onRemove = vi.fn();
      bus.on('remove', onRemove);

      const a = bus.emitEvent('a', 'web', null);
      const after = bus.remove('nope');

      expect(after).toEqual([a]);
      expect(onRemove).not.toHaveBeenCalled();
    });
  });

  describe('clearHistory()', () => {
    it('empties history and emits "clear"', () => {
      const onClear = vi.fn();
      bus.on('clear', onClear);

      bus.emitEvent('a', 'web', null);
      bus.emitEvent('b', 'web', null);

      const after = bus.clearHistory();

      expect(after).toEqual([]);
      expect(bus.recent()).toEqual([]);
      expect(onClear).toHaveBeenCalledOnce();
    });
  });
});
