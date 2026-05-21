import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VarBus } from '@main/bridge/varBus';

describe('VarBus (biz logic)', () => {
  let bus: VarBus;

  beforeEach(() => {
    bus = new VarBus();
  });

  it('starts empty', () => {
    expect(bus.list()).toEqual([]);
    expect(bus.get('x')).toBeNull();
  });

  it('set() stores a value with metadata and emits "update"', () => {
    const onUpdate = vi.fn();
    bus.on('update', onUpdate);

    const before = Date.now();
    const entry = bus.set('orderId', 'X-42', 'web');
    const after = Date.now();

    expect(entry.key).toBe('orderId');
    expect(entry.value).toBe('X-42');
    expect(entry.updatedBy).toBe('web');
    expect(entry.updatedAt).toBeGreaterThanOrEqual(before);
    expect(entry.updatedAt).toBeLessThanOrEqual(after);

    expect(onUpdate).toHaveBeenCalledOnce();
    expect(onUpdate.mock.calls[0]?.[0]).toEqual(entry);
  });

  it('set() overwrites an existing key (no duplicates in list)', () => {
    bus.set('k', '1', 'web');
    bus.set('k', '2', 'mobile');

    const list = bus.list();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ key: 'k', value: '2', updatedBy: 'mobile' });
  });

  it('list() returns entries sorted by key', () => {
    bus.set('b', '1', 'web');
    bus.set('a', '1', 'web');
    bus.set('c', '1', 'web');

    expect(bus.list().map((v) => v.key)).toEqual(['a', 'b', 'c']);
  });

  it('get() returns null for missing keys', () => {
    expect(bus.get('nope')).toBeNull();
  });

  it('clear() empties the store and emits "clear"', () => {
    const onClear = vi.fn();
    bus.on('clear', onClear);

    bus.set('a', '1', 'web');
    bus.set('b', '2', 'mobile');

    const result = bus.clear();

    expect(result).toEqual([]);
    expect(bus.list()).toEqual([]);
    expect(onClear).toHaveBeenCalledOnce();
  });

  describe('remove(key)', () => {
    it('deletes the entry and returns the resulting list', () => {
      bus.set('a', '1', 'web');
      bus.set('b', '2', 'mobile');

      const after = bus.remove('a');

      expect(after.map((v) => v.key)).toEqual(['b']);
      expect(bus.get('a')).toBeNull();
    });

    it('emits "remove" with the deleted key', () => {
      const onRemove = vi.fn();
      bus.on('remove', onRemove);

      bus.set('a', '1', 'web');
      bus.remove('a');

      expect(onRemove).toHaveBeenCalledOnce();
      expect(onRemove.mock.calls[0]?.[0]).toEqual({ key: 'a' });
    });

    it('is a no-op (no emit, returns current list) for missing keys', () => {
      const onRemove = vi.fn();
      bus.on('remove', onRemove);

      bus.set('keep', '1', 'web');
      const after = bus.remove('missing');

      expect(after.map((v) => v.key)).toEqual(['keep']);
      expect(onRemove).not.toHaveBeenCalled();
    });
  });
});
