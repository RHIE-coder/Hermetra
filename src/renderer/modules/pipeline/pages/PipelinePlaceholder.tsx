import type { ComponentType } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useT } from '@/lib/i18n';
import type { MessageKey } from '@/lib/messages';

interface PipelinePlaceholderProps {
  /** `page-<x>` for the rail's `nav-<x>`. e2e and the surface adapter find the screen by this. */
  testId: string;
  icon: ComponentType<{ className?: string }>;
  titleKey: MessageKey;
  subtitleKey: MessageKey;
}

/**
 * The shell every Data Pipeline screen wears until it has something to show.
 *
 * It is one component rather than six copies on purpose: what the six screens
 * share right now is *everything*, and six identical files would each have to be
 * unpicked separately once a screen grows real content. When a screen does grow
 * content it stops calling this and keeps only the header shape.
 *
 * The header is the same header the built screens use (icon + title + one line
 * of subtitle) so that filling a screen in is an additive change, not a
 * re-layout — and so the subtitle carries the promise of what belongs here.
 */
export function PipelinePlaceholder({
  testId,
  icon: Icon,
  titleKey,
  subtitleKey,
}: PipelinePlaceholderProps) {
  const t = useT();

  return (
    <div data-testid={testId} className="min-h-full space-y-4 p-5">
      <header>
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold tracking-tight">{t(titleKey)}</h1>
        </div>
        {/* break-keep: Hangul breaks between syllables by default, which splits a
            word mid-way ("확정하 / 려고"). keep-all breaks at word boundaries. */}
        <p className="max-w-2xl break-keep text-sm text-muted-foreground">{t(subtitleKey)}</p>
      </header>

      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-1 px-4 py-12 text-center">
          <p className="text-sm font-medium">{t('pipeline.placeholder.title')}</p>
          <p className="max-w-md break-keep text-sm text-muted-foreground">
            {t('pipeline.placeholder.body')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
