import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { HermetraMark } from '@/components/brand/hermetra-mark';

export function TitleBar() {
  const isMac = window.bridge?.platform === 'darwin';
  const t = useT();

  return (
    <div
      className={cn(
        'drag-region flex h-9 shrink-0 select-none items-center justify-center border-b border-border bg-topbar',
        isMac ? 'pl-[78px] pr-3' : 'px-3',
      )}
    >
      <HermetraMark className="mr-2 h-4 w-4 rounded" />
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground">
        {t('titlebar.brand')}
      </span>
    </div>
  );
}
