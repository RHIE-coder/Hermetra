import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useMobileStore } from '../store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import type { Connection, MobilePlatform } from '@shared/types/mobile';

interface KvRow {
  key: string;
  value: string;
}

function extraToRows(extra: Record<string, string>): KvRow[] {
  return Object.entries(extra).map(([key, value]) => ({ key, value }));
}

function rowsToExtra(rows: KvRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (!key) continue;
    out[key] = row.value;
  }
  return out;
}

function newConnectionId(): string {
  return `conn-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function ConnectionConfigTab() {
  const t = useT();
  const {
    savedDevices,
    connections,
    activeConnectionId,
    appleIdentities,
    installedApps,
    appium,
    lastTest,
    refreshConnections,
    saveConnection,
    setConnectionInUse,
    testConnection,
    listAppleCerts,
    refreshInstalledApps,
  } = useMobileStore();

  const [selectedConnId, setSelectedConnId] = useState<string | null>(null);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newDeviceId, setNewDeviceId] = useState<string>('');

  // Edit form state — synced when the selected connection changes.
  const [editName, setEditName] = useState('');
  const [editBundleId, setEditBundleId] = useState('');
  const [editAppSearch, setEditAppSearch] = useState('');
  const [editXcodeOrgId, setEditXcodeOrgId] = useState('');
  const [editXcodeSigningId, setEditXcodeSigningId] = useState('');
  const [editKvRows, setEditKvRows] = useState<KvRow[]>([]);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    void refreshConnections();
  }, [refreshConnections]);

  useEffect(() => {
    void listAppleCerts();
  }, [listAppleCerts]);

  const selectedConn = useMemo(
    () => connections.find((c) => c.id === selectedConnId) ?? null,
    [connections, selectedConnId],
  );

  // Sync the form when the user picks a different connection.
  useEffect(() => {
    if (!selectedConn) {
      setEditName('');
      setEditBundleId('');
      setEditXcodeOrgId('');
      setEditXcodeSigningId('');
      setEditKvRows([]);
      return;
    }
    setEditName(selectedConn.name);
    setEditBundleId(selectedConn.bundleId ?? '');
    setEditXcodeOrgId(selectedConn.xcodeOrgId ?? '');
    setEditXcodeSigningId(selectedConn.xcodeSigningId ?? '');
    setEditKvRows(extraToRows(selectedConn.extra));
  }, [selectedConn]);

  const connectionsByDevice = useMemo(() => {
    const map = new Map<string, Connection[]>();
    for (const c of connections) {
      const list = map.get(c.deviceId) ?? [];
      list.push(c);
      map.set(c.deviceId, list);
    }
    return map;
  }, [connections]);

  const activeConn = useMemo(
    () => connections.find((c) => c.id === activeConnectionId) ?? null,
    [connections, activeConnectionId],
  );

  const handleSelectConn = (id: string) => {
    setSelectedConnId(id);
    const conn = connections.find((c) => c.id === id);
    if (conn) void refreshInstalledApps(conn.deviceId);
  };

  const handleOpenNew = () => {
    setNewDeviceId(savedDevices[0]?.id ?? '');
    setNewDialogOpen(true);
  };

  const handleCreateNew = async () => {
    const device = savedDevices.find((d) => d.id === newDeviceId);
    if (!device) {
      setNewDialogOpen(false);
      return;
    }
    const next: Connection = {
      id: newConnectionId(),
      name: 'New Config',
      deviceId: device.id,
      platform: device.platform,
      extra: {},
    };
    await saveConnection(next);
    setNewDialogOpen(false);
    setSelectedConnId(next.id);
    void refreshInstalledApps(next.deviceId);
  };

  const handleSave = async () => {
    if (!selectedConn) return;
    const next: Connection = {
      ...selectedConn,
      name: editName.trim() || selectedConn.name,
      bundleId: editBundleId || undefined,
      xcodeOrgId: editXcodeOrgId || undefined,
      xcodeSigningId: editXcodeSigningId || undefined,
      extra: rowsToExtra(editKvRows),
    };
    await saveConnection(next);
  };

  const handleTest = async () => {
    if (!selectedConn) return;
    setTesting(true);
    try {
      await testConnection(selectedConn.id);
    } finally {
      setTesting(false);
    }
  };

  const handleUse = async () => {
    if (!selectedConn) return;
    await setConnectionInUse(selectedConn.id);
  };

  const handleKvAdd = () => {
    setEditKvRows((prev) => [...prev, { key: '', value: '' }]);
  };

  const handleKvRemove = (index: number) => {
    setEditKvRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleKvKey = (index: number, value: string) => {
    setEditKvRows((prev) => prev.map((row, i) => (i === index ? { ...row, key: value } : row)));
  };

  const handleKvValue = (index: number, value: string) => {
    setEditKvRows((prev) => prev.map((row, i) => (i === index ? { ...row, value } : row)));
  };

  const filteredInstalledApps = useMemo(() => {
    const q = editAppSearch.trim().toLowerCase();
    if (!q) return installedApps;
    return installedApps.filter((app) =>
      app.name.toLowerCase().includes(q) ||
      app.bundleId.toLowerCase().includes(q),
    );
  }, [installedApps, editAppSearch]);

  const selectedDevice = selectedConn
    ? savedDevices.find((d) => d.id === selectedConn.deviceId) ?? null
    : null;
  const selectedPlatform: MobilePlatform | '' = selectedConn?.platform ?? '';
  const isIos = selectedPlatform === 'ios';

  return (
    <div
      data-testid="conn-config-tab-content"
      className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4"
    >
      {/* Left panel: in-use + device tree */}
      <aside className="rounded-xl border border-border bg-card text-card-foreground p-4 space-y-4">
        <header className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{t('mobile.conn.title')}</h3>
          <Button
            variant="mobile"
            size="sm"
            data-testid="conn-config-new-btn"
            onClick={handleOpenNew}
          >
            <Plus className="h-3.5 w-3.5" /> {t('mobile.conn.new')}
          </Button>
        </header>

        <section
          data-testid="conn-config-in-use-section"
          className="rounded-md border border-border bg-background p-3 space-y-1"
        >
          <div className="text-xs font-medium text-muted-foreground">{t('mobile.conn.inUse')}</div>
          {activeConn ? (
            <div
              data-testid="conn-config-in-use-item"
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="truncate font-medium">{activeConn.name}</span>
              <Badge variant="mobile">{t('mobile.conn.inUse')}</Badge>
            </div>
          ) : (
            <div
              data-testid="conn-config-in-use-empty"
              className="text-xs text-muted-foreground"
            >
              {t('mobile.conn.inUseEmpty')}
            </div>
          )}
        </section>

        <div data-testid="conn-config-device-tree" className="space-y-2">
          {savedDevices.map((device) => {
            const deviceConns = connectionsByDevice.get(device.id) ?? [];
            return (
              <div
                key={device.id}
                data-testid={`conn-config-device-row-${device.id}`}
                className="rounded-md border border-border bg-background p-2 space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-sm font-medium">{device.alias || device.name}</div>
                  <Badge variant="outline" className="text-[10px]">
                    {deviceConns.length}
                  </Badge>
                </div>
                {deviceConns.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground italic px-1 py-0.5">
                    {t('mobile.conn.deviceEmpty')}
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {deviceConns.map((c) => {
                      const isSelected = c.id === selectedConnId;
                      const isActive = c.id === activeConnectionId;
                      return (
                        <li
                          key={c.id}
                          data-testid={`conn-config-row-${c.id}`}
                          onClick={() => handleSelectConn(c.id)}
                          className={cn(
                            'flex cursor-pointer items-center justify-between gap-2 rounded-sm px-2 py-1 text-xs transition-colors',
                            isSelected ? 'bg-mobile/10 text-mobile' : 'hover:bg-accent/30',
                          )}
                        >
                          <span className="truncate">{c.name}</span>
                          {isActive && (
                            <Badge variant="mobile" className="text-[10px]">
                              {t('mobile.conn.inUse')}
                            </Badge>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* Right edit panel */}
      {selectedConn ? (
        <section
          data-testid="conn-edit-panel"
          className="rounded-xl border border-border bg-card text-card-foreground p-5 space-y-4"
        >
          <header className="flex items-center justify-between">
            <h3 className="text-base font-semibold">{t('mobile.conn.edit.title')}</h3>
          </header>

          <div className="space-y-3">
            <Field label={t('mobile.conn.name')}>
              <Input
                data-testid="conn-edit-name-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t('mobile.conn.device')}>
                <div
                  data-testid="conn-edit-device-readonly"
                  className="h-9 rounded-md border border-input bg-muted/40 px-3 py-2 text-xs flex items-center"
                >
                  {selectedDevice?.name ?? selectedConn.deviceId}
                </div>
              </Field>
              <Field label={t('mobile.conn.platform')}>
                <div
                  data-testid="conn-edit-platform-readonly"
                  className="h-9 rounded-md border border-input bg-muted/40 px-3 py-2 text-xs flex items-center uppercase"
                >
                  {selectedPlatform}
                </div>
              </Field>
            </div>

            <Field label={t('mobile.conn.appOptional')}>
              <Input
                data-testid="conn-edit-app-search"
                value={editAppSearch}
                onChange={(e) => setEditAppSearch(e.target.value)}
                placeholder={t('mobile.devices.apps.search')}
              />
              <select
                data-testid="conn-edit-app-select"
                value={editBundleId}
                onChange={(e) => setEditBundleId(e.target.value)}
                className="mt-2 h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
              >
                <option value="">{t('mobile.conn.appNone')}</option>
                {filteredInstalledApps.map((app) => (
                  <option key={app.bundleId} value={app.bundleId}>
                    {app.name} ({app.bundleId})
                  </option>
                ))}
              </select>
            </Field>

            {isIos && (
              <div className="rounded-md border border-border bg-background p-3 space-y-3">
                <div className="text-xs font-medium text-muted-foreground">
                  {t('mobile.conn.iosCert')}
                </div>
                <Field label={t('mobile.conn.xcodeOrgId')}>
                  <Input
                    data-testid="conn-edit-xcode-org-id"
                    value={editXcodeOrgId}
                    onChange={(e) => setEditXcodeOrgId(e.target.value)}
                    placeholder="ABCD1234EF"
                  />
                </Field>
                <Field label={t('mobile.conn.xcodeSigningId')}>
                  <select
                    data-testid="conn-edit-xcode-signing-id"
                    value={editXcodeSigningId}
                    onChange={(e) => setEditXcodeSigningId(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                  >
                    <option value="">{t('mobile.conn.selectPrompt')}</option>
                    {appleIdentities.map((id) => (
                      <option key={id.hash} value={id.hash}>
                        {id.fullLine}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-muted-foreground">
                  {t('mobile.conn.extra')}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="conn-edit-kv-add"
                  onClick={handleKvAdd}
                >
                  {t('mobile.conn.add')}
                </Button>
              </div>
              {editKvRows.length === 0 ? (
                <div className="rounded-md border border-dashed border-border py-3 text-center text-[11px] text-muted-foreground">
                  {t('mobile.conn.extraEmpty')}
                </div>
              ) : (
                <ul className="space-y-2">
                  {editKvRows.map((row, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <Input
                        data-testid={`conn-edit-kv-key-${i}`}
                        value={row.key}
                        onChange={(e) => handleKvKey(i, e.target.value)}
                        placeholder="key"
                      />
                      <Input
                        data-testid={`conn-edit-kv-value-${i}`}
                        value={row.value}
                        onChange={(e) => handleKvValue(i, e.target.value)}
                        placeholder="value"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        data-testid={`conn-edit-kv-remove-${i}`}
                        onClick={() => handleKvRemove(i)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <Button
              variant="mobile"
              size="sm"
              data-testid="conn-edit-save-btn"
              onClick={() => void handleSave()}
            >
              {t('common.save')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              data-testid="conn-edit-test-btn"
              onClick={() => void handleTest()}
              disabled={testing}
            >
              {t('mobile.conn.test')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              data-testid="conn-edit-use-btn"
              onClick={() => void handleUse()}
            >
              {t('mobile.conn.use')}
            </Button>
          </div>

          {lastTest && (
            <div
              data-testid="conn-edit-test-result"
              className={cn(
                'rounded-md border px-3 py-2 text-xs',
                lastTest.ok
                  ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-500'
                  : 'border-destructive/40 bg-destructive/5 text-destructive',
              )}
            >
              {lastTest.message} ({lastTest.durationMs}ms)
            </div>
          )}

          <div
            data-testid="conn-edit-appium-url"
            className="text-[11px] text-muted-foreground font-mono"
          >
            {t('mobile.conn.appiumUrl')}
            {appium.url || 'http://localhost:4723'}
          </div>
        </section>
      ) : null}

      {newDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div
            data-testid="conn-new-dialog"
            className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl"
          >
            <div className="border-b border-border px-5 py-3">
              <h3 className="text-base font-semibold">{t('mobile.conn.new')}</h3>
            </div>
            <div className="space-y-3 p-5">
              <Field label={t('mobile.conn.selectDevice')}>
                <select
                  data-testid="conn-new-device-select"
                  value={newDeviceId}
                  onChange={(e) => setNewDeviceId(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                >
                  {savedDevices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.platform})
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              <Button
                variant="ghost"
                size="sm"
                data-testid="conn-new-cancel-btn"
                onClick={() => setNewDialogOpen(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="mobile"
                size="sm"
                data-testid="conn-new-create-btn"
                onClick={() => void handleCreateNew()}
                disabled={!newDeviceId}
              >
                {t('common.add')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
