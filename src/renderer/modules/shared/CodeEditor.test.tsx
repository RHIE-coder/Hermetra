// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ScriptFile, ScriptFileBody } from '@shared/types/web';
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
  current: null as ScriptFileBody | null,
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

/* ─── scripts-tree-dnd ──────────────────────────────────────────────── */

// Minimal DataTransfer stub: happy-dom does not implement HTML5 DnD; RTL's
// fireEvent.dragStart/dragOver/drop only carry whatever dataTransfer object
// we hand them. We mirror what the implementation needs: setData/getData on
// a custom MIME type, effectAllowed read/write, and a no-op setDragImage.
function makeDataTransfer() {
  const store = new Map<string, string>();
  return {
    effectAllowed: 'none' as string,
    dropEffect: 'none' as string,
    setData: (type: string, value: string) => {
      store.set(type, value);
    },
    getData: (type: string) => store.get(type) ?? '',
    setDragImage: vi.fn(),
    clearData: () => store.clear(),
    types: Array.from(store.keys()),
    files: [] as File[],
    items: [] as unknown[],
  };
}

const dragRow = (path: string) =>
  document.querySelector<HTMLElement>(`[data-drag-path="${path}"]`);
const dropTarget = (path: string) =>
  document.querySelector<HTMLElement>(`[data-drop-target="${path}"]`);

const scriptsWithFolders: ScriptFile[] = [
  { path: 'auth', name: 'auth', type: 'folder' },
  { path: 'auth/admin.ts', name: 'admin.ts', type: 'file' },
  { path: 'flows', name: 'flows', type: 'folder' },
  { path: 'flows/checkout.ts', name: 'checkout.ts', type: 'file' },
  { path: 'a.ts', name: 'a.ts', type: 'file' },
  { path: 'b.ts', name: 'b.ts', type: 'file' },
  { path: 'c.ts', name: 'c.ts', type: 'file' },
];

describe('CodeEditor — drag & drop (scripts-tree-dnd)', () => {
  // AC1: single file dragged onto a folder triggers a single-element move batch.
  it('AC1: drops a single file onto a folder → onMove called with that move', async () => {
    const onMove = vi.fn().mockResolvedValue({ ok: true });
    render(
      <I18nProvider>
        <CodeEditor {...baseProps()} scripts={scriptsWithFolders} onMove={onMove} />
      </I18nProvider>,
    );

    const source = dragRow('a.ts');
    const target = dropTarget('auth');
    expect(source).not.toBeNull();
    expect(target).not.toBeNull();

    const dt = makeDataTransfer();
    fireEvent.dragStart(source!, { dataTransfer: dt });
    fireEvent.dragOver(target!, { dataTransfer: dt });
    fireEvent.drop(target!, { dataTransfer: dt });

    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith([{ from: 'a.ts', to: 'auth/a.ts' }]);
  });

  // AC2: single folder dragged onto the root drop zone → moved to root.
  it('AC2: drops a folder onto the root drop zone → onMove called with root-targeted move', async () => {
    const onMove = vi.fn().mockResolvedValue({ ok: true });
    render(
      <I18nProvider>
        <CodeEditor
          {...baseProps()}
          scripts={[
            { path: 'auth', name: 'auth', type: 'folder' },
            { path: 'auth/nested', name: 'nested', type: 'folder' },
            { path: 'auth/nested/x.ts', name: 'x.ts', type: 'file' },
          ]}
          onMove={onMove}
        />
      </I18nProvider>,
    );

    const source = dragRow('auth/nested');
    const root = dropTarget('');
    expect(source).not.toBeNull();
    expect(root).not.toBeNull();

    const dt = makeDataTransfer();
    fireEvent.dragStart(source!, { dataTransfer: dt });
    fireEvent.dragOver(root!, { dataTransfer: dt });
    fireEvent.drop(root!, { dataTransfer: dt });

    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith([{ from: 'auth/nested', to: 'nested' }]);
  });

  // AC3: Cmd-click multi-select then drop one of the selected items → all move together.
  it('AC3: Cmd-click multi-select then drop carries all selected items in the batch', async () => {
    const user = userEvent.setup();
    const onMove = vi.fn().mockResolvedValue({ ok: true });
    render(
      <I18nProvider>
        <CodeEditor {...baseProps()} scripts={scriptsWithFolders} onMove={onMove} />
      </I18nProvider>,
    );

    const aRow = dragRow('a.ts');
    const bRow = dragRow('b.ts');
    expect(aRow).not.toBeNull();
    expect(bRow).not.toBeNull();

    // Cmd-click selects two files (toggle add).
    await user.click(aRow!);
    await user.keyboard('{Meta>}');
    await user.click(bRow!);
    await user.keyboard('{/Meta}');

    const dt = makeDataTransfer();
    // Drag begins from one of the selected items.
    fireEvent.dragStart(bRow!, { dataTransfer: dt });
    const target = dropTarget('auth');
    fireEvent.dragOver(target!, { dataTransfer: dt });
    fireEvent.drop(target!, { dataTransfer: dt });

    expect(onMove).toHaveBeenCalledTimes(1);
    const moves = onMove.mock.calls[0]![0] as { from: string; to: string }[];
    // Order is not contractual; sort to compare.
    const sorted = [...moves].sort((x, y) => x.from.localeCompare(y.from));
    expect(sorted).toEqual([
      { from: 'a.ts', to: 'auth/a.ts' },
      { from: 'b.ts', to: 'auth/b.ts' },
    ]);
  });

  // AC4: Shift-click range select + drop → range members included.
  it('AC4: Shift-click range select then drop includes every item in the range', async () => {
    const user = userEvent.setup();
    const onMove = vi.fn().mockResolvedValue({ ok: true });
    render(
      <I18nProvider>
        <CodeEditor {...baseProps()} scripts={scriptsWithFolders} onMove={onMove} />
      </I18nProvider>,
    );

    const aRow = dragRow('a.ts');
    const cRow = dragRow('c.ts');
    expect(aRow).not.toBeNull();
    expect(cRow).not.toBeNull();

    // Anchor click on a.ts, then shift-click c.ts to select a–b–c.
    await user.click(aRow!);
    await user.keyboard('{Shift>}');
    await user.click(cRow!);
    await user.keyboard('{/Shift}');

    const dt = makeDataTransfer();
    fireEvent.dragStart(cRow!, { dataTransfer: dt });
    const target = dropTarget('auth');
    fireEvent.dragOver(target!, { dataTransfer: dt });
    fireEvent.drop(target!, { dataTransfer: dt });

    expect(onMove).toHaveBeenCalledTimes(1);
    const moves = onMove.mock.calls[0]![0] as { from: string; to: string }[];
    const sorted = [...moves].sort((x, y) => x.from.localeCompare(y.from));
    expect(sorted).toEqual([
      { from: 'a.ts', to: 'auth/a.ts' },
      { from: 'b.ts', to: 'auth/b.ts' },
      { from: 'c.ts', to: 'auth/c.ts' },
    ]);
  });

  // AC5: conflict → error surface visible to the user; spec calls it a "toast".
  // No toast infra exists in this project (grep for `toast|sonner|use-toast`
  // returns nothing), so the implementer must surface the error somewhere
  // testable. We pin a stable testid `script-move-error` that the component
  // must render when onMove resolves to `{ ok: false }`.
  it('AC5: shows an error banner when onMove rejects with a conflict', async () => {
    const onMove = vi.fn().mockResolvedValue({
      ok: false,
      error: 'conflict',
      conflicts: ['auth/a.ts'],
    });
    render(
      <I18nProvider>
        <CodeEditor {...baseProps()} scripts={scriptsWithFolders} onMove={onMove} />
      </I18nProvider>,
    );

    const source = dragRow('a.ts');
    const target = dropTarget('auth');
    const dt = makeDataTransfer();
    fireEvent.dragStart(source!, { dataTransfer: dt });
    fireEvent.dragOver(target!, { dataTransfer: dt });
    await act(async () => {
      fireEvent.drop(target!, { dataTransfer: dt });
    });

    const banner = await screen.findByTestId('script-move-error');
    expect(banner).toBeInTheDocument();
    // The banner must mention the conflicting path so the user can locate it.
    expect(banner.textContent ?? '').toContain('auth/a.ts');
  });

  // AC6: folder dropped onto itself / its descendant is silently ignored
  // (no onMove call, no error banner).
  it('AC6: dropping a folder onto itself does NOT call onMove', async () => {
    const onMove = vi.fn().mockResolvedValue({ ok: true });
    render(
      <I18nProvider>
        <CodeEditor {...baseProps()} scripts={scriptsWithFolders} onMove={onMove} />
      </I18nProvider>,
    );

    const source = dragRow('auth');
    const target = dropTarget('auth');
    expect(source).not.toBeNull();
    expect(target).not.toBeNull();

    const dt = makeDataTransfer();
    fireEvent.dragStart(source!, { dataTransfer: dt });
    fireEvent.dragOver(target!, { dataTransfer: dt });
    fireEvent.drop(target!, { dataTransfer: dt });

    expect(onMove).not.toHaveBeenCalled();
  });

  it('AC6: dropping a folder onto its own descendant does NOT call onMove', async () => {
    const onMove = vi.fn().mockResolvedValue({ ok: true });
    render(
      <I18nProvider>
        <CodeEditor
          {...baseProps()}
          scripts={[
            { path: 'auth', name: 'auth', type: 'folder' },
            { path: 'auth/inner', name: 'inner', type: 'folder' },
            { path: 'auth/inner/x.ts', name: 'x.ts', type: 'file' },
          ]}
          onMove={onMove}
        />
      </I18nProvider>,
    );

    const source = dragRow('auth');
    const target = dropTarget('auth/inner');
    expect(source).not.toBeNull();
    expect(target).not.toBeNull();

    const dt = makeDataTransfer();
    fireEvent.dragStart(source!, { dataTransfer: dt });
    fireEvent.dragOver(target!, { dataTransfer: dt });
    fireEvent.drop(target!, { dataTransfer: dt });

    expect(onMove).not.toHaveBeenCalled();
  });

  // AC7: hovering a closed folder for ~600ms auto-expands it.
  it('AC7: hovering a collapsed folder for ~600ms during drag auto-expands it', async () => {
    vi.useFakeTimers();
    try {
      const onMove = vi.fn().mockResolvedValue({ ok: true });
      render(
        <I18nProvider>
          <CodeEditor {...baseProps()} scripts={scriptsWithFolders} onMove={onMove} />
        </I18nProvider>,
      );

      const source = dragRow('a.ts');
      const target = dropTarget('flows');
      expect(source).not.toBeNull();
      expect(target).not.toBeNull();

      // Before hovering, flows is collapsed → its child file is not in DOM.
      expect(dragRow('flows/checkout.ts')).toBeNull();

      const dt = makeDataTransfer();
      fireEvent.dragStart(source!, { dataTransfer: dt });
      fireEvent.dragEnter(target!, { dataTransfer: dt });
      fireEvent.dragOver(target!, { dataTransfer: dt });

      // Just under the threshold: still collapsed.
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(dragRow('flows/checkout.ts')).toBeNull();

      // Past the threshold (~600ms): auto-expanded.
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(dragRow('flows/checkout.ts')).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  // AC8: row currently being dragged renders dimmed (opacity-50).
  it('AC8: row being dragged is visually dimmed (opacity-50)', () => {
    const onMove = vi.fn().mockResolvedValue({ ok: true });
    render(
      <I18nProvider>
        <CodeEditor {...baseProps()} scripts={scriptsWithFolders} onMove={onMove} />
      </I18nProvider>,
    );

    const source = dragRow('a.ts');
    expect(source).not.toBeNull();

    const dt = makeDataTransfer();
    fireEvent.dragStart(source!, { dataTransfer: dt });

    // The implementation may apply the class to the row element itself or to
    // its inner container. Walk up/down a little to find a class hit.
    const hasDim = (el: Element | null) =>
      !!el && (el.className.toString().includes('opacity-50'));
    const inSubtree =
      hasDim(source) ||
      hasDim(source!.firstElementChild) ||
      hasDim(source!.parentElement) ||
      Array.from(source!.querySelectorAll('*')).some((c) => hasDim(c));
    expect(inSubtree).toBe(true);
  });
});

/**
 * The tree lists more than it runs. The workbench seeds a guide per language
 * beside the scripts, so the file list is the place to *open* things — and pressing Run
 * on prose would hand markdown to the runner and print a syntax error the person
 * did not write.
 */
describe('CodeEditor — Run is for scripts, not for everything the tree lists', () => {
  const runButton = () => screen.getByRole('button', { name: /run|실행/i });

  it('runs a script file', () => {
    renderEditor({ ready: true, current: { path: 'example.ts', source: 'await page.goto("/")' } });
    expect(runButton()).toBeEnabled();
  });

  it('does not offer to run a markdown file', () => {
    renderEditor({ ready: true, current: { path: 'GUIDE_ko.md', source: '# guide' } });
    expect(runButton()).toBeDisabled();
  });

  it('still runs a buffer nobody has named yet', () => {
    // An unnamed buffer becomes `untitled.ts` at run time, so it is a script.
    renderEditor({ ready: true, current: { path: '', source: 'await page.goto("/")' } });
    expect(runButton()).toBeEnabled();
  });
});

/**
 * The tree lists a file written to be read, and opening it in the code editor
 * hands the reader `|---|---|`. So the one file type that is prose can be shown
 * as prose.
 */
describe('CodeEditor — a markdown file can be read as a document', () => {
  const previewToggle = () => screen.queryByTestId('editor-preview-toggle');

  const GUIDE = [
    '# Browser workbench',
    '',
    'Nothing in it is this app\'s **invention**.',
    '',
    '| For | Read |',
    '|---|---|',
    '| `page` | the Playwright docs |',
    '',
  ].join('\n');

  it('offers the toggle for markdown and not for a script', () => {
    const { unmount } = renderEditor({
      current: { path: 'example.ts', source: 'await page.goto("/")' },
    });
    expect(previewToggle()).toBeNull();
    unmount();

    renderEditor({ current: { path: 'GUIDE_en.md', source: GUIDE } });
    expect(previewToggle()).not.toBeNull();
  });

  it('renders headings and GFM tables instead of the source', async () => {
    const user = userEvent.setup();
    renderEditor({ current: { path: 'GUIDE_en.md', source: GUIDE } });

    await user.click(previewToggle()!);

    const pane = screen.getByTestId('editor-preview');
    expect(within(pane).getByRole('heading', { level: 1 })).toHaveTextContent('Browser workbench');
    // Without remark-gfm the pipe table stays a paragraph of `|---|---|`, which
    // is the exact thing this view exists to stop showing.
    expect(within(pane).getByRole('table')).toBeInTheDocument();
    expect(within(pane).getByRole('columnheader', { name: 'For' })).toBeInTheDocument();
  });

  it('renders a fenced block as a block, not as a chip', async () => {
    const user = userEvent.setup();
    renderEditor({
      // No language on the fence: react-markdown stopped marking inline vs block
      // with a prop, and an unlabelled fence carries no class to test either, so
      // this is the case that catches a `code` renderer dressing both the same.
      current: { path: 'GUIDE_en.md', source: '```\nawait page.goto("/")\n```\n' },
    });

    await user.click(previewToggle()!);

    const pane = screen.getByTestId('editor-preview');
    const pre = pane.querySelector('pre');
    expect(pre).not.toBeNull();
    expect(pre!.textContent).toContain('await page.goto("/")');
  });

  it('goes back to the source on a second press', async () => {
    const user = userEvent.setup();
    renderEditor({ current: { path: 'GUIDE_en.md', source: GUIDE } });

    await user.click(previewToggle()!);
    expect(screen.queryByTestId('editor-preview')).toBeInTheDocument();

    await user.click(previewToggle()!);
    expect(screen.queryByTestId('editor-preview')).not.toBeInTheDocument();
  });

  it('links leave the app rather than navigate the renderer', async () => {
    const user = userEvent.setup();
    renderEditor({
      current: { path: 'GUIDE_en.md', source: '[docs](https://playwright.dev/docs/api/class-page)' },
    });

    await user.click(previewToggle()!);

    const link = within(screen.getByTestId('editor-preview')).getByRole('link', { name: 'docs' });
    // main's setWindowOpenHandler answers this with shell.openExternal and
    // denies the navigation; an in-page href would replace the whole app.
    expect(link).toHaveAttribute('target', '_blank');
  });
});

/**
 * The complaint this answers: "the area I write code in feels cramped". The
 * panels around the file are what take the room, so the wide view folds them.
 */
describe('CodeEditor — the wide view', () => {
  const renderWide = () =>
    render(
      <I18nProvider>
        <CodeEditor
          {...baseProps()}
          scripts={scriptsWithFolders}
          beforeGrid={<div data-testid="before-grid">browser bar</div>}
        />
      </I18nProvider>,
    );

  it('folds the file tree and the panel above the grid, and Esc brings them back', async () => {
    const user = userEvent.setup();
    renderWide();

    expect(screen.getByTestId('before-grid')).toBeInTheDocument();
    expect(dragRow('a.ts')).not.toBeNull();

    await user.click(screen.getByTestId('editor-focus-toggle'));
    expect(screen.queryByTestId('before-grid')).not.toBeInTheDocument();
    expect(dragRow('a.ts')).toBeNull();

    // A mode that hides the tree has to be leavable without finding the button
    // that hid it.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByTestId('before-grid')).toBeInTheDocument();
    expect(dragRow('a.ts')).not.toBeNull();
  });

  it('keeps the output panel — a run still has somewhere to report', async () => {
    const user = userEvent.setup();
    renderWide();

    await user.click(screen.getByTestId('editor-focus-toggle'));
    expect(screen.getByText(/^(Output|출력)$/)).toBeInTheDocument();
  });

  /**
   * Narrowing the window used to scroll the whole screen sideways, carrying the
   * title and the file tree off the left edge. A `1fr` track will not go under
   * its content's min-content width, and this column's content is Monaco, which
   * reports the width it last laid out at — so the track kept the wide size.
   *
   * happy-dom does not do grid layout, so this pins the declaration rather than
   * the pixels; the measurement lives in the run record. A bare `1fr` here is
   * the whole bug, and it is one character away from coming back.
   */
  it('sizes the editor track so it can shrink below its content', () => {
    renderEditor({ scripts: scriptsWithFolders });

    expect(screen.getByTestId('editor-grid').className).toContain('minmax(0,1fr)');
  });
});
