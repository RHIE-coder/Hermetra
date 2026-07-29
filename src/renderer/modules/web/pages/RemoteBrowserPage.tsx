import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Globe,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Square,
  Trash2,
} from 'lucide-react';
import { useWebStore } from '../store';
import { useWorkspaceStore } from '@/modules/workspace/store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';

export function RemoteBrowserPage() {
  const t = useT();
  const {
    status,
    pages,
    bookmarks,
    loading,
    error,
    start,
    stop,
    refreshPages,
    navigate,
    newTab,
    closePage,
    setActive,
    saveBookmark,
    removeBookmark,
    setError,
  } = useWebStore();
  const install = useWorkspaceStore((s) => s.install);
  const installLogs = useWorkspaceStore((s) => s.installLogs);
  const installRunning = useWorkspaceStore((s) => s.installRunning);
  const installBrowser = useWorkspaceStore((s) => s.installBrowser);
  const refreshInstall = useWorkspaceStore((s) => s.refreshInstall);

  const [portInput, setPortInput] = useState(String(status.port));
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [navInput, setNavInput] = useState('');

  useEffect(() => setPortInput(String(status.port)), [status.port]);
  useEffect(() => {
    void refreshInstall();
  }, [refreshInstall]);

  useEffect(() => {
    if (!status.isRunning) return;
    const id = setInterval(refreshPages, 3000);
    return () => clearInterval(id);
  }, [status.isRunning, refreshPages]);

  const browserInstalled = install?.installed ?? false;
  const expectedPath = install?.executablePath ?? '';

  const onToggle = () => {
    setError(null);
    if (status.isRunning) void stop();
    else void start(parseInt(portInput, 10) || 9222);
  };

  const onAddBookmark = () => {
    if (!newUrl.trim()) return;
    void saveBookmark({
      id: crypto.randomUUID(),
      name: newName.trim() || newUrl.trim(),
      url: newUrl.trim(),
    });
    setNewName('');
    setNewUrl('');
  };

  return (
    <div data-testid="page-web-remote" className="min-h-full p-5 space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold tracking-tight">{t('web.remote.title')}</h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">{t('web.remote.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="bridge" className="gap-1.5">
            <ShieldCheck className="h-3 w-3" />
            {t('browser.stealth.label')}
          </Badge>
          <Badge variant={status.isRunning ? 'web' : 'outline'} className="text-xs">
            <span
              className={cn(
                'mr-1.5 inline-block h-1.5 w-1.5 rounded-full',
                status.isRunning ? 'bg-web animate-pulse' : 'bg-muted-foreground',
              )}
            />
            {status.isRunning ? t('common.running') : t('common.idle')}
          </Badge>
        </div>
      </header>

      {!status.driverAvailable && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="pt-5 text-sm text-amber-600 dark:text-amber-400">
            {t('web.remote.driverMissing')}
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="pt-5 text-sm text-destructive whitespace-pre-wrap">{error}</CardContent>
        </Card>
      )}

      {/* Single-Chromium install panel — auto-collapsed when ready */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">{t('browser.install.title')}</CardTitle>
              <CardDescription>{t('browser.install.desc')}</CardDescription>
            </div>
            {browserInstalled ? (
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> {t('browser.install.done')}
              </Badge>
            ) : (
              <Badge variant="danger">{t('browser.install.missing')}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={browserInstalled ? 'outline' : 'default'}
              size="sm"
              disabled={installRunning}
              onClick={() => void installBrowser()}
            >
              {installRunning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {installRunning
                ? t('browser.install.running')
                : browserInstalled
                  ? t('browser.install.reinstall')
                  : t('browser.install.run')}
            </Button>
            <code className="rounded-md bg-muted/60 px-2 py-1 text-[11px] font-mono text-muted-foreground">
              {t('browser.install.cmd')}
            </code>
          </div>
          {expectedPath && (
            <div className="text-[11px] text-muted-foreground font-mono break-all">
              {t('browser.install.expectedPath', { path: expectedPath })}
            </div>
          )}
          {installLogs.length > 0 && (
            <pre className="max-h-48 overflow-auto rounded-md bg-muted/60 px-2 py-1.5 font-mono text-[10px] leading-snug">
              {installLogs.join('\n')}
            </pre>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('web.remote.server')}</CardTitle>
            <CardDescription>
              {status.wsEndpoint ? (
                <span className="font-mono text-xs break-all">{status.wsEndpoint}</span>
              ) : (
                t('web.remote.endpointHint')
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t('web.remote.port')}</label>
              <Input
                type="number"
                disabled={status.isRunning || loading}
                value={portInput}
                onChange={(e) => setPortInput(e.target.value)}
                min={1024}
                max={65535}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={status.isRunning ? 'destructive' : 'default'}
                className="flex-1"
                disabled={loading || (!status.isRunning && !browserInstalled)}
                onClick={onToggle}
              >
                {status.isRunning ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {status.isRunning ? t('web.remote.stopServer') : t('web.remote.startServer')}
              </Button>
              <Button variant="outline" onClick={() => void refreshPages()} disabled={!status.isRunning}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t('web.remote.openPages')}</span>
                <Badge variant="outline">{pages.length}</Badge>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="https://… "
                  value={navInput}
                  onChange={(e) => setNavInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && navInput.trim()) {
                      void navigate(navInput.trim());
                    }
                  }}
                  disabled={!status.isRunning}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!status.isRunning}
                  onClick={() => {
                    void newTab(navInput.trim() || undefined);
                    setNavInput('');
                  }}
                >
                  <Plus className="h-4 w-4" /> {t('web.remote.newTab')}
                </Button>
              </div>
              {pages.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                  {t('web.remote.noPages')}
                </div>
              ) : (
                <ul className="space-y-1">
                  {pages.map((p) => (
                    <li
                      key={p.index}
                      className={cn(
                        'flex items-center gap-3 rounded-md border border-transparent px-3 py-2 transition-colors hover:bg-accent',
                        p.isActive && 'border-web/40 bg-web/5',
                      )}
                    >
                      <button
                        onClick={() => void setActive(p.index)}
                        aria-label={t('web.remote.selectTab')}
                        className={cn(
                          'h-3.5 w-3.5 rounded-full border-2',
                          p.isActive ? 'border-web bg-web' : 'border-border hover:border-web/60',
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{p.title}</div>
                        <div className="truncate text-xs text-muted-foreground font-mono">{p.url}</div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => void closePage(p.index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('web.remote.bookmarks')}</CardTitle>
            <CardDescription>{t('web.remote.bookmarksDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder={t('web.remote.bookmarkName')}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Input
                placeholder={t('web.remote.bookmarkUrl')}
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onAddBookmark()}
              />
              <Button variant="outline" onClick={onAddBookmark} disabled={!newUrl.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <ul className="space-y-1">
              {bookmarks.length === 0 ? (
                <li className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                  {t('web.remote.noBookmarks')}
                </li>
              ) : (
                bookmarks.map((bm) => (
                  <li
                    key={bm.id}
                    className="group flex items-center gap-3 rounded-md border border-transparent px-3 py-2 hover:bg-accent"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{bm.name}</div>
                      <div className="truncate text-xs text-muted-foreground font-mono">{bm.url}</div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!status.isRunning}
                      onClick={() => void navigate(bm.url)}
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> {t('common.open')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => void removeBookmark(bm.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
