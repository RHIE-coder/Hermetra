import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Globe, Play, Plus, Square, Trash2, X } from 'lucide-react';
import type { SidecarStatus, StudioSessionStatus } from '@shared/types/studio';
import type { BrowserPage } from '@shared/types/web';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CodeEditor } from '@/modules/shared/CodeEditor';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import type { MessageKey } from '@/lib/messages';
import { useStudioStore } from '../store';

/**
 * The workbench.
 *
 * The other five pipeline screens are stores of material — a source, an
 * extraction, a transform, a destination. Building one of those means driving a
 * browser through all of them at once, so that work does not belong on any one
 * of them; it belongs here, where a browser stays up and a script is tried
 * against it until it is right.
 *
 * Nothing on this screen is a stage. It is the bench the stages get made on.
 */

const DEFAULT_SCRIPT = `// The live browser is in scope as \`page\`.
//   page  : the active tab of the pipeline browser
//   env   : process env
//   bus   : shared variable bus (get / set)
//   log() : one line into the panel below, as it happens
//
// Try a step here, then move what works into a script that exports
// extract() / transform() for a stage to reference.

await page.goto('https://example.com');
log('title:', await page.title());
`;

const SIDECAR_LABEL: Record<SidecarStatus['phase'], MessageKey> = {
  stopped: 'studio.browser.browser.stopped',
  starting: 'studio.browser.browser.starting',
  ready: 'studio.browser.browser.ready',
  crashed: 'studio.browser.browser.crashed',
};

const SESSION_LABEL: Record<StudioSessionStatus['phase'], MessageKey> = {
  detached: 'studio.browser.session.detached',
  attaching: 'studio.browser.session.attaching',
  attached: 'studio.browser.session.attached',
  error: 'studio.browser.session.error',
};

interface BrowserBarProps {
  sidecar: SidecarStatus;
  session: StudioSessionStatus;
  /** Lifted: a stage script reads it as `ctx.url`, and Run lives in the header. */
  url: string;
  onUrlChange: (url: string) => void;
  showWindow: boolean;
  onToggleWindow: () => void;
  onStart: () => void;
  onStop: () => void;
  onNavigate: (url: string) => void;
  onNewTab: (url?: string) => void;
  onClosePage: (index: number) => void;
  onSetActive: (index: number) => void;
  onClearLog: () => void;
}

function BrowserBar({
  sidecar,
  session,
  url,
  onUrlChange,
  showWindow,
  onToggleWindow,
  onStart,
  onStop,
  onNavigate,
  onNewTab,
  onClosePage,
  onSetActive,
  onClearLog,
}: BrowserBarProps) {
  const t = useT();
  const running = sidecar.phase === 'starting' || sidecar.phase === 'ready';
  const attached = session.phase === 'attached';
  const pages: BrowserPage[] = session.pages;

  const submit = () => {
    const value = url.trim();
    if (!value) return;
    onNavigate(value);
  };

  return (
    <section
      data-testid="studio-browser-bar"
      className="space-y-3 rounded-lg bg-card p-4 shadow"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={sidecar.phase === 'ready' ? 'secondary' : 'outline'}>
          {t(SIDECAR_LABEL[sidecar.phase])}
        </Badge>
        <Badge variant="outline">{t(SESSION_LABEL[session.phase])}</Badge>

        <Button
          variant={running ? 'destructive' : 'default'}
          size="sm"
          data-testid="studio-browser-toggle"
          onClick={running ? onStop : onStart}
        >
          {running ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {running ? t('studio.browser.stop') : t('studio.browser.start')}
        </Button>

        {/* The mode is chosen before a launch and carried by it — flipping this
            while the browser is up would say something the running browser is
            not doing. */}
        <Button
          variant={showWindow ? 'secondary' : 'outline'}
          size="sm"
          disabled={running}
          data-testid="studio-browser-window"
          onClick={onToggleWindow}
        >
          {showWindow ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          {showWindow ? t('studio.browser.windowed') : t('studio.browser.headless')}
        </Button>

        <Button variant="ghost" size="sm" onClick={onClearLog}>
          <Trash2 className="h-4 w-4" />
          {t('studio.browser.clearLog')}
        </Button>

        <span className="ml-auto max-w-[22rem] truncate font-mono text-[11px] text-muted-foreground">
          {sidecar.endpoint ?? t('studio.browser.noEndpoint')}
        </span>
      </div>

      {/* Two things a person needs told, and only when they are true: the first
          launch downloads a browser and looks hung, and a crash says why. */}
      {sidecar.phase === 'starting' && (
        <p className="break-keep text-xs text-muted-foreground">{t('studio.browser.firstRun')}</p>
      )}
      {sidecar.lastError && (
        <p className="break-keep text-xs text-destructive">{sidecar.lastError}</p>
      )}
      {session.lastError && (
        <p className="break-keep text-xs text-destructive">{session.lastError}</p>
      )}

      {/*
        The address bar and the tab under it were the same object to look at: two
        full-width monospace bars, both wearing the well (`bg-muted` + inset
        shadow) that this design system reserves for "you type here" — the tab
        borrowed it as its selected state. Nothing said which one took typing.

        So the two are told apart by what they are. The globe marks this row as
        the address bar, the way every browser marks it; the tabs give the well
        up for the raised `secondary` surface the rest of the app uses for a
        pressed control, and each carries a dot, which reads as a list entry and
        never as a field.
      */}
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Globe className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid="studio-url"
            placeholder="https://…"
            className="pl-8"
            value={url}
            disabled={!attached}
            onChange={(e) => onUrlChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
          />
        </div>
        <Button variant="outline" size="sm" disabled={!attached} onClick={submit}>
          {t('studio.browser.go')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!attached}
          onClick={() => onNewTab(url.trim() || undefined)}
        >
          <Plus className="h-4 w-4" />
          {t('studio.browser.newTab')}
        </Button>
      </div>

      {pages.length === 0 ? (
        <p className="rounded-md border border-dashed border-border py-4 text-center text-xs text-muted-foreground">
          {t('studio.browser.noTabs')}
        </p>
      ) : (
        <div className="space-y-1">
          <span className="block text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {t('studio.browser.tabs')}
          </span>
          <ul data-testid="studio-tabs" className="space-y-1">
            {pages.map((p) => (
              <li key={p.index} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSetActive(p.index)}
                  className={cn(
                    'flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left font-mono text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                    p.isActive && 'bg-secondary font-semibold text-secondary-foreground shadow-sm',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'h-1.5 w-1.5 shrink-0 rounded-full border border-muted-foreground',
                      p.isActive && 'border-primary bg-primary',
                    )}
                  />
                  <span className="truncate">{p.url}</span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  title={t('studio.browser.closeTab')}
                  onClick={() => onClosePage(p.index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function BrowserPage() {
  const t = useT();
  const {
    sidecar,
    session,
    log,
    scripts,
    currentScript,
    busy,
    init,
    startBrowser,
    stopBrowser,
    navigate,
    newTab,
    closePage,
    setActive,
    runStep,
    clearLog,
    loadScript,
    saveScript,
    deleteScript,
    mkdirScript,
    moveScripts,
    setCurrentScript,
  } = useStudioStore();

  // Windowed by default: this screen exists to watch the browser work. Someone
  // who wants it invisible is doing something else, and has to say so.
  const [showWindow, setShowWindow] = useState(true);
  // The address bar is also the step's `ctx.url`, and Run sits in the editor
  // header — so the value lives up here where both can reach it.
  const [url, setUrl] = useState('');

  useEffect(() => {
    void init();
  }, [init]);

  // The panel is a running transcript, so error lines have to be legible as
  // errors in plain text — the output prop is a string, not marked-up nodes.
  const output = useMemo(
    () => log.map((l) => (l.level === 'error' ? `! ${l.text}` : l.text)).join('\n'),
    [log],
  );

  return (
    <CodeEditor
      accent="pipeline"
      testId="page-studio-browser"
      titleKey="studio.browser.title"
      subtitleKey="studio.browser.subtitle"
      scripts={scripts}
      current={currentScript}
      output={output}
      readyLabel={t('studio.browser.session.attached')}
      notReadyLabel={t('studio.browser.session.detached')}
      ready={session.phase === 'attached'}
      busy={busy}
      defaultSeed={DEFAULT_SCRIPT}
      onLoad={loadScript}
      onSave={saveScript}
      onDelete={deleteScript}
      onMkdir={mkdirScript}
      onMove={moveScripts}
      onSelectNew={setCurrentScript}
      onRun={(source) => runStep(source, url.trim() || undefined)}
      beforeGrid={
        <BrowserBar
          sidecar={sidecar}
          session={session}
          url={url}
          onUrlChange={setUrl}
          showWindow={showWindow}
          onToggleWindow={() => setShowWindow((v) => !v)}
          onStart={() => void startBrowser(!showWindow)}
          onStop={() => void stopBrowser()}
          onNavigate={(url) => void navigate(url)}
          onNewTab={(url) => void newTab(url)}
          onClosePage={(i) => void closePage(i)}
          onSetActive={(i) => void setActive(i)}
          onClearLog={clearLog}
        />
      }
    />
  );
}
