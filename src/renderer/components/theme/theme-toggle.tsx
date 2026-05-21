import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import type { MessageKey } from '@/lib/messages';

const options: ReadonlyArray<{
  value: 'light' | 'dark' | 'system';
  icon: React.ComponentType<{ className?: string }>;
  labelKey: MessageKey;
}> = [
  { value: 'light', icon: Sun, labelKey: 'theme.light' },
  { value: 'dark', icon: Moon, labelKey: 'theme.dark' },
  { value: 'system', icon: Monitor, labelKey: 'theme.system' },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const t = useT();
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-9 w-[108px] rounded-md border border-input" />;
  }

  return (
    <div className="inline-flex h-9 items-center rounded-md border border-input bg-background p-0.5 shadow-sm">
      {options.map(({ value, icon: Icon, labelKey }) => (
        <Button
          key={value}
          variant="ghost"
          size="sm"
          aria-label={t(labelKey)}
          onClick={() => setTheme(value)}
          className={cn(
            'h-8 w-8 rounded-[5px] p-0 text-muted-foreground',
            theme === value && 'bg-accent text-foreground shadow-sm',
          )}
        >
          <Icon className="h-4 w-4" />
        </Button>
      ))}
    </div>
  );
}
