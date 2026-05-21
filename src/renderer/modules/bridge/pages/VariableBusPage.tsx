import { useState } from 'react';
import { Cable, Plus, Trash2 } from 'lucide-react';
import { useBridgeStore } from '../store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { relativeTime } from '@/lib/utils';
import { useT } from '@/lib/i18n';

export function VariableBusPage() {
  const { vars, setVar, removeVar, clearBus } = useBridgeStore();
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const t = useT();

  return (
    <div className="gradient-bridge min-h-full p-6 space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Cable className="h-5 w-5 text-bridge" />
            <h1 className="text-2xl font-semibold tracking-tight">{t('bridge.bus.title')}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{t('bridge.bus.subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => clearBus()} disabled={vars.length === 0}>
          <Trash2 className="h-4 w-4" /> {t('common.clear')}
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('bridge.bus.write')}</CardTitle>
          <CardDescription>{t('bridge.bus.writeDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-[1fr_2fr_auto] gap-2">
            <Input
              placeholder={t('bridge.bus.keyPlaceholder')}
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
            />
            <Input
              placeholder={t('bridge.bus.valuePlaceholder')}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
            />
            <Button
              variant="bridge"
              disabled={!newKey.trim()}
              onClick={() => {
                void setVar(newKey.trim(), newValue);
                setNewKey('');
                setNewValue('');
              }}
            >
              <Plus className="h-4 w-4" /> {t('common.set')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('bridge.bus.snapshot')}</CardTitle>
        </CardHeader>
        <CardContent>
          {vars.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
              {t('bridge.bus.empty')}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">{t('bridge.bus.colKey')}</th>
                  <th className="py-2 pr-3 font-medium">{t('bridge.bus.colValue')}</th>
                  <th className="py-2 pr-3 font-medium">{t('bridge.bus.colBy')}</th>
                  <th className="py-2 pr-3 font-medium">{t('bridge.bus.colUpdated')}</th>
                  <th className="py-2 pr-3 font-medium w-8" aria-label={t('common.delete')} />
                </tr>
              </thead>
              <tbody>
                {vars.map((v) => (
                  <tr key={v.key} className="border-t border-border">
                    <td className="py-2 pr-3 font-mono text-xs">{v.key}</td>
                    <td className="py-2 pr-3 font-mono text-xs break-all">{v.value}</td>
                    <td className="py-2 pr-3">
                      <Badge
                        variant={
                          v.updatedBy === 'web' ? 'web' : v.updatedBy === 'mobile' ? 'mobile' : 'bridge'
                        }
                      >
                        {v.updatedBy}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">
                      {relativeTime(v.updatedAt, t)}
                    </td>
                    <td className="py-2 pr-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('common.delete')}
                        onClick={() => void removeVar(v.key)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
