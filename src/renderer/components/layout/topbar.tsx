import { useBridgeStore } from '@/modules/bridge/store';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { LanguageToggle } from '@/components/theme/language-toggle';
import { Badge } from '@/components/ui/badge';
import { useWebStore } from '@/modules/web/store';
import { useMobileStore } from '@/modules/mobile/store';
import { WorkspaceSwitcher } from '@/modules/workspace/WorkspaceSwitcher';
import { useT } from '@/lib/i18n';

export function Topbar() {
  const webRunning = useWebStore((s) => s.status.isRunning);
  const appiumRunning = useMobileStore((s) => s.appium.isRunning);
  const eventCount = useBridgeStore((s) => s.events.length);
  const busCount = useBridgeStore((s) => s.vars.length);
  const t = useT();

  return (
    <header className="flex h-12 items-center justify-between border-b border-border bg-topbar px-4">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <WorkspaceSwitcher />
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={webRunning ? 'web' : 'outline'}>
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
          {t('topbar.web')} {webRunning ? t('common.on') : t('common.off')}
        </Badge>
        <Badge variant={appiumRunning ? 'mobile' : 'outline'}>
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
          {t('topbar.mobile')} {appiumRunning ? t('common.on') : t('common.off')}
        </Badge>
        {/* Colour means "there is something here". An idle bus is not news, so
            the counter stays neutral until it actually holds something. */}
        <Badge variant={busCount + eventCount > 0 ? 'bridge' : 'outline'}>
          {t('topbar.busEvents', { bus: busCount, events: eventCount })}
        </Badge>
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </header>
  );
}
