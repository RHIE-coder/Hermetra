import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Capability, MobileDevice, MobilePlatform } from '@shared/types/mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  initial?: Capability | null;
  devices: MobileDevice[];
  onClose: () => void;
  onSave: (cap: Capability) => Promise<void> | void;
}

const newId = () =>
  `cap-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function CapabilityDialog({ open, initial, devices, onClose, onSave }: Props) {
  const t = useT();
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState<MobilePlatform>('android');
  const [deviceId, setDeviceId] = useState('');
  const [automationName, setAutomationName] = useState('UiAutomator2');
  const [appPackage, setAppPackage] = useState('');
  const [appActivity, setAppActivity] = useState('');
  const [bundleId, setBundleId] = useState('');
  const [extraJson, setExtraJson] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setPlatform(initial?.platform ?? 'android');
    setDeviceId(initial?.deviceId ?? devices[0]?.id ?? '');
    setAutomationName(
      initial?.automationName ??
        (initial?.platform === 'ios' ? 'XCUITest' : 'UiAutomator2'),
    );
    setAppPackage(initial?.appPackage ?? '');
    setAppActivity(initial?.appActivity ?? '');
    setBundleId(initial?.bundleId ?? '');
    setExtraJson(initial?.extraJson ?? '');
  }, [open, initial, devices]);

  if (!open) return null;

  const submit = async () => {
    const cap: Capability = {
      id: initial?.id || newId(),
      name: name.trim() || 'Untitled profile',
      platform,
      deviceId: deviceId.trim(),
      automationName: automationName || undefined,
      appPackage: platform === 'android' ? appPackage || undefined : undefined,
      appActivity: platform === 'android' ? appActivity || undefined : undefined,
      bundleId: platform === 'ios' ? bundleId || undefined : undefined,
      extraJson: extraJson.trim() || undefined,
    };
    await onSave(cap);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-base font-semibold">
            {initial ? t('mobile.devices.editCapability') : t('mobile.devices.addCapability')}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <Field label={t('mobile.devices.profileName')}>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>

          <Field label={t('mobile.devices.platform')}>
            <div className="inline-flex h-9 items-center rounded-md border border-input bg-background p-0.5">
              {(['android', 'ios'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setPlatform(p);
                    setAutomationName(p === 'android' ? 'UiAutomator2' : 'XCUITest');
                  }}
                  className={cn(
                    'h-8 rounded-[5px] px-3 text-xs',
                    platform === p ? 'bg-accent font-medium' : 'text-muted-foreground',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </Field>

          <Field label={t('mobile.devices.deviceId')}>
            <div className="flex gap-2">
              <Input
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                placeholder={platform === 'android' ? 'emulator-5554' : 'UDID'}
                className="flex-1"
              />
              {devices.length > 0 && (
                <select
                  value=""
                  onChange={(e) => {
                    const d = devices.find((dev) => dev.id === e.target.value);
                    if (d) {
                      setDeviceId(d.id);
                      setPlatform(d.platform);
                    }
                  }}
                  className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="">{t('mobile.devices.connected')}</option>
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.platform})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </Field>

          <Field label={t('mobile.devices.automation')}>
            <Input value={automationName} onChange={(e) => setAutomationName(e.target.value)} />
          </Field>

          {platform === 'android' ? (
            <>
              <Field label={t('mobile.devices.appPackage')}>
                <Input value={appPackage} onChange={(e) => setAppPackage(e.target.value)} placeholder="com.example.app" />
              </Field>
              <Field label={t('mobile.devices.appActivity')}>
                <Input value={appActivity} onChange={(e) => setAppActivity(e.target.value)} placeholder=".MainActivity" />
              </Field>
            </>
          ) : (
            <Field label={t('mobile.devices.bundleId')}>
              <Input value={bundleId} onChange={(e) => setBundleId(e.target.value)} placeholder="com.example.app" />
            </Field>
          )}

          <Field label="Extra capabilities (JSON)">
            <textarea
              value={extraJson}
              onChange={(e) => setExtraJson(e.target.value)}
              placeholder='{"appium:noReset": true}'
              className="w-full rounded-md border border-input bg-muted/30 p-2 text-xs font-mono h-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="mobile" onClick={submit} disabled={!name.trim() || !deviceId.trim()}>
            {t('common.save')}
          </Button>
        </div>
      </div>
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
