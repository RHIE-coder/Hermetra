import { useEffect, useState } from 'react';
import { Eye, EyeOff, Lock, Plus, Sliders, Trash2 } from 'lucide-react';
import { useVariablesStore } from '@/modules/shared/variablesStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';

export function VariablesPage() {
  const {
    doc,
    selectedProfileId,
    init,
    selectProfile,
    addProfile,
    removeProfile,
    setSharedValue,
    addShared,
    removeShared,
    setPrivateValue,
    addPrivate,
    removePrivate,
  } = useVariablesStore();
  const t = useT();

  const [newSharedKey, setNewSharedKey] = useState('');
  const [newSharedValue, setNewSharedValue] = useState('');
  const [newPrivKey, setNewPrivKey] = useState('');
  const [newPrivValue, setNewPrivValue] = useState('');
  const [newProfileName, setNewProfileName] = useState('');
  const [showPrivate, setShowPrivate] = useState(false);

  useEffect(() => {
    if (!doc) void init();
  }, [doc, init]);

  if (!doc || !selectedProfileId) {
    return <div className="p-6 text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  const shared = doc.sharedVariables[selectedProfileId] || [];
  const priv = doc.privateVariables[selectedProfileId] || [];

  return (
    <div className="gradient-bridge min-h-full p-6 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-bridge" />
            <h1 className="text-2xl font-semibold tracking-tight">{t('vars.title')}</h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">{t('vars.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{t('vars.countShared', { count: shared.length })}</Badge>
          <Badge variant="outline">{t('vars.countPrivate', { count: priv.length })}</Badge>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('vars.profiles')}</CardTitle>
          <CardDescription>{t('vars.profilesDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {doc.profiles.map((p) => (
              <div
                key={p.id}
                className={cn(
                  'group inline-flex items-center gap-1 rounded-md border px-1 py-0.5',
                  p.id === selectedProfileId ? 'border-bridge/60 bg-bridge/10' : 'border-border',
                )}
              >
                <button
                  onClick={() => selectProfile(p.id)}
                  className="px-2 py-1 text-sm font-medium"
                >
                  {p.name}
                </button>
                {doc.profiles.length > 1 && (
                  <button
                    onClick={() => removeProfile(p.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    aria-label={t('common.delete')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 max-w-md">
            <Input
              placeholder={t('vars.profileName')}
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newProfileName.trim()) {
                  addProfile(newProfileName);
                  setNewProfileName('');
                }
              }}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={!newProfileName.trim()}
              onClick={() => {
                addProfile(newProfileName);
                setNewProfileName('');
              }}
            >
              <Plus className="h-4 w-4" /> {t('vars.addProfile')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('vars.shared')}</CardTitle>
          <CardDescription>{t('vars.sharedDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {shared.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
              {t('vars.empty')}
            </div>
          ) : (
            shared.map((v) => (
              <div key={v.key} className="flex items-center gap-2">
                <code className="w-48 truncate rounded-md bg-muted px-2.5 py-1.5 text-xs font-mono">
                  {v.key}
                </code>
                <Input
                  value={v.value ?? ''}
                  onChange={(e) => setSharedValue(v.key, e.target.value)}
                  className="flex-1"
                />
                <Button variant="ghost" size="icon" onClick={() => removeShared(v.key)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}

          <div className="grid grid-cols-[1fr_2fr_auto] gap-2 pt-2">
            <Input
              placeholder={t('vars.keyPlaceholder')}
              value={newSharedKey}
              onChange={(e) => setNewSharedKey(e.target.value)}
            />
            <Input
              placeholder={t('vars.valuePlaceholder')}
              value={newSharedValue}
              onChange={(e) => setNewSharedValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newSharedKey.trim()) {
                  addShared(newSharedKey, newSharedValue);
                  setNewSharedKey('');
                  setNewSharedValue('');
                }
              }}
            />
            <Button
              variant="outline"
              disabled={!newSharedKey.trim()}
              onClick={() => {
                addShared(newSharedKey, newSharedValue);
                setNewSharedKey('');
                setNewSharedValue('');
              }}
            >
              <Plus className="h-4 w-4" /> {t('common.add')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lock className="h-4 w-4 text-amber-500" /> {t('vars.private')}
              </CardTitle>
              <CardDescription>{t('vars.privateDesc')}</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowPrivate((v) => !v)}>
              {showPrivate ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showPrivate ? t('common.copied') : t('common.copy')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {priv.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
              {t('vars.empty')}
            </div>
          ) : (
            priv.map((v) => (
              <div key={v.key} className="flex items-center gap-2">
                <code className="w-48 truncate rounded-md bg-muted px-2.5 py-1.5 text-xs font-mono">
                  {v.key}
                </code>
                <Input
                  type={showPrivate ? 'text' : 'password'}
                  value={v.value ?? ''}
                  placeholder={t('vars.privateHidden')}
                  onChange={(e) => setPrivateValue(v.key, e.target.value)}
                  className="flex-1 font-mono"
                />
                <Button variant="ghost" size="icon" onClick={() => removePrivate(v.key)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}

          <div className="grid grid-cols-[1fr_2fr_auto] gap-2 pt-2">
            <Input
              placeholder={t('vars.keyPlaceholder')}
              value={newPrivKey}
              onChange={(e) => setNewPrivKey(e.target.value)}
            />
            <Input
              type={showPrivate ? 'text' : 'password'}
              placeholder={t('vars.valuePlaceholder')}
              value={newPrivValue}
              onChange={(e) => setNewPrivValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newPrivKey.trim()) {
                  addPrivate(newPrivKey, newPrivValue);
                  setNewPrivKey('');
                  setNewPrivValue('');
                }
              }}
            />
            <Button
              variant="outline"
              disabled={!newPrivKey.trim()}
              onClick={() => {
                addPrivate(newPrivKey, newPrivValue);
                setNewPrivKey('');
                setNewPrivValue('');
              }}
            >
              <Plus className="h-4 w-4" /> {t('common.add')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
