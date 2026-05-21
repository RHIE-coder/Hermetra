import { useState } from 'react';
import { Activity, Send, Trash2 } from 'lucide-react';
import { useBridgeStore } from '../store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { relativeTime } from '@/lib/utils';
import { useT } from '@/lib/i18n';

export function EventStreamPage() {
  const { events, emitEvent, removeEvent, clearEvents } = useBridgeStore();
  const [channel, setChannel] = useState('login.completed');
  const [side, setSide] = useState<'web' | 'mobile' | 'bridge'>('bridge');
  const t = useT();

  return (
    <div className="gradient-bridge min-h-full p-6 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-bridge" />
            <h1 className="text-2xl font-semibold tracking-tight">{t('bridge.events.title')}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{t('bridge.events.subtitle')}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void clearEvents()}
          disabled={events.length === 0}
        >
          <Trash2 className="h-4 w-4" /> {t('common.clear')}
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('bridge.events.emit')}</CardTitle>
          <CardDescription>{t('bridge.events.emitDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Input
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              placeholder={t('bridge.events.channelPlaceholder')}
              className="flex-1 min-w-[220px]"
            />
            <div className="inline-flex h-9 items-center rounded-md border border-input bg-background p-0.5">
              {(['web', 'mobile', 'bridge'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSide(s)}
                  className={`h-8 px-3 text-xs rounded-[5px] ${
                    side === s ? 'bg-accent font-medium' : 'text-muted-foreground'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <Button
              variant="bridge"
              disabled={!channel.trim()}
              onClick={() => emitEvent(channel.trim(), side)}
            >
              <Send className="h-4 w-4" /> {t('common.emit')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('bridge.events.timeline')}</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
              {t('bridge.events.empty')}
            </div>
          ) : (
            <ul className="space-y-1.5">
              {events.slice().reverse().map((evt) => (
                <li
                  key={evt.id}
                  className="group flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
                >
                  <Badge variant={evt.side === 'web' ? 'web' : evt.side === 'mobile' ? 'mobile' : 'bridge'}>
                    {evt.side}
                  </Badge>
                  <span className="font-mono text-sm truncate flex-1">{evt.channel}</span>
                  <span className="text-xs text-muted-foreground">{relativeTime(evt.timestamp, t)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('common.delete')}
                    className="opacity-0 group-hover:opacity-100"
                    onClick={() => void removeEvent(evt.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
