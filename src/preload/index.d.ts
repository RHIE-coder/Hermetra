import type { CHANNELS, RequestOf, ResponseOf, ChannelName } from '../shared/ipc/channels';

declare global {
  interface Window {
    bridge: {
      invoke<C extends ChannelName>(channel: C, payload?: RequestOf<C>): Promise<ResponseOf<C>>;
      on<C extends ChannelName>(
        channel: C,
        listener: (payload: ResponseOf<C>) => void,
      ): () => void;
      channels: typeof CHANNELS;
      platform: NodeJS.Platform;
    };
  }
}

export {};
