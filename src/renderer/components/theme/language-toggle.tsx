import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useI18n, type Locale } from '@/lib/i18n';

const options: ReadonlyArray<{ value: Locale; labelKey: 'language.en' | 'language.ko' }> = [
  { value: 'en', labelKey: 'language.en' },
  { value: 'ko', labelKey: 'language.ko' },
];

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      className="inline-flex h-9 items-center rounded-md border border-input bg-background p-0.5 shadow-sm"
      role="group"
      aria-label={t('language.label')}
    >
      <span className="grid h-8 w-8 place-items-center text-muted-foreground">
        <Languages className="h-4 w-4" />
      </span>
      {options.map(({ value, labelKey }) => (
        <Button
          key={value}
          variant="ghost"
          size="sm"
          aria-label={t(labelKey)}
          aria-pressed={locale === value}
          onClick={() => setLocale(value)}
          className={cn(
            'h-8 min-w-[36px] px-2 rounded-[5px] text-[11px] font-semibold tracking-wide text-muted-foreground',
            locale === value && 'bg-accent text-foreground shadow-sm',
          )}
        >
          {t(labelKey)}
        </Button>
      ))}
    </div>
  );
}
