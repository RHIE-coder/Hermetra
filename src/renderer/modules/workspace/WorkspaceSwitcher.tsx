import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, FolderPlus, Pencil, Trash2 } from 'lucide-react';
import { activeWorkspace, useWorkspaceStore } from './store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import type { Workspace } from '@shared/types/workspace';

export function WorkspaceSwitcher() {
  const t = useT();
  const { state, saveWorkspace, setActive, remove, createWorkspace } = useWorkspaceStore();
  const active = useWorkspaceStore(activeWorkspace);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<Workspace | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  if (!state || !active) return null;

  const create = async () => {
    if (!newName.trim()) return;
    await createWorkspace(newName.trim());
    setNewName('');
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-2 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs',
          'hover:bg-accent transition-colors',
        )}
      >
        <FolderPlus className="h-3.5 w-3.5 text-bridge" />
        <span className="font-medium">{active.name}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-80 rounded-lg border border-border bg-card shadow-lg z-50">
          <div className="border-b border-border px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            {t('workspace.switch')}
          </div>
          <ul className="max-h-60 overflow-y-auto py-1">
            {state.workspaces.length === 0 ? (
              <li className="px-3 py-2 text-xs text-muted-foreground">{t('workspace.empty')}</li>
            ) : (
              state.workspaces.map((w) => (
                <li key={w.id} className="group">
                  {editing?.id === w.id ? (
                    <div className="space-y-1.5 px-3 py-2">
                      <Input
                        value={editing.name}
                        onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                        autoFocus
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={async () => {
                            await saveWorkspace(editing);
                            setEditing(null);
                          }}
                        >
                          {t('common.save')}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                          {t('common.cancel')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 text-sm',
                        w.id === active.id && 'bg-accent',
                      )}
                    >
                      <button
                        onClick={() => {
                          void setActive(w.id);
                          setOpen(false);
                        }}
                        className="flex flex-1 items-center gap-2 text-left"
                      >
                        {w.id === active.id ? (
                          <Check className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <span className="h-3.5 w-3.5" />
                        )}
                        <span className="font-medium">{w.name}</span>
                      </button>
                      <button
                        onClick={() => setEditing(w)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                        title={t('workspace.rename')}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => {
                          if (state.workspaces.length <= 1) {
                            alert(t('workspace.cannotDeleteLast'));
                            return;
                          }
                          if (confirm(t('workspace.deleteConfirm'))) void remove(w.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                        title={t('workspace.delete')}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </li>
              ))
            )}
          </ul>
          <div className="border-t border-border px-3 py-2 flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('workspace.namePrompt')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void create();
              }}
            />
            <Button variant="default" size="sm" disabled={!newName.trim()} onClick={() => void create()}>
              {t('workspace.create')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
