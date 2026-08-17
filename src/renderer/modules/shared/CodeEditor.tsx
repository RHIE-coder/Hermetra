import { useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent } from 'react';
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Code2,
  FileCode,
  FilePlus,
  Folder,
  FolderOpen,
  FolderPlus,
  Maximize2,
  Minimize2,
  Play,
  Plus,
  Save,
  Square,
  Terminal,
  Trash2,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import Editor from '@monaco-editor/react';
import type { ScriptFile, ScriptFileBody, ScriptMoveRequest, ScriptMoveResult } from '@shared/types/web';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import type { MessageKey } from '@/lib/messages';
import { EDITOR_THEME_NAME, applyEditorTheme, type MonacoThemeHost } from '@/lib/editor-theme';
import { MarkdownView } from './MarkdownView';

function detectLanguage(path: string | undefined): string {
  if (!path) return 'typescript';
  const ext = path.toLowerCase().split('.').pop();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'json':
      return 'json';
    case 'md':
      return 'markdown';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    default:
      return 'typescript';
  }
}

/**
 * What Run will accept. The tree lists more than it runs — the workbench seeds a
 * `GUIDE.md` next to the scripts — and handing prose to the runner prints a
 * syntax error in a file the person did not write. An unnamed buffer counts:
 * it becomes `untitled.ts` on the way out.
 */
const RUNNABLE_EXT = /\.(ts|js|tsx|jsx)$/i;
const isRunnable = (p: string | undefined) => !p?.trim() || RUNNABLE_EXT.test(p);

const sanitizeName = (raw: string) => raw.trim().replace(/[\\/]/g, '-').replace(/\.\./g, '.');

const joinPath = (parent: string, name: string) => (parent ? `${parent}/${name}` : name);

interface TreeNode {
  path: string;
  name: string;
  type: 'file' | 'folder';
  children: TreeNode[];
}

/**
 * Build a tree from a flat list of ScriptFile entries. Folder entries from
 * the service describe empty folders explicitly; folders along a file's path
 * are reconstructed implicitly so we don't depend on the service emitting
 * every ancestor.
 */
function buildTree(items: ScriptFile[]): TreeNode[] {
  const root: TreeNode = { path: '', name: '', type: 'folder', children: [] };
  const folders = new Map<string, TreeNode>();
  folders.set('', root);

  const ensureFolder = (relPath: string): TreeNode => {
    if (folders.has(relPath)) return folders.get(relPath)!;
    const parts = relPath.split('/');
    const name = parts[parts.length - 1];
    const parentPath = parts.slice(0, -1).join('/');
    const parent = ensureFolder(parentPath);
    const node: TreeNode = { path: relPath, name, type: 'folder', children: [] };
    parent.children.push(node);
    folders.set(relPath, node);
    return node;
  };

  for (const item of items) {
    if (item.type === 'folder') {
      ensureFolder(item.path);
    } else {
      const parts = item.path.split('/');
      const parentPath = parts.slice(0, -1).join('/');
      const parent = ensureFolder(parentPath);
      parent.children.push({ path: item.path, name: item.name, type: 'file', children: [] });
    }
  }

  const sortNode = (node: TreeNode) => {
    node.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortNode);
  };
  sortNode(root);
  return root.children;
}

type PendingCreate = { kind: 'file' | 'folder'; parent: string };

/** The slice of the Monaco namespace this file configures. */
interface MonacoTsHost {
  languages: {
    typescript: {
      ScriptTarget: { ESNext: number };
      ModuleKind: { ESNext: number };
      ModuleResolutionKind: { NodeJs: number };
      typescriptDefaults: {
        setCompilerOptions(options: Record<string, unknown>): void;
        setDiagnosticsOptions(options: Record<string, unknown>): void;
        addExtraLib(content: string, path?: string): void;
      };
    };
  };
}

/**
 * Make the editor agree with the runtime.
 *
 * A studio script is imported by Node with its types stripped, so `./lib/x.ts`
 * — extension and all — is the specifier that works. Monaco out of the box
 * rejects exactly that, and cannot see the file it points at either, so the
 * shipped seed opens covered in red squiggles under its own first line.
 *
 * Unresolved-module diagnostics are silenced rather than solved: the editor has
 * no filesystem to resolve against. Everything else — real type errors in the
 * code on screen — is left switched on, because that is the part worth having.
 */
function teachTypeScript(monaco: unknown, ambient?: string): void {
  const ts = (monaco as MonacoTsHost).languages?.typescript;
  if (!ts) return;

  ts.typescriptDefaults.setCompilerOptions({
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    allowImportingTsExtensions: true,
    allowNonTsExtensions: true,
    // Force, so every file counts as a module even with no import or export in
    // it. Otherwise TypeScript reads a plain script as a script and marks its
    // top-level `await` as an error — the first line of the seed, and of most
    // things anyone writes here. Node treats these files as modules
    // (`scripts/package.json` says `type: module`), so this matches the runtime.
    moduleDetection: 3,
    noEmit: true,
    strict: false,
  });
  ts.typescriptDefaults.setDiagnosticsOptions({
    diagnosticCodesToIgnore: [
      2307, // cannot find module — there is no filesystem here
      2792, // ...and its "did you mean to set moduleResolution" follow-up
    ],
  });
  // The runner's injected globals. Without them every `log()` and `page` in a
  // snippet reads as an error the moment it is typed.
  if (ambient) ts.typescriptDefaults.addExtraLib(ambient, 'file:///hermetra-env.d.ts');
}

interface Props {
  /**
   * Which area owns this editor. `pipeline` has no area colour on purpose —
   * the rail dropped its accents, and the pipeline never had one.
   */
  accent: 'web' | 'mobile' | 'pipeline';
  titleKey: MessageKey;
  subtitleKey: MessageKey;
  scripts: ScriptFile[];
  current: ScriptFileBody | null;
  output: string;
  readyLabel: string;
  notReadyLabel: string;
  ready: boolean;
  busy: boolean;
  rightHeader?: React.ReactNode;
  /**
   * Rendered full width between the header and the tree/editor grid. The
   * pipeline puts its browser bar here: the tabs it lists belong to the session
   * the editor runs against, so they have to sit above both columns.
   */
  beforeGrid?: React.ReactNode;
  defaultSeed: string;
  /**
   * Ambient declarations for the globals this slot's runner injects. Handed to
   * Monaco so the editor and the runtime say the same thing about `page`,
   * `log()` and friends.
   */
  ambient?: string;
  testId?: string;
  onLoad: (path: string) => Promise<void>;
  onSave: (body: ScriptFileBody) => Promise<void>;
  onDelete: (path: string) => Promise<void>;
  onMkdir: (path: string) => Promise<void>;
  onSelectNew: (body: ScriptFileBody) => void;
  /**
   * `path` is the file the buffer belongs to. The studio runs a script as a
   * real module, so where it sits decides what its imports resolve to; web and
   * mobile ignore it.
   */
  onRun: (source: string, path?: string) => Promise<void>;
  /**
   * Atomic batch move of files / folders. Resolves with `{ ok: true }` on
   * success or `{ ok: false, error, conflicts }` when any destination already
   * exists (no partial move). Optional: when absent, drag-and-drop is disabled.
   */
  onMove?: (moves: ScriptMoveRequest[]) => Promise<ScriptMoveResult>;
}

export function CodeEditor({
  accent,
  titleKey,
  subtitleKey,
  scripts,
  current,
  output,
  readyLabel,
  notReadyLabel,
  ready,
  busy,
  rightHeader,
  beforeGrid,
  defaultSeed,
  ambient,
  testId,
  onLoad,
  onSave,
  onDelete,
  onMkdir,
  onSelectNew,
  onRun,
  onMove,
}: Props) {
  const t = useT();
  const { resolvedTheme } = useTheme();
  const monacoRef = useRef<MonacoThemeHost | null>(null);
  const [draft, setDraft] = useState<ScriptFileBody | null>(current);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [menuParent, setMenuParent] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingCreate | null>(null);
  const [pendingName, setPendingName] = useState('');
  // ── scripts-tree-dnd state ─────────────────────────────────────────
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const lastClickedRef = useRef<string | null>(null);
  const [dragging, setDragging] = useState<Set<string>>(() => new Set());
  const [moveError, setMoveError] = useState<{ conflicts: string[]; message: string } | null>(
    null,
  );
  const expandTimerRef = useRef<{ path: string; id: ReturnType<typeof setTimeout> } | null>(null);
  const language = detectLanguage(draft?.path);
  const isMarkdown = language === 'markdown';
  // Two ways to give the file more room, kept apart because they answer
  // different questions. `preview` asks what a `.md` says; `focus` asks for the
  // panel width and height back off the tree and the browser bar.
  //
  // Both are remembered across files rather than reset on open: someone who
  // turned the guide into a document wants the next guide as a document too,
  // and someone reading wide wants to stay wide.
  const [preview, setPreview] = useState(false);
  const [focus, setFocus] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDraft(current);
  }, [current]);

  // The editor theme is built out of design tokens, and those tokens change
  // value when the app theme flips — so it has to be rebuilt, not just
  // re-selected. The frame delay lets next-themes stamp `data-theme` on the
  // document first; reading tokens before that yields the outgoing palette.
  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco) return undefined;
    const frame = requestAnimationFrame(() => applyEditorTheme(monaco, resolvedTheme === 'dark'));
    return () => cancelAnimationFrame(frame);
  }, [resolvedTheme]);

  // Expand the parent folder of the current file so its file is visible.
  useEffect(() => {
    if (!current) return;
    const parts = current.path.split('/');
    if (parts.length <= 1) return;
    const next = new Set(expanded);
    for (let i = 1; i < parts.length; i++) next.add(parts.slice(0, i).join('/'));
    setExpanded(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.path]);

  // Auto-pick the first file when nothing is loaded yet. Also expand the
  // ancestor folders so the picked file (and any siblings along the way)
  // are visible in the tree — drag-and-drop tests rely on those rows being
  // queryable on initial render.
  useEffect(() => {
    if (current) return;
    const firstFile = scripts.find((s) => s.type === 'file');
    if (!firstFile) return;
    void onLoad(firstFile.path);
    const parts = firstFile.path.split('/');
    if (parts.length <= 1) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      for (let i = 1; i < parts.length; i++) next.add(parts.slice(0, i).join('/'));
      return next;
    });
  }, [current, scripts, onLoad]);

  // Esc leaves the wide view. A mode that hides the file tree needs a way out
  // that does not require finding the button that hid it.
  useEffect(() => {
    if (!focus) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFocus(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [focus]);

  useEffect(() => {
    if (menuParent === null) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      const el = target instanceof Element ? target : null;
      const trigger = el?.closest('[data-menu-trigger]');
      if (trigger?.getAttribute('data-menu-trigger') === menuParent) return;
      setMenuParent(null);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuParent]);

  const tree = useMemo(() => buildTree(scripts), [scripts]);

  const dirty = useMemo(() => {
    if (!draft) return false;
    if (!current) return draft.source.length > 0;
    return draft.path !== current.path || draft.source !== current.source;
  }, [draft, current]);

  const toggleMenu = (parent: string) =>
    setMenuParent((current) => (current === parent ? null : parent));
  const closeMenu = () => setMenuParent(null);

  const beginCreate = (kind: 'file' | 'folder', parent: string) => {
    closeMenu();
    setPending({ kind, parent });
    setPendingName('');
    // Expand the parent so the input is visible.
    if (parent && !expanded.has(parent)) {
      const next = new Set(expanded);
      next.add(parent);
      setExpanded(next);
    }
  };

  const cancelCreate = () => {
    setPending(null);
    setPendingName('');
  };

  const commitCreate = async () => {
    if (!pending) return;
    const cleaned = sanitizeName(pendingName);
    if (!cleaned) {
      cancelCreate();
      return;
    }
    const full = joinPath(pending.parent, cleaned);
    if (pending.kind === 'folder') {
      await onMkdir(full);
      const next = new Set(expanded);
      next.add(full);
      setExpanded(next);
    } else {
      // Save an empty file immediately so it appears in the tree at once.
      const ext = /\.[A-Za-z0-9]+$/.test(cleaned) ? '' : '.ts';
      const path = full + ext;
      const body = { path, source: defaultSeed };
      await onSave(body);
      onSelectNew(body);
      setDraft(body);
    }
    cancelCreate();
  };

  const toggleFolder = (path: string) => {
    const next = new Set(expanded);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setExpanded(next);
  };

  // Flattened tree order respecting current expansion state. Used as the
  // canonical sequence for Shift-click range selection. Folders that are
  // collapsed do not contribute their descendants — the user reasons about
  // selection in terms of what they can see.
  const visibleFlatPaths = useMemo<string[]>(() => {
    const out: string[] = [];
    const walk = (nodes: TreeNode[]) => {
      for (const n of nodes) {
        out.push(n.path);
        if (n.type === 'folder' && expanded.has(n.path)) walk(n.children);
      }
    };
    walk(tree);
    return out;
  }, [tree, expanded]);

  const handleRowClick = (node: TreeNode, e: ReactMouseEvent) => {
    const path = node.path;
    if (e.shiftKey && lastClickedRef.current) {
      // Range select from lastClicked to clicked path in flat order.
      const anchor = lastClickedRef.current;
      const a = visibleFlatPaths.indexOf(anchor);
      const b = visibleFlatPaths.indexOf(path);
      if (a >= 0 && b >= 0) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        const range = visibleFlatPaths.slice(lo, hi + 1);
        setSelection(new Set([...selection, ...range]));
        return;
      }
    }
    if (e.metaKey || e.ctrlKey) {
      const next = new Set(selection);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      setSelection(next);
      lastClickedRef.current = path;
      return;
    }
    // Plain click: replace selection, then perform the type's default action.
    setSelection(new Set([path]));
    lastClickedRef.current = path;
    if (node.type === 'folder') toggleFolder(path);
    else void onLoad(path);
  };

  const isDescendantOrSelf = (parent: string, candidate: string) => {
    if (parent === candidate) return true;
    if (parent === '') return false;
    return candidate.startsWith(parent + '/');
  };

  const clearExpandTimer = () => {
    if (expandTimerRef.current) {
      clearTimeout(expandTimerRef.current.id);
      expandTimerRef.current = null;
    }
  };

  useEffect(() => () => clearExpandTimer(), []);

  const startExpandTimer = (folderPath: string) => {
    if (folderPath === '') return;
    if (expandTimerRef.current?.path === folderPath) return;
    clearExpandTimer();
    const id = setTimeout(() => {
      setExpanded((prev) => {
        if (prev.has(folderPath)) return prev;
        const next = new Set(prev);
        next.add(folderPath);
        return next;
      });
      expandTimerRef.current = null;
    }, 600);
    expandTimerRef.current = { path: folderPath, id };
  };

  const computeDraggedPaths = (originPath: string): string[] => {
    if (selection.has(originPath)) return Array.from(selection);
    return [originPath];
  };

  const isInvalidDrop = (paths: string[], targetFolder: string): boolean => {
    // Any folder being dragged cannot be dropped into itself or its descendants.
    for (const p of paths) {
      if (isDescendantOrSelf(p, targetFolder)) return true;
    }
    return false;
  };

  const handleDragStart = (node: TreeNode, e: ReactDragEvent<Element>) => {
    if (!onMove) return;
    const paths = computeDraggedPaths(node.path);
    setDragging(new Set(paths));
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('application/x-hermetra-scripts', JSON.stringify(paths));
    } catch {
      /* happy-dom may not support setData; we keep paths in component state. */
    }
  };

  const handleDragEnd = () => {
    setDragging(new Set());
    clearExpandTimer();
  };

  const handleDragOverFolder = (
    targetFolder: string,
    e: ReactDragEvent<Element>,
  ) => {
    if (!onMove) return;
    const paths = Array.from(dragging);
    if (paths.length > 0 && isInvalidDrop(paths, targetFolder)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnterFolder = (targetFolder: string) => {
    if (!onMove) return;
    if (targetFolder === '') return;
    const paths = Array.from(dragging);
    if (paths.length > 0 && isInvalidDrop(paths, targetFolder)) return;
    if (!expanded.has(targetFolder)) startExpandTimer(targetFolder);
  };

  const handleDragLeaveFolder = (targetFolder: string) => {
    if (expandTimerRef.current?.path === targetFolder) clearExpandTimer();
  };

  const handleDrop = async (
    targetFolder: string,
    e: ReactDragEvent<Element>,
  ) => {
    if (!onMove) return;
    e.preventDefault();
    e.stopPropagation();
    clearExpandTimer();
    const paths = Array.from(dragging);
    if (paths.length === 0) return;
    if (isInvalidDrop(paths, targetFolder)) {
      setDragging(new Set());
      return;
    }
    const moves: ScriptMoveRequest[] = paths.map((from) => {
      const name = from.split('/').pop() ?? from;
      const to = targetFolder === '' ? name : `${targetFolder}/${name}`;
      return { from, to };
    });
    setDragging(new Set());
    const result = await onMove(moves);
    if (result.ok) {
      setMoveError(null);
    } else {
      setMoveError({ conflicts: result.conflicts, message: result.error });
    }
  };

  const handleDelete = async (node: TreeNode) => {
    const key: MessageKey =
      node.type === 'folder' ? 'web.code.deleteFolderConfirm' : 'web.code.deleteFileConfirm';
    if (!confirm(t(key, { name: node.name }))) return;
    await onDelete(node.path);
  };

  const handleSave = async () => {
    if (!draft) return;
    await onSave(draft);
  };

  const handleRun = async () => {
    if (!draft) return;
    if (dirty) await onSave(draft);
    await onRun(draft.source, draft.path);
  };

  const renderNode = (node: TreeNode, depth: number) => {
    const isDimmed = dragging.has(node.path);
    const isSelected = selection.has(node.path);
    if (node.type === 'folder') {
      const isOpen = expanded.has(node.path);
      return (
        <li key={`folder:${node.path}`} className="group">
          <div
            data-drag-path={node.path}
            data-drop-target={node.path}
            draggable
            onDragStart={(e) => handleDragStart(node, e)}
            onDragEnd={handleDragEnd}
            onDragEnter={() => handleDragEnterFolder(node.path)}
            onDragOver={(e) => handleDragOverFolder(node.path, e)}
            onDragLeave={() => handleDragLeaveFolder(node.path)}
            onDrop={(e) => void handleDrop(node.path, e)}
            onClick={(e) => handleRowClick(node, e)}
            className={cn(
              'flex items-center gap-1 rounded-md hover:bg-accent',
              isSelected && 'bg-accent',
              isDimmed && 'opacity-50',
            )}
            style={{ paddingLeft: 4 + depth * 12 }}
          >
            <span className="flex-1 flex items-center gap-1.5 px-1.5 py-1.5 text-left text-xs">
              {isOpen ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              )}
              {isOpen ? (
                <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <Folder className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span className="truncate font-mono">{node.name}</span>
            </span>
            <button
              data-menu-trigger={node.path}
              onClick={(e) => {
                e.stopPropagation();
                toggleMenu(node.path);
              }}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground px-1.5"
              title={t('web.code.newItem')}
            >
              <Plus className="h-3 w-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                void handleDelete(node);
              }}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive pr-1.5"
              title={t('web.code.deleteFile')}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
          {menuParent === node.path && renderMenu(node.path, depth + 1)}
          {isOpen && (
            <ul>
              {pending?.parent === node.path && renderPendingRow(depth + 1)}
              {node.children.map((c) => renderNode(c, depth + 1))}
            </ul>
          )}
        </li>
      );
    }
    return (
      <li key={`file:${node.path}`} className="group">
        <div
          data-drag-path={node.path}
          draggable
          onDragStart={(e) => handleDragStart(node, e)}
          onDragEnd={handleDragEnd}
          onClick={(e) => handleRowClick(node, e)}
          className={cn(
            'flex items-center gap-1 rounded-md hover:bg-accent',
            (draft?.path === node.path || isSelected) && 'bg-accent',
            isDimmed && 'opacity-50',
          )}
          style={{ paddingLeft: 4 + depth * 12 }}
        >
          <span className="flex-1 flex items-center gap-1.5 px-1.5 py-1.5 text-left text-xs">
            <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="truncate font-mono">{node.name}</span>
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              void handleDelete(node);
            }}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive pr-1.5"
            title={t('web.code.deleteFile')}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </li>
    );
  };

  const renderMenu = (parent: string, indentDepth: number) => (
    <div
      ref={menuRef}
      // A menu genuinely floats, so it takes the overlay elevation rather than
      // the panel one. No border: the 1px ring is already inside the shadow.
      className="panel z-20 mx-1 my-1 text-xs shadow-lg"
      style={{ marginLeft: 4 + indentDepth * 12 }}
      data-testid="script-create-menu"
    >
      <button
        onClick={() => beginCreate('file', parent)}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent text-left"
      >
        <FilePlus className="h-3.5 w-3.5" />
        {t('web.code.newFile')}
      </button>
      <button
        onClick={() => beginCreate('folder', parent)}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent text-left"
      >
        <FolderPlus className="h-3.5 w-3.5" />
        {t('web.code.newFolder')}
      </button>
    </div>
  );

  const renderPendingRow = (depth: number) => (
    <li>
      <div className="flex items-center gap-1.5 py-1" style={{ paddingLeft: 4 + depth * 12 }}>
        {pending?.kind === 'folder' ? (
          <Folder className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <input
          autoFocus
          value={pendingName}
          onChange={(e) => setPendingName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void commitCreate();
            else if (e.key === 'Escape') cancelCreate();
          }}
          onBlur={() => void commitCreate()}
          placeholder={
            pending?.kind === 'folder'
              ? t('web.code.folderNamePrompt')
              : t('web.code.fileNamePrompt')
          }
          className="flex-1 bg-transparent border border-border rounded px-1.5 py-0.5 text-xs font-mono outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
    </li>
  );

  return (
    // The screen is the height it is, and everything on it that is not the file
    // takes its share off the top. So the page stops growing past the viewport
    // and the editor takes whatever the rows above it did not — otherwise
    // folding a panel away only makes the page shorter and buys the file
    // nothing.
    <div
      data-testid={testId}
      className="flex h-full min-h-0 flex-col gap-6 overflow-auto p-6"
    >
      <header className="flex shrink-0 items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold tracking-tight">{t(titleKey)}</h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">{t(subtitleKey)}</p>
        </div>
        <div className="flex items-center gap-2">
          {rightHeader}
          <Badge variant={ready ? (accent === 'pipeline' ? 'secondary' : accent) : 'outline'}>
            {ready ? readyLabel : notReadyLabel}
          </Badge>
          <Button
            disabled={!ready || busy || !draft || !isRunnable(draft.path)}
            onClick={() => void handleRun()}
          >
            {busy ? <Square className="h-4 w-4 animate-pulse" /> : <Play className="h-4 w-4" />}
            {t('common.run')}
          </Button>
        </div>
      </header>

      {beforeGrid && !focus && <div className="shrink-0">{beforeGrid}</div>}

      {/*
        `minmax(0,…)`, not a bare `1fr`. A grid track sized `1fr` still refuses
        to go under its content's min-content width, and the editor's content is
        Monaco — which reports the width it last laid out at. So dragging the
        window narrower left the track at its old size and the whole screen
        scrolled sideways instead, carrying the title and the file tree off the
        left edge. (Tailwind's own `grid-cols-N` is `minmax(0,1fr)` for exactly
        this reason, which is why the wide view never had the bug.)
      */}
      <div
        data-testid="editor-grid"
        className={cn(
          'grid min-h-[420px] flex-1 gap-4',
          focus ? 'grid-cols-1' : 'grid-cols-[240px_minmax(0,1fr)]',
        )}
      >
        {!focus && (
          <aside className="rounded-lg bg-card shadow overflow-hidden flex flex-col">
            <div className="relative flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {t('web.code.files')}
              </span>
              <Button
                variant="ghost"
                size="icon"
                data-menu-trigger=""
                onClick={() => toggleMenu('')}
                title={t('web.code.newItem')}
              >
                <Plus className="h-4 w-4" />
              </Button>
              {menuParent === '' && (
                <div className="absolute right-2 top-9 z-20">{renderMenu('', 0)}</div>
              )}
            </div>
            {moveError && (
              <div
                data-testid="script-move-error"
                className="flex items-start gap-2 border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <div className="flex-1 break-words">
                  <div>
                    {moveError.conflicts.length > 0
                      ? t('web.code.move.conflict')
                      : moveError.message}
                  </div>
                  {moveError.conflicts.length > 0 && (
                    <div className="mt-1 font-mono break-all">
                      {moveError.conflicts.join(' · ')}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setMoveError(null)}
                  className="opacity-70 hover:opacity-100"
                  title={t('common.cancel')}
                >
                  ×
                </button>
              </div>
            )}
            <ul
              data-drop-target=""
              onDragOver={(e) => handleDragOverFolder('', e)}
              onDrop={(e) => void handleDrop('', e)}
              className="flex-1 overflow-y-auto p-1"
            >
              {pending?.parent === '' && renderPendingRow(0)}
              {tree.length === 0 && pending?.parent !== '' ? (
                <li className="px-3 py-2 text-xs text-muted-foreground">{t('web.code.empty')}</li>
              ) : (
                tree.map((n) => renderNode(n, 0))
              )}
            </ul>
          </aside>
        )}

        {/* `min-w-0` for the same reason one level down: this column is a flex
            container, and a flex item defaults to refusing to shrink past its
            content too. */}
        <div className="flex min-w-0 flex-col gap-3 min-h-0">
          <div className="flex shrink-0 items-center justify-between gap-2 rounded-md border border-border bg-card/50 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={draft?.path ?? ''}
                onChange={(e) => setDraft(draft ? { ...draft, path: e.target.value } : null)}
                placeholder={t('web.code.untitled')}
                className="bg-transparent text-sm font-mono outline-none w-72"
              />
              {dirty && (
                <Badge variant="outline" className="text-[10px] py-0">{t('web.code.unsaved')}</Badge>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {/* Only where there is something to render. A source/preview pair
                  on a `.ts` file offers a second view of the same thing. */}
              {isMarkdown && (
                <Button
                  variant={preview ? 'secondary' : 'outline'}
                  size="sm"
                  data-testid="editor-preview-toggle"
                  onClick={() => setPreview((v) => !v)}
                >
                  {preview ? <Code2 className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}
                  {preview ? t('web.code.showSource') : t('web.code.showPreview')}
                </Button>
              )}
              <Button
                variant={focus ? 'secondary' : 'outline'}
                size="icon"
                title={focus ? t('web.code.focusOff') : t('web.code.focusOn')}
                aria-label={focus ? t('web.code.focusOff') : t('web.code.focusOn')}
                aria-pressed={focus}
                data-testid="editor-focus-toggle"
                onClick={() => setFocus((v) => !v)}
              >
                {focus ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!draft || !dirty}
                onClick={() => void handleSave()}
              >
                <Save className="h-3.5 w-3.5" /> {t('common.save')}
              </Button>
            </div>
          </div>

          <div className="flex-1 min-h-[240px] overflow-hidden rounded-md border border-border bg-card">
            {isMarkdown && preview ? (
              <MarkdownView source={draft?.source ?? ''} testId="editor-preview" />
            ) : (
              <Editor
                height="100%"
                language={language}
                value={draft?.source ?? ''}
                theme={EDITOR_THEME_NAME}
                beforeMount={(monaco) => {
                  monacoRef.current = monaco as MonacoThemeHost;
                  applyEditorTheme(monacoRef.current, resolvedTheme === 'dark');
                  teachTypeScript(monaco, ambient);
                }}
                onChange={(value) =>
                  setDraft(
                    draft
                      ? { ...draft, source: value ?? '' }
                      : { path: 'untitled.ts', source: value ?? '' },
                  )
                }
                options={{
                  minimap: { enabled: false },
                  fontFamily: 'Geist Mono, ui-monospace, monospace',
                  fontSize: 13,
                  lineHeight: 20,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  renderLineHighlight: 'line',
                  padding: { top: 12, bottom: 12 },
                  smoothScrolling: true,
                  fixedOverflowWidgets: true,
                }}
              />
            )}
          </div>

          <div className="shrink-0 rounded-md border border-border bg-card/50">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {t('web.code.output')}
              </span>
            </div>
            <pre className="min-h-24 max-h-72 overflow-auto px-3 py-2 font-mono text-xs whitespace-pre-wrap">
              {output || t('web.code.outputEmpty')}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
