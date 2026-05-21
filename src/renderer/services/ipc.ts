import type { CHANNELS, RequestOf, ResponseOf } from '@shared/ipc/channels';

type ChannelName = (typeof CHANNELS)[keyof typeof CHANNELS];

export function invoke<C extends ChannelName>(channel: C, payload?: RequestOf<C>): Promise<ResponseOf<C>> {
  return window.bridge.invoke(channel, payload);
}

export function subscribe<C extends ChannelName>(
  channel: C,
  listener: (payload: ResponseOf<C>) => void,
) {
  return window.bridge.on(channel, listener);
}
