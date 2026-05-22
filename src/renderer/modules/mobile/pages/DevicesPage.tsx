import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Copy,
  Play,
  Plus,
  RefreshCw,
  Smartphone,
  Square,
  Trash2,
} from 'lucide-react';
import { useMobileStore } from '../store';
import { ConnectionConfigTab } from './ConnectionConfigTab';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import type { MobileDevice, SavedDevice, ToolingStatus } from '@shared/types/mobile';
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

function liveToSaved(live: MobileDevice): SavedDevice {
  const kind: SavedDevice['kind'] =
    live.kind === 'real' ? 'real' : live.platform === 'ios' ? 'sim' : 'emu';
  return {
    id: `${live.platform}:${live.id}`,
    platform: live.platform,
    udid: live.id,
    name: live.name,
    kind,
    lastConnectedAt: new Date().toISOString(),
  };
}

function isToolingOk(tooling: ToolingStatus): boolean {
  return tooling.appium && tooling.adb && tooling.libimobiledevice;
}

export function DevicesPage() {
  const t = useT();
  const {
    tooling,
    appium,
    devices,
    savedDevices,
    selectedDeviceKey,
    installedApps,
    installedAppsLoading,
    refreshDevices,
    refreshTooling,
    refreshSavedDevices,
    refreshInstalledApps,
    saveDevice,
    removeDevice,
    updateAlias,
    selectDevice,
    startAppium,
    stopAppium,
    connectExternal,
    disconnectExternal,
  } = useMobileStore();

  const [externalUrl, setExternalUrl] = useState('http://127.0.0.1:4723');
  const [aliasDraft, setAliasDraft] = useState<string>('');
  const [detailTab, setDetailTab] = useState<'info' | 'apps'>('info');
  const [appSearch, setAppSearch] = useState('');
  const [toolingHover, setToolingHover] = useState(false);

  useEffect(() => {
    void refreshSavedDevices();
  }, [refreshSavedDevices]);

  useEffect(() => {
    const id = setInterval(() => {
      void refreshDevices();
      void refreshTooling();
    }, 5000);
    return () => clearInterval(id);
  }, [refreshDevices, refreshTooling]);

  const liveByKey = new Map<string, MobileDevice>(
    devices.map((d) => [`${d.platform}:${d.id}`, d]),
  );
  const savedByKey = new Map<string, SavedDevice>(savedDevices.map((s) => [s.id, s]));
  const selectedSaved = selectedDeviceKey ? savedByKey.get(selectedDeviceKey) ?? null : null;
  const selectedLive = selectedDeviceKey ? liveByKey.get(selectedDeviceKey) ?? null : null;
  const detailName = selectedSaved?.name ?? selectedLive?.name ?? '';
  const detailUdid = selectedSaved?.udid ?? selectedLive?.id ?? '';
  const detailPlatform = selectedSaved?.platform ?? selectedLive?.platform ?? '';
  const detailKind = selectedSaved?.kind ?? selectedLive?.kind ?? '';
  const detailLastConnected = selectedSaved?.lastConnectedAt ?? '';
  const detailIsConnected = !!(detailUdid && liveByKey.has(`${detailPlatform}:${detailUdid}`));

  useEffect(() => {
    setAliasDraft(selectedSaved?.alias ?? '');
  }, [selectedSaved?.id, selectedSaved?.alias]);

  // Reset the apps tab when switching selected device.
  useEffect(() => {
    setDetailTab('info');
    setAppSearch('');
  }, [selectedDeviceKey]);

  const handleSaveLive = async (live: MobileDevice) => {
    await saveDevice(liveToSaved(live));
  };

  const handleSaveSelected = async () => {
    if (selectedLive) await saveDevice(liveToSaved(selectedLive));
  };

  const handleAliasBlur = () => {
    if (!selectedSaved) return;
    const next = aliasDraft.trim() === '' ? null : aliasDraft;
    void updateAlias(selectedSaved.id, next);
  };

  const handleCopyUdid = async () => {
    if (!detailUdid) return;
    try {
      await navigator.clipboard.writeText(detailUdid);
    } catch {
      /* clipboard may be unavailable in test env */
    }
  };

  const handleDetailTabChange = (value: string) => {
    const next = value === 'apps' ? 'apps' : 'info';
    setDetailTab(next);
    if (next === 'apps' && selectedDeviceKey) {
      void refreshInstalledApps(selectedDeviceKey);
    }
  };

  const filteredApps = useMemo(() => {
    const q = appSearch.trim().toLowerCase();
    if (!q) return installedApps;
    return installedApps.filter((app) =>
      app.name.toLowerCase().includes(q) ||
      app.bundleId.toLowerCase().includes(q) ||
      app.version.toLowerCase().includes(q),
    );
  }, [installedApps, appSearch]);

  const toolingOk = isToolingOk(tooling);

  return (
    <div data-testid="page-mobile-devices" className="gradient-mobile min-h-full p-6 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-mobile" />
            <h1 className="text-2xl font-semibold tracking-tight">{t('mobile.devices.title')}</h1>
            <div
              className="relative"
              onMouseEnter={() => setToolingHover(true)}
              onMouseLeave={() => setToolingHover(false)}
            >
              <button
                type="button"
                data-testid="tooling-status-badge"
                data-status={toolingOk ? 'ok' : 'missing'}
                aria-label={
                  toolingOk
                    ? t('mobile.devices.tooling.statusOk')
                    : t('mobile.devices.tooling.statusMissing')
                }
                className={cn(
                  'inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-card-foreground transition-colors',
                  toolingOk ? 'text-mobile' : 'text-destructive',
                )}
              >
                {toolingOk ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <CircleAlert className="h-4 w-4" />
                )}
              </button>
              {toolingHover && (
                <div
                  data-testid="tooling-status-overlay"
                  className="absolute left-0 top-full z-50 mt-2 w-[420px] rounded-xl border border-border bg-card p-4 text-card-foreground shadow-lg space-y-3"
                >
                  <div>
                    <div className="text-sm font-semibold">{t('mobile.devices.tooling')}</div>
                    <div className="text-xs text-muted-foreground">{t('mobile.devices.toolingDesc')}</div>
                  </div>
                  <div className="space-y-2">
                    {TOOLING.map((row) => {
                      const installed = tooling[row.key];
                      return (
                        <div
                          key={row.title}
                          data-testid={`tooling-row-${row.key}`}
                          className="rounded-lg border border-border bg-background p-3 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold">{row.title}</div>
                              <div className="text-xs text-muted-foreground">{t(row.descKey)}</div>
                            </div>
                            <Badge variant={installed ? 'success' : 'danger'} className="gap-1">
                              {installed ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : (
                                <CircleAlert className="h-3 w-3" />
                              )}
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
                    <div className="text-[11px] text-muted-foreground">Appium {tooling.appiumVersion}</div>
                  )}

                  <div className="border-t border-border pt-3 space-y-2">
                    <div>
                      <div className="text-sm font-semibold">{t('mobile.devices.server')}</div>
                      <div className="text-xs text-muted-foreground">{t('mobile.devices.serverDesc')}</div>
                    </div>
                    <div className="flex items-center justify-between">
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
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={appium.isRunning && appium.mode === 'local' ? 'destructive' : 'mobile'}
                        size="sm"
                        onClick={() =>
                          appium.isRunning && appium.mode === 'local' ? stopAppium() : startAppium()
                        }
                        disabled={!tooling.appium}
                      >
                        {appium.isRunning && appium.mode === 'local' ? (
                          <Square className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                        {appium.isRunning && appium.mode === 'local'
                          ? t('common.stop')
                          : `${t('common.start')} ${t('mobile.devices.appium')}`}
                      </Button>
                      <div className="flex gap-2 flex-1 min-w-[240px]">
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
                  </div>
                </div>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">{t('mobile.devices.subtitle')}</p>
        </div>
      </header>

      <Tabs defaultValue="management" className="space-y-6">
        <TabsList>
          <TabsTrigger value="management" data-testid="devices-tab-management">
            {t('mobile.devices.tab.management')}
          </TabsTrigger>
          <TabsTrigger value="connection" data-testid="devices-tab-connection">
            {t('mobile.devices.tab.connection')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="management" className="space-y-6">
          {/* Two-column: Live + My Devices on the left, Detail panel on the right. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{t('mobile.devices.liveConnections')}</CardTitle>
                      <CardDescription>{t('mobile.devices.saveHint')}</CardDescription>
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
                    <ul className="space-y-2">
                      {devices.map((d) => {
                        const key = `${d.platform}:${d.id}`;
                        const isSaved = savedByKey.has(key);
                        return (
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
                            {isSaved ? (
                              <Badge variant="success">{t('common.installed')}</Badge>
                            ) : (
                              <Button
                                variant="mobile"
                                size="sm"
                                data-testid={`device-save-btn-${d.id}`}
                                onClick={() => void handleSaveLive(d)}
                              >
                                <Plus className="h-4 w-4" /> {t('mobile.devices.saveToMy')}
                              </Button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('mobile.devices.myDevices')}</CardTitle>
                  <CardDescription>{t('mobile.devices.saveHint')}</CardDescription>
                </CardHeader>
                <CardContent>
                  {savedDevices.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                      {t('mobile.devices.noDevices')}
                    </div>
                  ) : (
                    <ul data-testid="my-devices-list" className="space-y-2">
                      {savedDevices.map((s) => {
                        const isLive = liveByKey.has(s.id);
                        const isSelected = selectedDeviceKey === s.id;
                        return (
                          <li
                            key={s.id}
                            data-testid={`my-device-item-${s.id}`}
                            onClick={() => selectDevice(s.id)}
                            className={cn(
                              'flex cursor-pointer items-center gap-3 rounded-md border border-border bg-card px-3 py-2 transition-colors hover:bg-accent/30',
                              isSelected && 'border-mobile/40 bg-mobile/5',
                            )}
                          >
                            <div className="grid h-9 w-9 place-items-center rounded-md bg-mobile/10 text-mobile">
                              <Smartphone className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">
                                {s.alias || s.name}
                                {s.kind && <span className="text-muted-foreground"> · {s.kind}</span>}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono truncate">
                                {s.udid} · {s.platform}
                              </div>
                            </div>
                            <Badge
                              variant={isLive ? 'success' : 'outline'}
                              data-testid={`my-device-status-${s.id}`}
                              data-status={isLive ? 'connected' : 'disconnected'}
                            >
                              {isLive ? t('common.online') : t('common.offline')}
                            </Badge>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            {selectedDeviceKey && (selectedSaved || selectedLive) ? (
              <section
                data-testid="device-detail-panel"
                className="rounded-xl border border-border bg-card text-card-foreground shadow-sm"
              >
                <div className="p-5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold leading-tight tracking-tight">
                      {t('mobile.devices.detail')}
                    </h3>
                    <Badge variant={detailIsConnected ? 'success' : 'outline'}>
                      {detailIsConnected ? t('common.online') : t('common.offline')}
                    </Badge>
                  </div>
                  <Tabs value={detailTab} onValueChange={handleDetailTabChange} className="pt-2">
                    <TabsList>
                      <TabsTrigger value="info" data-testid="device-detail-tab-info">
                        {t('mobile.devices.info')}
                      </TabsTrigger>
                      <TabsTrigger value="apps" data-testid="device-detail-tab-apps">
                        {t('mobile.devices.apps')}
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="info" className="space-y-4">
                      <div className="space-y-3 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">{t('mobile.devices.profileName')}</div>
                          <div data-testid="device-detail-name" className="font-medium">
                            {detailName}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">UDID</div>
                          <div className="flex items-center gap-2">
                            <code
                              data-testid="device-detail-udid"
                              className="rounded-md bg-muted/60 px-2 py-1 text-[11px] font-mono"
                            >
                              {detailUdid}
                            </code>
                            <Button variant="ghost" size="icon" onClick={() => void handleCopyUdid()}>
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-xs text-muted-foreground">{t('mobile.devices.platform')}</div>
                            <div className="font-medium">{detailPlatform || '—'}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Type</div>
                            <div className="font-medium">{detailKind || '—'}</div>
                          </div>
                        </div>
                        {detailLastConnected && (
                          <div>
                            <div className="text-xs text-muted-foreground">{t('mobile.devices.lastConnected')}</div>
                            <div className="font-mono text-xs">{detailLastConnected}</div>
                          </div>
                        )}
                      </div>

                      {selectedSaved ? (
                        <div className="space-y-2 border-t border-border pt-4">
                          <label className="text-xs text-muted-foreground" htmlFor="device-detail-alias">
                            {t('mobile.devices.alias')}
                          </label>
                          <Input
                            id="device-detail-alias"
                            data-testid="device-detail-alias-input"
                            placeholder={t('mobile.devices.aliasPlaceholder')}
                            value={aliasDraft}
                            onChange={(e) => setAliasDraft(e.target.value)}
                            onBlur={handleAliasBlur}
                          />
                          <Button
                            variant="destructive"
                            size="sm"
                            data-testid="device-detail-remove-btn"
                            onClick={() => void removeDevice(selectedSaved.id)}
                          >
                            <Trash2 className="h-4 w-4" /> {t('mobile.devices.removeFromMy')}
                          </Button>
                        </div>
                      ) : (
                        <div className="border-t border-border pt-4">
                          <Button
                            variant="mobile"
                            size="sm"
                            data-testid="device-detail-save-btn"
                            onClick={() => void handleSaveSelected()}
                          >
                            <Plus className="h-4 w-4" /> {t('mobile.devices.saveToMy')}
                          </Button>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="apps" className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold">
                          {t('mobile.devices.apps.installed')} ({filteredApps.length}/{installedApps.length})
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid="device-apps-refresh"
                          onClick={() =>
                            selectedDeviceKey && void refreshInstalledApps(selectedDeviceKey)
                          }
                        >
                          <RefreshCw className="h-4 w-4" /> {t('mobile.devices.apps.refresh')}
                        </Button>
                      </div>
                      <Input
                        data-testid="device-apps-search"
                        placeholder={t('mobile.devices.apps.search')}
                        value={appSearch}
                        onChange={(e) => setAppSearch(e.target.value)}
                      />
                      {installedAppsLoading ? (
                        <div className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                          {t('mobile.devices.apps.loading')}
                        </div>
                      ) : filteredApps.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                          {t('mobile.devices.apps.empty')}
                        </div>
                      ) : (
                        <ul data-testid="device-apps-list" className="space-y-2">
                          {filteredApps.map((app) => (
                            <li
                              key={app.bundleId}
                              data-testid={`device-apps-row-${app.bundleId}`}
                              className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium">{app.name}</div>
                                <div className="text-xs text-muted-foreground font-mono truncate">
                                  {app.bundleId}
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground font-mono">{app.version}</div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              </section>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                {t('mobile.devices.detail')}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="connection">
          <ConnectionConfigTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
