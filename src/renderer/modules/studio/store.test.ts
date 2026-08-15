// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CHANNELS } from '@shared/ipc/channels';
import { useStudioStore } from './store';

/**
 * Scripts live under the active workspace's folder, so switching workspace
 * changes which files exist. Everything the screen holds about them has to go
 * with the workspace it came from — the tree *and* the buffer in the editor.
 *
 * Boundary: `window.bridge` is stubbed. The store must never reach a real IPC
 * channel.
 */

const invoke = vi.fn();

const NEXT = [{ path: 'example.ts', name: 'example.ts', type: 'file' as const }];

beforeEach(() => {
  invoke.mockReset();
  invoke.mockImplementation(async (channel: string) => {
    if (channel === CHANNELS.STUDIO_SCRIPTS_LIST) return NEXT;
    return null;
  });
  window.bridge = { invoke, on: () => () => {}, channels: {}, platform: 'darwin' } as never;
  useStudioStore.setState({ scripts: [], currentScript: null });
});

describe('studio store — reloadScripts', () => {
  it('refetches the tree for the workspace now active', async () => {
    useStudioStore.setState({
      scripts: [{ path: 'lib', name: 'lib', type: 'folder' }],
    });

    await useStudioStore.getState().reloadScripts();

    expect(useStudioStore.getState().scripts).toEqual(NEXT);
  });

  // Kept, the open file leaves one workspace's script sitting above another
  // workspace's tree — which is what "switching did nothing" looks like.
  it('drops the open buffer, so the editor does not keep the old workspace file', async () => {
    useStudioStore.setState({
      currentScript: { path: 'example.ts', source: 'the other workspace' },
    });

    await useStudioStore.getState().reloadScripts();

    expect(useStudioStore.getState().currentScript).toBeNull();
  });

  // Both land in one update: a moment with the buffer already cleared and the
  // old tree still up is a moment the editor auto-picks a file that is about to
  // stop existing.
  it('clears the buffer and swaps the tree in the same update', async () => {
    useStudioStore.setState({
      scripts: [{ path: 'lib', name: 'lib', type: 'folder' }],
      currentScript: { path: 'lib/rows.ts', source: 'gone' },
    });
    const seen: Array<{ scripts: number; current: string | null }> = [];
    const stop = useStudioStore.subscribe((s) =>
      seen.push({ scripts: s.scripts.length, current: s.currentScript?.path ?? null }),
    );

    await useStudioStore.getState().reloadScripts();
    stop();

    expect(seen).toEqual([{ scripts: NEXT.length, current: null }]);
  });
});
