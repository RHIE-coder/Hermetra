import { useMemo, useState } from 'react';
import { ArrowRight, Globe, Play, Smartphone, Square, Trash2, Workflow } from 'lucide-react';
import { useBridgeStore } from '../store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, relativeTime } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import type { MessageKey } from '@/lib/messages';
import type { ScenarioRunUpdate } from '@shared/types/bridge';

export function ScenariosPage() {
  const { scenarios, scenarioRuns, currentRunId, runScenario, stopScenario, deleteScenario } =
    useBridgeStore();
  const [selectedId, setSelectedId] = useState<string | null>(scenarios[0]?.id ?? null);
  const selected = scenarios.find((s) => s.id === (selectedId ?? scenarios[0]?.id));
  // Memoized because the `?? []` fallback would hand out a fresh array every
  // render, which defeats the stepStatus memo below.
  const updates = useMemo(
    () => (currentRunId ? scenarioRuns[currentRunId] ?? [] : []),
    [currentRunId, scenarioRuns],
  );
  const t = useT();

  const stepStatus = useMemo(() => {
    const map = new Map<string, ScenarioRunUpdate>();
    for (const u of updates) map.set(u.stepId, u);
    return map;
  }, [updates]);

  const running = updates.some((u) => u.status === 'running');

  const statusLabel = (s?: ScenarioRunUpdate['status']): string => {
    const key: MessageKey =
      s === 'running'
        ? 'common.running'
        : s === 'completed'
          ? 'common.completed'
          : s === 'failed'
            ? 'common.failed'
            : 'common.pending';
    return t(key);
  };

  return (
    <div data-testid="page-bridge-scenarios" className="min-h-full p-5 space-y-4">
      <header className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold tracking-tight">{t('bridge.scenarios.title')}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{t('bridge.scenarios.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {running && currentRunId ? (
            <Button variant="destructive" onClick={() => stopScenario(currentRunId)}>
              <Square className="h-4 w-4" /> {t('common.stop')}
            </Button>
          ) : (
            <Button
              disabled={!selected}
              onClick={() => selected && runScenario(selected.id)}
            >
              <Play className="h-4 w-4" /> {t('bridge.scenarios.runScenario')}
            </Button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('bridge.scenarios.all')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {scenarios.map((s) => (
              <div
                key={s.id}
                className={cn(
                  'group flex items-start gap-2 rounded-md border border-transparent pr-1 hover:bg-accent',
                  s.id === (selectedId ?? scenarios[0]?.id) && 'border-bridge/40 bg-bridge/5',
                )}
              >
                <button
                  onClick={() => setSelectedId(s.id)}
                  className="flex-1 px-3 py-2 text-left text-sm"
                >
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {t(
                      s.steps.length === 1
                        ? 'bridge.scenarios.stepCount'
                        : 'bridge.scenarios.stepCountPlural',
                      { count: s.steps.length },
                    )}
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('common.delete')}
                  className="opacity-0 group-hover:opacity-100"
                  onClick={() => {
                    if (!window.confirm(t('bridge.scenarios.deleteConfirm', { name: s.name }))) return;
                    void deleteScenario(s.id);
                    if (s.id === selectedId) setSelectedId(null);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{selected?.name ?? t('bridge.scenarios.noSelection')}</CardTitle>
            <CardDescription>{t('bridge.scenarios.stepsDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {!selected ? null : (
              <ol className="space-y-3">
                {selected.steps.map((step, i) => {
                  const u = stepStatus.get(step.id);
                  return (
                    <li
                      key={step.id}
                      className={cn(
                        'flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors',
                        u?.status === 'running' && 'border-bridge bg-bridge/5',
                        u?.status === 'completed' && 'border-success/40',
                        u?.status === 'failed' && 'border-destructive/40 bg-destructive/5',
                      )}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-medium">
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {step.platform === 'web' && <Globe className="h-3.5 w-3.5 text-web" />}
                          {step.platform === 'mobile' && <Smartphone className="h-3.5 w-3.5 text-mobile" />}
                          {step.platform === 'both' && (
                            <>
                              <Globe className="h-3.5 w-3.5 text-web" />
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              <Smartphone className="h-3.5 w-3.5 text-mobile" />
                            </>
                          )}
                          <span className="text-sm font-medium">{step.name}</span>
                          <Badge
                            variant={
                              step.platform === 'web'
                                ? 'web'
                                : step.platform === 'mobile'
                                  ? 'mobile'
                                  : 'bridge'
                            }
                          >
                            {step.platform}
                          </Badge>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground font-mono">{step.scriptPath}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                          {step.waitFor && (
                            <span className="rounded-md bg-bridge/15 text-bridge px-2 py-0.5">
                              {t('bridge.scenarios.wait', { channel: step.waitFor })}
                            </span>
                          )}
                          {step.emits && (
                            <span className="rounded-md bg-success/15 text-success px-2 py-0.5">
                              {t('bridge.scenarios.emitTag', { channel: step.emits })}
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant={
                          u?.status === 'failed'
                            ? 'danger'
                            : u?.status === 'completed'
                              ? 'success'
                              : u?.status === 'running'
                                ? 'bridge'
                                : 'outline'
                        }
                      >
                        {statusLabel(u?.status)}
                      </Badge>
                    </li>
                  );
                })}
              </ol>
            )}

            {updates.length > 0 && (
              <div className="mt-4 rounded-md border border-border bg-muted/30 p-3">
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  {t('bridge.scenarios.runLog')}
                </div>
                <ul className="space-y-1 text-xs font-mono">
                  {updates.map((u, idx) => (
                    <li key={idx}>
                      <span className="text-muted-foreground">
                        [{relativeTime(u.startedAt ?? Date.now(), t)}]
                      </span>{' '}
                      <span className="font-semibold">{u.stepId}</span>: {statusLabel(u.status)}
                      {u.message ? ` — ${u.message}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
