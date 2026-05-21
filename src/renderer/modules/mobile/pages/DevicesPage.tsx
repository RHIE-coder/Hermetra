import { useEffect, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  CircleAlert,
  Edit2,
  Play,
  Plus,
  RefreshCw,
  Smartphone,
  Square,
  Trash2,
  Video,
  VideoOff,
} from 'lucide-react';
import { useMobileStore } from '../store';
import { CapabilityDialog } from '../components/CapabilityDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import type { Capability } from '@shared/types/mobile';
import type { MessageKey } from '@/lib/messages';

interface ToolingRow {
  key: 'appium' | 'adb' | 'libimobiledevice';
  title: string;
  descKey: MessageKey;
  install: string;
}

const TOOLING: ToolingRow[] = [
  { key: 'appium', title: 'Appium', descKey: 'mobile.devices.appiumDesc', install: 'npm i -g appium' },
  { key: 'adb', title: 'ADB', descKey: 'mobile.devices.adbDesc', install: 'brew install android-platform-tools' },
  { key: 'libimobiledevice', title: 'libimobiledevice', descKey: 'mobile.devices.libimobiledeviceDesc', install: 'brew install libimobiledevice' },
];

export function DevicesPage() {
  const t = useT();
  const {
    tooling,
    appium,
    devices,
    capabilities,
    activeCapabilityId,
    session,
    lastScreenshot,
    lastTest,
    refreshDevices,
    refreshTooling,
    startAppium,
    stopAppium,
    connectExternal,
    disconnectExternal,
    setActiveCapability,
    saveCapability,
    removeCapability,
    testCapability,
    startSession,
    stopSession,
    screenshot,
    startRecording,
    stopRecording,
  } = useMobileStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Capability | null>(null);
  const [externalUrl, setExternalUrl] = useState('http://127.0.0.1:4723');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [recordingResult, setRecordingResult] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      void refreshDevices();
      void refreshTooling();
    }, 5000);
    return () => clearInterval(id);
  }, [refreshDevices, refreshTooling]);

  return (
    <div className="gradient-mobile min-h-full p-6 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-mobile" />
            <h1 className="text-2xl font-semibold tracking-tight">{t('mobile.devices.title')}</h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">{t('mobile.devices.subtitle')}</p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('mobile.devices.tooling')}</CardTitle>
          <CardDescription>{t('mobile.devices.toolingDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {TOOLING.map((row) => {
              const installed = tooling[row.key];
              return (
                <div
                  key={row.title}
                  className="rounded-lg border border-border bg-card/50 p-3 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-semibold">{row.title}</div>
                      <div className="text-xs text-muted-foreground">{t(row.descKey)}</div>
                    </div>
                    <Badge variant={installed ? 'success' : 'danger'} className="gap-1">
                      {installed ? <CheckCircle2 className="h-3 w-3" /> : <CircleAlert className="h-3 w-3" />}
                      {installed ? t('common.installed') : t('common.missing')}
                    </Badge>
                  </div>
                  {!installed && (
                    <code className="block rounded-md bg-muted/60 px-2 py-1 text-[11px] font-mono">
                      {row.install}
                    </code>
                  )}
                </div>
              );
            })}
          </div>
          {tooling.appiumVersion && (
            <div className="mt-3 text-[11px] text-muted-foreground">
              Appium {tooling.appiumVersion}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base">{t('mobile.devices.server')}</CardTitle>
              <CardDescription>{t('mobile.devices.serverDesc')}</CardDescription>
            </div>
            <Badge variant={appium.isRunning ? 'mobile' : 'outline'}>
              <span
                className={cn(
                  'mr-1.5 inline-block h-1.5 w-1.5 rounded-full',
                  appium.isRunning ? 'bg-mobile animate-pulse' : 'bg-muted-foreground',
                )}
              />
              {appium.isRunning
                ? `${t('common.running')} · ${appium.mode === 'external' ? 'external' : 'local'}`
                : t('common.stopped')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={appium.isRunning && appium.mode === 'local' ? 'destructive' : 'mobile'}
              size="sm"
              onClick={() =>
                appium.isRunning && appium.mode === 'local' ? stopAppium() : startAppium()
              }
              disabled={!tooling.appium}
            >
              {appium.isRunning && appium.mode === 'local' ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {appium.isRunning && appium.mode === 'local'
                ? t('common.stop')
                : `${t('common.start')} ${t('mobile.devices.appium')}`}
            </Button>
            <div className="flex gap-2 flex-1 min-w-[280px]">
              <Input
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="http://127.0.0.1:4723"
              />
              {appium.mode === 'external' ? (
                <Button variant="outline" size="sm" onClick={() => disconnectExternal()}>
                  {t('mobile.devices.disconnectExternal')}
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => connectExternal(externalUrl)}>
                  {t('mobile.devices.connectExternal')}
                </Button>
              )}
            </div>
          </div>
          {appium.url && (
            <div className="text-[11px] text-muted-foreground font-mono">{appium.url}</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{t('mobile.devices.connected')}</CardTitle>
              <CardDescription>{t('mobile.devices.connectedDesc')}</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => void refreshDevices()}>
              <RefreshCw className="h-4 w-4" /> {t('common.refresh')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
              {t('mobile.devices.noDevices')}
            </div>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {devices.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
                >
                  <div className="grid h-9 w-9 place-items-center rounded-md bg-mobile/10 text-mobile">
                    <Smartphone className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {d.name}
                      {d.kind && <span className="text-muted-foreground"> · {d.kind}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      {d.id} · {d.platform}
                    </div>
                  </div>
                  <Badge variant={d.status === 'connected' ? 'success' : 'outline'}>
                    {d.status === 'connected' ? t('common.online') : t('common.offline')}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{t('mobile.devices.capabilities')}</CardTitle>
              <CardDescription>{t('mobile.devices.capabilitiesDesc')}</CardDescription>
            </div>
            <Button
              variant="mobile"
              size="sm"
              onClick={() => {
                setEditTarget(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> {t('mobile.devices.addCapability')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {capabilities.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
              {t('mobile.devices.noCapabilities')}
            </div>
          ) : (
            <ul className="space-y-2">
              {capabilities.map((c) => (
                <li
                  key={c.id}
                  className={cn(
                    'flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2 transition-colors',
                    c.id === activeCapabilityId && 'border-mobile/40 bg-mobile/5',
                  )}
                >
                  <button
                    onClick={() => setActiveCapability(c.id)}
                    className={cn(
                      'h-3.5 w-3.5 rounded-full border-2',
                      c.id === activeCapabilityId ? 'border-mobile bg-mobile' : 'border-border',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {c.platform === 'android' ? c.appPackage || '—' : c.bundleId || '—'} · {c.deviceId}
                    </div>
                  </div>
                  <Badge variant={c.platform === 'android' ? 'mobile' : 'web'}>{c.platform}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!appium.isRunning || testingId === c.id}
                    onClick={async () => {
                      setTestingId(c.id);
                      try {
                        await testCapability(c.id);
                      } finally {
                        setTestingId(null);
                      }
                    }}
                  >
                    {testingId === c.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
                    {t('common.test')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditTarget(c);
                      setDialogOpen(true);
                    }}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => removeCapability(c.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {lastTest && (
            <div
              className={cn(
                'mt-3 rounded-md border px-3 py-2 text-xs',
                lastTest.ok
                  ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-500'
                  : 'border-destructive/40 bg-destructive/5 text-destructive',
              )}
            >
              [{lastTest.durationMs}ms] {lastTest.message}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{t('mobile.devices.session')}</CardTitle>
              <CardDescription>{t('mobile.devices.sessionDesc')}</CardDescription>
            </div>
            <Badge variant={session.active ? 'mobile' : 'outline'}>
              {session.active ? t('common.running') : t('common.idle')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {!session.active ? (
              <Button
                variant="mobile"
                size="sm"
                disabled={!activeCapabilityId || !appium.isRunning}
                onClick={() => activeCapabilityId && startSession(activeCapabilityId)}
              >
                <Play className="h-4 w-4" /> {t('mobile.devices.startSession')}
              </Button>
            ) : (
              <Button variant="destructive" size="sm" onClick={() => stopSession()}>
                <Square className="h-4 w-4" /> {t('mobile.devices.stopSession')}
              </Button>
            )}
            <Button variant="outline" size="sm" disabled={!session.active} onClick={() => screenshot()}>
              <Camera className="h-4 w-4" /> {t('mobile.devices.screenshot')}
            </Button>
            {!session.recording ? (
              <Button
                variant="outline"
                size="sm"
                disabled={!session.active}
                onClick={() => startRecording()}
              >
                <Video className="h-4 w-4" /> {t('mobile.devices.startRecord')}
              </Button>
            ) : (
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  const r = await stopRecording();
                  if (r) setRecordingResult(r.dataUrl);
                }}
              >
                <VideoOff className="h-4 w-4" /> {t('mobile.devices.stopRecord')}
              </Button>
            )}
          </div>

          {!session.active && (
            <div className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
              {t('mobile.devices.noSession')}
            </div>
          )}

          {lastScreenshot && (
            <div className="rounded-md border border-border bg-muted/30 p-2">
              <img
                src={lastScreenshot}
                alt="device screenshot"
                className="max-h-[480px] mx-auto rounded"
              />
            </div>
          )}

          {recordingResult && (
            <video
              src={recordingResult}
              controls
              className="w-full max-h-[480px] rounded-md border border-border"
            />
          )}
        </CardContent>
      </Card>

      <CapabilityDialog
        open={dialogOpen}
        initial={editTarget}
        devices={devices}
        onClose={() => setDialogOpen(false)}
        onSave={saveCapability}
      />
    </div>
  );
}
