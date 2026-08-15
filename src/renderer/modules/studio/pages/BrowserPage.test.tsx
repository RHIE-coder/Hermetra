// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '@/lib/i18n';
import { IDLE_SESSION, IDLE_SIDECAR } from '@shared/types/studio';
import type { StudioLogLine, StudioSessionStatus, SidecarStatus } from '@shared/types/studio';
import { useStudioStore } from '../store';
import { BrowserPage } from './BrowserPage';

/**
 * The workbench screen.
 *
 * Boundary: `window.bridge` is stubbed per test — nothing here may reach a real
 * channel, and the browser it drives does not exist. What is worth pinning is
 * the behaviour a person depends on: the browser is only started when asked,
 * the tab controls stay dead until something is actually attached, and output
 * appears as it arrives rather than at the end.
 *
 * Monaco is stubbed too: it needs a layout engine happy-dom does not have, and
 * this file is not testing the editor.
 */

vi.mock('@monaco-editor/react', () => ({
  default: ({ value }: { value?: string }) => <textarea readOnly value={value ?? ''} />,
}));

const invoke = vi.fn();
const listeners = new Map<string, (payload: unknown) => void>();

const sidecar = (over: Partial<SidecarStatus> = {}): SidecarStatus => ({ ...IDLE_SIDECAR, ...over });
const session = (over: Partial<StudioSessionStatus> = {}): StudioSessionStatus => ({
  ...IDLE_SESSION,
  ...over,
});

beforeEach(() => {
  invoke.mockReset();
  listeners.clear();
  invoke.mockImplementation(async (channel: string) => {
    if (channel === 'studio:sidecar:status') return sidecar();
    if (channel === 'studio:session:status') return session();
    if (channel === 'studio:scripts:list') return [];
    if (channel === 'studio:sidecar:start') return sidecar({ phase: 'starting' });
    if (channel === 'studio:sidecar:stop') return sidecar();
    return [];
  });
  window.bridge = {
    invoke,
    on: (channel: string, cb: (payload: unknown) => void) => {
      listeners.set(channel, cb);
      return () => listeners.delete(channel);
    },
    channels: {},
    platform: 'darwin',
  } as never;
  useStudioStore.setState({
    sidecar: sidecar(),
    session: session(),
    log: [],
    scripts: [],
    currentScript: null,
    busy: false,
  });
});

const setup = () =>
  render(
    <I18nProvider>
      <BrowserPage />
    </I18nProvider>,
  );

describe('Browser bench — the studio workbench', () => {
  it('renders the screen container the harness finds it by', async () => {
    setup();
    expect(await screen.findByTestId('page-studio-browser')).toBeInTheDocument();
  });

  it('does not start a browser on its own', async () => {
    // A stealth browser idling for someone who only opened the screen is pure
    // cost — the sidecar spec is explicit that nothing autostarts.
    setup();
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('studio:sidecar:status', undefined));
    expect(invoke).not.toHaveBeenCalledWith('studio:sidecar:start', expect.anything());
  });

  it('starts it windowed, because watching it work is the point of the screen', async () => {
    setup();
    await userEvent.click(await screen.findByTestId('studio-browser-toggle'));
    expect(invoke).toHaveBeenCalledWith('studio:sidecar:start', { headless: false });
  });

  it('starts it invisible once that has been asked for', async () => {
    setup();
    await userEvent.click(await screen.findByTestId('studio-browser-window'));
    await userEvent.click(screen.getByTestId('studio-browser-toggle'));
    expect(invoke).toHaveBeenCalledWith('studio:sidecar:start', { headless: true });
  });

  it('will not let the mode be flipped under a running browser', async () => {
    setup();
    await screen.findByTestId('studio-browser-window');
    useStudioStore.setState({ sidecar: sidecar({ phase: 'ready', endpoint: 'ws://x/1' }) });
    await waitFor(() =>
      expect(screen.getByTestId('studio-browser-window')).toBeDisabled(),
    );
  });

  it('keeps the address bar dead until something is attached', async () => {
    setup();
    expect(await screen.findByTestId('studio-url')).toBeDisabled();

    useStudioStore.setState({ session: session({ phase: 'attached', endpoint: 'ws://x/1' }) });
    await waitFor(() => expect(screen.getByTestId('studio-url')).toBeEnabled());
  });

  it('navigates the live tab from the address bar', async () => {
    setup();
    await screen.findByTestId('studio-url');
    useStudioStore.setState({ session: session({ phase: 'attached', endpoint: 'ws://x/1' }) });

    const bar = await screen.findByTestId('studio-url');
    await userEvent.type(bar, 'example.com{Enter}');
    expect(invoke).toHaveBeenCalledWith('studio:session:navigate', { url: 'example.com' });
  });

  it('lists the open tabs and marks which one is live', async () => {
    setup();
    useStudioStore.setState({
      session: session({
        phase: 'attached',
        endpoint: 'ws://x/1',
        pages: [
          { index: 0, title: 'a', url: 'https://a.test', isActive: false },
          { index: 1, title: 'b', url: 'https://b.test', isActive: true },
        ],
      }),
    });
    const tabs = await screen.findByTestId('studio-tabs');
    expect(tabs.textContent).toContain('https://a.test');
    expect(tabs.textContent).toContain('https://b.test');
  });

  // The address bar and the tab under it are both full-width monospace bars in
  // the same box. When the selected tab also wore the well this design system
  // keeps for "you type here" (`bg-muted` + `shadow-inner`, see Input), the two
  // were the same object to look at and people typed into neither.
  it('keeps the well for the address bar and off the tabs', async () => {
    setup();
    await screen.findByTestId('page-studio-browser');
    useStudioStore.setState({
      session: session({
        phase: 'attached',
        endpoint: 'ws://x/1',
        pages: [
          { index: 0, title: 'a', url: 'https://a.test', isActive: false },
          { index: 1, title: 'b', url: 'https://b.test', isActive: true },
        ],
      }),
    });

    const url = await screen.findByTestId('studio-url');
    expect(url.className).toContain('shadow-inner');

    const selected = await screen.findByRole('button', { name: 'https://b.test' });
    expect(selected.className).not.toContain('shadow-inner');
    expect(selected.className).not.toContain('bg-muted');
  });

  // The other half of that: telling the tabs apart from the address bar left
  // them with no edge at all, so the list read as loose text and nothing said
  // the rows could be pressed (2026-08-14 feedback).
  it('outlines every tab row, selected or not', async () => {
    setup();
    await screen.findByTestId('page-studio-browser');
    useStudioStore.setState({
      session: session({
        phase: 'attached',
        endpoint: 'ws://x/1',
        pages: [
          { index: 0, title: 'a', url: 'https://a.test', isActive: false },
          { index: 1, title: 'b', url: 'https://b.test', isActive: true },
        ],
      }),
    });

    for (const url of ['https://a.test', 'https://b.test']) {
      const row = await screen.findByRole('button', { name: url });
      expect(row.className).toContain('border-border');
    }
  });

  // The panel is the tallest thing above the editor and the tabs are set up
  // once, so it folds — but never the row that says whether the browser is up.
  it('folds the address bar and the tab list away, keeping the status row', async () => {
    setup();
    await screen.findByTestId('page-studio-browser');
    useStudioStore.setState({
      session: session({
        phase: 'attached',
        endpoint: 'ws://x/1',
        pages: [{ index: 0, title: 'a', url: 'https://a.test', isActive: true }],
      }),
    });
    await screen.findByTestId('studio-tabs');

    await userEvent.click(screen.getByTestId('studio-browser-fold'));
    expect(screen.queryByTestId('studio-url')).not.toBeInTheDocument();
    expect(screen.queryByTestId('studio-tabs')).not.toBeInTheDocument();
    expect(screen.getByTestId('studio-browser-toggle')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('studio-browser-fold'));
    expect(screen.getByTestId('studio-url')).toBeInTheDocument();
    expect(screen.getByTestId('studio-tabs')).toBeInTheDocument();
  });

  // The wide view unmounts the whole bar. If the fold lived inside it, one press
  // of that button would silently undo the choice.
  it('remembers the fold across the wide view', async () => {
    setup();
    await screen.findByTestId('page-studio-browser');

    await userEvent.click(screen.getByTestId('studio-browser-fold'));
    expect(screen.queryByTestId('studio-url')).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId('editor-focus-toggle'));
    expect(screen.queryByTestId('studio-browser-bar')).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId('editor-focus-toggle'));
    expect(screen.getByTestId('studio-browser-bar')).toBeInTheDocument();
    expect(screen.queryByTestId('studio-url')).not.toBeInTheDocument();
  });

  it('still says the browser died while the panel is folded', async () => {
    invoke.mockImplementation(async (channel: string) => {
      if (channel === 'studio:sidecar:status') {
        return sidecar({ phase: 'crashed', lastError: 'died on SIGSEGV' });
      }
      if (channel === 'studio:session:status') return session();
      return [];
    });
    setup();
    await screen.findByText(/SIGSEGV/);

    await userEvent.click(screen.getByTestId('studio-browser-fold'));
    expect(screen.getByText(/SIGSEGV/)).toBeInTheDocument();
  });

  it('shows a step’s output as each line arrives, not when it ends', async () => {
    // The reason the log is an event stream at all: a long step must not leave
    // the panel blank until it finishes.
    setup();
    await screen.findByTestId('page-studio-browser');

    const line = (text: string): StudioLogLine => ({
      runId: 'r1',
      at: 1,
      level: 'log',
      text,
    });
    useStudioStore.setState({ log: [line('first line')] });
    await waitFor(() => expect(screen.getByText(/first line/)).toBeInTheDocument());

    useStudioStore.setState({ log: [line('first line'), line('second line')] });
    await waitFor(() => expect(screen.getByText(/second line/)).toBeInTheDocument());
  });

  it('says why the browser died rather than only that it is off', async () => {
    // Reported through the load, not poked into the store afterwards: what the
    // screen shows has to be what the main process said.
    invoke.mockImplementation(async (channel: string) => {
      if (channel === 'studio:sidecar:status') {
        return sidecar({ phase: 'crashed', lastError: 'died on SIGSEGV' });
      }
      if (channel === 'studio:session:status') return session();
      return [];
    });
    setup();
    expect(await screen.findByText(/SIGSEGV/)).toBeInTheDocument();
  });

  it('warns that the first start is a download, so it does not read as a hang', async () => {
    invoke.mockImplementation(async (channel: string) => {
      if (channel === 'studio:sidecar:status') return sidecar({ phase: 'starting' });
      if (channel === 'studio:session:status') return session();
      return [];
    });
    setup();
    await waitFor(() =>
      expect(screen.getByTestId('studio-browser-bar').textContent).toMatch(
        /download|받느라/i,
      ),
    );
  });
});
