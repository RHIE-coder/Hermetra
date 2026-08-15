import type { StudioLogLine } from '@shared/types/studio';
import type { SidecarFrame, SidecarRequest } from '../sidecar/protocol';
import type { StudioRpc } from './studioSession';

/**
 * Request out, reply back, matched by id.
 *
 * The transport is injected because there are two of them and they are not
 * alike: a spawned sidecar over stdio, and — under `HERMETRA_DRIVERS=mock` — the
 * same dispatcher called in this process. What both owe this layer is the same
 * three things: take a request, deliver frames, and say when they are gone.
 *
 * That last one is not decoration. A promise waiting on a child that has died is
 * a button on the screen that never comes back.
 */

export interface RpcTransport {
  /** Returns false when there is nothing to deliver to. */
  send(request: SidecarRequest): boolean;
  onFrame(cb: (frame: SidecarFrame) => void): void;
  onGone(cb: (why: string) => void): void;
}

export function createRpc(transport: RpcTransport): StudioRpc {
  let nextId = 1;
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  const listeners = new Set<(line: StudioLogLine) => void>();

  transport.onFrame((frame) => {
    if (frame.t === 'log') {
      const { runId, at, level, text } = frame;
      for (const cb of listeners) cb({ runId, at, level, text });
      return;
    }
    if (frame.t !== 'reply') return;
    const waiting = pending.get(frame.id);
    // A reply to a request that already gave up (or was never made). Dropping it
    // is right — inventing a caller for it is not.
    if (!waiting) return;
    pending.delete(frame.id);
    if (frame.ok) waiting.resolve(frame.value);
    else waiting.reject(new Error(frame.error));
  });

  transport.onGone((why) => {
    const waiting = [...pending.values()];
    pending.clear();
    for (const w of waiting) w.reject(new Error(why));
  });

  return {
    send: (request) =>
      new Promise((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        if (!transport.send({ ...request, id } as SidecarRequest)) {
          pending.delete(id);
          reject(new Error('The workbench browser is not running.'));
        }
      }),
    onLog: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}
