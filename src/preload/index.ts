import { contextBridge, ipcRenderer } from 'electron';
import { CHANNELS, type ChannelName } from '../shared/ipc/channels';

type AnyFn = (...args: unknown[]) => Promise<unknown>;

/**
 * Generic invoke wrapper. The renderer accesses each channel through a
 * function on `window.bridge`; type-safety is enforced at the call site
 * via `RequestOf<C>` / `ResponseOf<C>` from the channel registry.
 */
const invoke = (channel: ChannelName, payload?: unknown) => ipcRenderer.invoke(channel, payload);

const on = (channel: ChannelName, listener: (...args: unknown[]) => void) => {
  const handler = (_evt: unknown, ...args: unknown[]) => listener(...args);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

const api = {
  invoke,
  on,
  channels: CHANNELS,
  platform: process.platform,
};

contextBridge.exposeInMainWorld('bridge', api);

export type BridgeApi = {
  invoke: AnyFn;
  on: (channel: ChannelName, listener: (payload: unknown) => void) => () => void;
  channels: typeof CHANNELS;
  platform: NodeJS.Platform;
};
