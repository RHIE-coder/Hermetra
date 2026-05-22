// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ScriptFile } from '@shared/types/web';
import { I18nProvider } from '@/lib/i18n';
import { CodeEditor } from './CodeEditor';

// Monaco's React wrapper relies on web workers + browser APIs that happy-dom
// doesn't implement; the editor is irrelevant to menu toggle/dismiss behavior,
// so stub it out entirely.
vi.mock('@monaco-editor/react', () => ({ default: () => null }));

// next-themes' useTheme calls window APIs that happy-dom partially supports;
// the test never asserts on theme, so a stable stub keeps render deterministic.
vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

const baseProps = () => ({
  accent: 'web' as const,
  titleKey: 'web.code.title' as const,
  subtitleKey: 'web.code.subtitle' as const,
  scripts: [] as ScriptFile[],
  current: null,
  output: '',
  readyLabel: 'ready',
  notReadyLabel: 'idle',
  ready: false,
  busy: false,
  defaultSeed: '',
  onLoad: vi.fn().mockResolvedValue(undefined),
  onSave: vi.fn().mockResolvedValue(undefined),
  onDelete: vi.fn().mockResolvedValue(undefined),
  onMkdir: vi.fn().mockResolvedValue(undefined),
  onSelectNew: vi.fn(),
  onRun: vi.fn().mockResolvedValue(undefined),
});

const renderEditor = (overrides: Partial<ReturnType<typeof baseProps>> = {}) =>
  render(
    <I18nProvider>
      <CodeEditor {...baseProps()} {...overrides} />
    </I18nProvider>,
  );

// The header "+" lives in the sidebar header (aside > div), and per-folder
// "+" lives inside the folder row. We disambiguate by data-menu-trigger
// (spec adds it) so the test still works without relying on visual order.
const headerTrigger = () =>
  document.querySelector<HTMLButtonElement>('[data-menu-trigger=""]');

const folderTrigger = (folderPath: string) =>
  document.querySelector<HTMLButtonElement>(`[data-menu-trigger="${folderPath}"]`);

describe('CodeEditor — "+" menu toggle / dismiss', () => {
  it('header "+" toggles: second click on the same trigger closes the menu', async () => {
    const user = userEvent.setup();
    renderEditor();

    const trigger = headerTrigger();
    expect(trigger).not.toBeNull();

    // Open the menu.
    await user.click(trigger!);
    expect(screen.getByTestId('script-create-menu')).toBeInTheDocument();

    // Click the same trigger again — must close (toggle), not re-open.
    await user.click(trigger!);
    expect(screen.queryByTestId('script-create-menu')).not.toBeInTheDocument();
  });

  it('cross-trigger swap: opening another "+" closes the first menu and shows one at the new location', async () => {
    const user = userEvent.setup();
    renderEditor({
      scripts: [{ path: 'auth', name: 'auth', type: 'folder' }],
    });

    const header = headerTrigger();
    expect(header).not.toBeNull();

    // Open the header (top-level) menu.
    await user.click(header!);
    const firstMenu = screen.getByTestId('script-create-menu');
    expect(firstMenu).toBeInTheDocument();

    // Click the folder "+" — first menu should close, second should appear,
    // and there should still be exactly one menu rendered.
    const folder = folderTrigger('auth');
    expect(folder).not.toBeNull();
    await user.click(folder!);

    const menus = screen.queryAllByTestId('script-create-menu');
    expect(menus).toHaveLength(1);
    // The remaining menu must be the folder-scoped one (not the header one).
    // It is rendered as a sibling of the folder row, not inside the sidebar
    // header. We assert via DOM positioning: the menu shares an ancestor
    // <li> with the folder trigger.
    const folderLi = folder!.closest('li');
    expect(folderLi).not.toBeNull();
    expect(folderLi!.contains(menus[0]!)).toBe(true);
  });

  it('outside mousedown dismisses the menu', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(headerTrigger()!);
    expect(screen.getByTestId('script-create-menu')).toBeInTheDocument();

    // A mousedown on a part of the document not inside the menu or its
    // triggers should close the menu.
    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId('script-create-menu')).not.toBeInTheDocument();
  });

  it('mousedown on a menu item does not pre-close the menu (so the click handler can fire)', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(headerTrigger()!);
    const menu = screen.getByTestId('script-create-menu');
    const newFileBtn = within(menu).getByRole('button', { name: /new file|새 파일/i });

    // Simulate only the mousedown phase that the document handler sees.
    // The menu must remain open at this point — otherwise the menu's own
    // onClick handler (beginCreate) would never fire on real interaction.
    fireEvent.mouseDown(newFileBtn);
    expect(screen.queryByTestId('script-create-menu')).toBeInTheDocument();
  });
});
