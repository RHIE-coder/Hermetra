import { useEffect, useMemo, useState } from 'react';
import { FileCode, Plus, Play, Save, Square, Terminal, Trash2 } from 'lucide-react';
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
  onSelectNew,
  onRun,
}: Props) {
  const t = useT();
  const { resolvedTheme } = useTheme();
  const editorTheme = resolvedTheme === 'dark' ? 'vs-dark' : 'light';
  const [draft, setDraft] = useState<ScriptFileBody | null>(current);
  const language = detectLanguage(draft?.path);

  useEffect(() => {
    setDraft(current);
  }, [current]);

  // Auto-pick first script if none selected
  useEffect(() => {
    if (!current && scripts.length > 0) void onLoad(scripts[0].path);
  }, [current, scripts, onLoad]);

  const dirty = useMemo(() => {
    if (!draft) return false;
    if (!current) return draft.source.length > 0;
    return draft.path !== current.path || draft.source !== current.source;
  }, [draft, current]);

  const handleNew = () => {
    const name = window.prompt(t('web.code.fileNamePrompt'), `script-${Date.now()}.ts`);
    if (!name) return;
    const safe = name.replace(/[^A-Za-z0-9._-]/g, '-');
    onSelectNew({ path: safe, source: defaultSeed });
    setDraft({ path: safe, source: defaultSeed });
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

      <div className="grid grid-cols-[220px_1fr] gap-4 min-h-[60vh]">
        <aside className="rounded-xl border border-border bg-card/50 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {t('web.code.files')}
            </span>
            <Button variant="ghost" size="icon" onClick={handleNew} title={t('web.code.newFile')}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <ul className="flex-1 overflow-y-auto p-1">
            {scripts.length === 0 ? (
              <li className="px-3 py-2 text-xs text-muted-foreground">{t('web.code.newFile')}…</li>
            ) : (
              scripts.map((f) => (
                <li key={f.path} className="group">
                  <button
                    onClick={() => void onLoad(f.path)}
                    className={cn(
                      'w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs',
                      'hover:bg-accent',
                      draft?.path === f.path && 'bg-accent text-foreground',
                    )}
                  >
                    <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate flex-1 font-mono">{f.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete ${f.name}?`)) void onDelete(f.path);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </button>
                </li>
              ))
            )}
          </ul>
        </aside>

        <div className="flex flex-col gap-3 min-h-0">
          <div className="flex items-center justify-between rounded-md border border-border bg-card/50 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-muted-foreground">📝</span>
              <input
                value={draft?.path ?? ''}
                onChange={(e) => setDraft(draft ? { ...draft, path: e.target.value } : null)}
                placeholder={t('web.code.untitled')}
                className="bg-transparent text-sm font-mono outline-none w-64"
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
