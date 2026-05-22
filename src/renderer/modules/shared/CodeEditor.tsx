import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FileCode,
  FilePlus,
  Folder,
  FolderOpen,
  FolderPlus,
  Play,
  Plus,
  Save,
  Square,
  Terminal,
  Trash2,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import Editor from '@monaco-editor/react';
import type { ScriptFile, ScriptFileBody } from '@shared/types/web';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import type { MessageKey } from '@/lib/messages';

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

interface Props {
  accent: 'web' | 'mobile';
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
  defaultSeed: string;
  onLoad: (path: string) => Promise<void>;
  onSave: (body: ScriptFileBody) => Promise<void>;
  onDelete: (path: string) => Promise<void>;
  onMkdir: (path: string) => Promise<void>;
  onSelectNew: (body: ScriptFileBody) => void;
  onRun: (source: string) => Promise<void>;
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
  defaultSeed,
  onLoad,
  onSave,
  onDelete,
  onMkdir,
  onSelectNew,
  onRun,
}: Props) {
  const t = useT();
  const { resolvedTheme } = useTheme();
  const editorTheme = resolvedTheme === 'dark' ? 'vs-dark' : 'light';
  const [draft, setDraft] = useState<ScriptFileBody | null>(current);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [menuParent, setMenuParent] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingCreate | null>(null);
  const [pendingName, setPendingName] = useState('');
  const language = detectLanguage(draft?.path);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDraft(current);
  }, [current]);

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

  // Auto-pick the first file when nothing is loaded yet.
  useEffect(() => {
    if (current) return;
    const firstFile = scripts.find((s) => s.type === 'file');
    if (firstFile) void onLoad(firstFile.path);
  }, [current, scripts, onLoad]);

  useEffect(() => {
    if (!menuParent) return;
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuParent(null);
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

  const openMenu = (parent: string) => setMenuParent(parent);
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
    await onRun(draft.source);
  };

  const renderNode = (node: TreeNode, depth: number) => {
    if (node.type === 'folder') {
      const isOpen = expanded.has(node.path);
      return (
        <li key={`folder:${node.path}`} className="group">
          <div
            className="flex items-center gap-1 rounded-md hover:bg-accent"
            style={{ paddingLeft: 4 + depth * 12 }}
          >
            <button
              onClick={() => toggleFolder(node.path)}
              className="flex-1 flex items-center gap-1.5 px-1.5 py-1.5 text-left text-xs"
            >
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
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                openMenu(node.path);
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
          className={cn(
            'flex items-center gap-1 rounded-md hover:bg-accent',
            draft?.path === node.path && 'bg-accent',
          )}
          style={{ paddingLeft: 4 + depth * 12 }}
        >
          <button
            onClick={() => void onLoad(node.path)}
            className="flex-1 flex items-center gap-1.5 px-1.5 py-1.5 text-left text-xs"
          >
            <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="truncate font-mono">{node.name}</span>
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
      </li>
    );
  };

  const renderMenu = (parent: string, indentDepth: number) => (
    <div
      ref={menuRef}
      className="panel z-20 my-1 mx-1 border border-border text-xs"
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
    <div className={cn(accent === 'web' ? 'gradient-web' : 'gradient-mobile', 'min-h-full p-6 space-y-6')}>
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Terminal className={cn('h-5 w-5', accent === 'web' ? 'text-web' : 'text-mobile')} />
            <h1 className="text-2xl font-semibold tracking-tight">{t(titleKey)}</h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">{t(subtitleKey)}</p>
        </div>
        <div className="flex items-center gap-2">
          {rightHeader}
          <Badge variant={ready ? accent : 'outline'}>{ready ? readyLabel : notReadyLabel}</Badge>
          <Button
            variant={accent}
            disabled={!ready || busy || !draft}
            onClick={() => void handleRun()}
          >
            {busy ? <Square className="h-4 w-4 animate-pulse" /> : <Play className="h-4 w-4" />}
            {t('common.run')}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-[240px_1fr] gap-4 min-h-[60vh]">
        <aside className="rounded-xl border border-border bg-card/50 overflow-hidden flex flex-col">
          <div className="relative flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {t('web.code.files')}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => openMenu('')}
              title={t('web.code.newItem')}
            >
              <Plus className="h-4 w-4" />
            </Button>
            {menuParent === '' && (
              <div className="absolute right-2 top-9 z-20">{renderMenu('', 0)}</div>
            )}
          </div>
          <ul className="flex-1 overflow-y-auto p-1">
            {pending?.parent === '' && renderPendingRow(0)}
            {tree.length === 0 && pending?.parent !== '' ? (
              <li className="px-3 py-2 text-xs text-muted-foreground">{t('web.code.empty')}</li>
            ) : (
              tree.map((n) => renderNode(n, 0))
            )}
          </ul>
        </aside>

        <div className="flex flex-col gap-3 min-h-0">
          <div className="flex items-center justify-between rounded-md border border-border bg-card/50 px-3 py-2">
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
            <Button
              variant="outline"
              size="sm"
              disabled={!draft || !dirty}
              onClick={() => void handleSave()}
            >
              <Save className="h-3.5 w-3.5" /> {t('common.save')}
            </Button>
          </div>

          <div className="flex-1 min-h-[360px] overflow-hidden rounded-md border border-border bg-card">
            <Editor
              height="100%"
              language={language}
              value={draft?.source ?? ''}
              theme={editorTheme}
              onChange={(value) =>
                setDraft(
                  draft
                    ? { ...draft, source: value ?? '' }
                    : { path: 'untitled.ts', source: value ?? '' },
                )
              }
              options={{
                minimap: { enabled: false },
                fontFamily: 'JetBrains Mono, ui-monospace, monospace',
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
          </div>

          <div className="rounded-md border border-border bg-card/50">
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
