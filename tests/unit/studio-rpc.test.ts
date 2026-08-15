import { describe, it, expect } from 'vitest';
import { createRpc, type RpcTransport } from '@main/services/studioRpc';
import type { SidecarFrame, SidecarRequest } from '@main/sidecar/protocol';

/**
 * Request out, reply back, matched by id.
 *
 * This is the piece that can hang the screen: a promise waiting on a sidecar
 * that has died is a button that never comes back. So the death of the child is
 * as much a part of the contract as the reply is.
 */

function fakeTransport(over: { deliver?: boolean } = {}) {
  const sent: SidecarRequest[] = [];
  let onFrame: ((f: SidecarFrame) => void) | undefined;
  let onGone: ((why: string) => void) | undefined;

  const transport: RpcTransport = {
    send: (req) => {
      sent.push(req);
      return over.deliver !== false;
    },
    onFrame: (cb) => { onFrame = cb; },
    onGone: (cb) => { onGone = cb; },
  };

  return {
    transport,
    sent,
    reply: (frame: SidecarFrame) => onFrame?.(frame),
    die: (why = 'exited with code 1') => onGone?.(why),
  };
}

describe('createRpc', () => {
  it('numbers requests and resolves the one that answers', async () => {
    const t = fakeTransport();
    const rpc = createRpc(t.transport);

    const first = rpc.send({ op: 'pages' });
    const second = rpc.send({ op: 'navigate', url: 'https://x' });
    expect(t.sent.map((r) => r.id)).toEqual([1, 2]);

    // Out of order on purpose: a long run must not hold up a quick tab read.
    t.reply({ t: 'reply', id: 2, ok: true, value: 'second' });
    t.reply({ t: 'reply', id: 1, ok: true, value: 'first' });

    expect(await first).toBe('first');
    expect(await second).toBe('second');
  });

  it('rejects with what the sidecar said went wrong', async () => {
    const t = fakeTransport();
    const rpc = createRpc(t.transport);
    const pending = rpc.send({ op: 'pages' });

    t.reply({ t: 'reply', id: 1, ok: false, error: 'A script is already running.' });
    await expect(pending).rejects.toThrow('A script is already running.');
  });

  it('fails at once when there is nothing to send to', async () => {
    // Rather than waiting for a reply that cannot come.
    const t = fakeTransport({ deliver: false });
    const rpc = createRpc(t.transport);
    await expect(rpc.send({ op: 'pages' })).rejects.toThrow(/not running/i);
  });

  it('rejects everything still waiting when the child dies', async () => {
    const t = fakeTransport();
    const rpc = createRpc(t.transport);
    const a = rpc.send({ op: 'pages' });
    const b = rpc.send({ op: 'pages' });

    t.die('died on SIGSEGV');

    await expect(a).rejects.toThrow('died on SIGSEGV');
    await expect(b).rejects.toThrow('died on SIGSEGV');
  });

  it('ignores a reply to a request nobody is waiting on', () => {
    const t = fakeTransport();
    createRpc(t.transport);
    expect(() => t.reply({ t: 'reply', id: 99, ok: true, value: null })).not.toThrow();
  });

  it('hands log frames to whoever subscribed, until they stop', () => {
    const t = fakeTransport();
    const rpc = createRpc(t.transport);
    const seen: string[] = [];
    const off = rpc.onLog((l) => seen.push(l.text));

    t.reply({ t: 'log', runId: 'r1', at: 1, level: 'log', text: 'one' });
    off();
    t.reply({ t: 'log', runId: 'r1', at: 2, level: 'log', text: 'two' });

    expect(seen).toEqual(['one']);
  });
});
