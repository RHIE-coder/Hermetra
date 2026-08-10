// Editing the flow — reordering the screens walked through, and dropping one
// visited by mistake.
//
// Why it is needed: the order things were drawn in is the flow, but people do
// not walk through an app in the order they explain it. "I saw B, realised A
// was the problem, but the story starts at A" is common. An agent reads this
// order as the story, so a wrong order hands it cause and effect reversed.
//
// Screens only. The order of individual strokes carries no meaning (within one
// screen they are all visible at once); only screen order says "what I did,
// and then what happened".
//
// It uses nothing from `components/ui`, like the rest of this tool: the moment
// it is wanted is the moment those parts may be broken.
import { markLabel } from '@shared/dev-feedback';
import { useT } from '@/lib/i18n';
import { MARK_COLOR, type DraftMark, type DraftStep } from './types';

type Props = {
  steps: DraftStep[];
  marks: DraftMark[];
  /** The screen being drawn on, not frozen yet. Shown greyed at the end. */
  current: { route: string; screen: number };
  onMove: (index: number, delta: number) => void;
  onRemove: (index: number) => void;
  onClose: () => void;
};

const btn =
  'rounded-md px-2.5 py-1.5 text-xs font-medium text-card-foreground hover:bg-muted disabled:opacity-30';

export function FlowModal({ steps, marks, current, onMove, onRemove, onClose }: Props) {
  const t = useT();
  /** Which groups have a mark on a given screen — shown so that dropping a
   *  screen is not a surprise about what else goes with it. */
  const labelsOn = (screen: number) =>
    marks
      .map((m, i) => (m.parts.some((p) => p.screen === screen) ? markLabel(i) : null))
      .filter((label): label is string => label !== null);
  const onCurrent = labelsOn(current.screen);

  return (
    // Covers on-screen drawing entirely — nothing may be drawn behind it.
    <div
      data-testid="dev-feedback-flow"
      className="absolute inset-0 z-10 flex flex-col gap-2 bg-black/45 p-3 backdrop-blur-[2px]"
    >
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-card px-2.5 py-1 text-xs font-semibold text-card-foreground">
          {t('devFeedback.flow.title')}
        </span>
        <span className="rounded-full bg-card px-2.5 py-1 text-[11px] text-muted-foreground">
          {t('devFeedback.flow.subtitle')}
        </span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-card px-3 py-1.5 text-xs font-semibold text-card-foreground shadow-lg"
        >
          {t('devFeedback.close')}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg bg-card p-1.5 text-card-foreground shadow-lg">
        {steps.map((step, i) => {
          const on = labelsOn(step.seq);
          return (
            <div key={step.seq} className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-muted">
              <span className="w-12 shrink-0 text-xs font-semibold">
                {t('devFeedback.flow.step', { n: i + 1 })}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs">{step.route}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {on.length > 0
                    ? t('devFeedback.flow.marksOn', { labels: on.join(' ') })
                    : t('devFeedback.flow.noMarks')}
                  {step.hasImage ? '' : ` · ${t('devFeedback.flow.noImage')}`}
                </span>
              </span>
              <button
                type="button"
                aria-label={t('devFeedback.flow.up')}
                className={btn}
                disabled={i === 0}
                onClick={() => onMove(i, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={t('devFeedback.flow.down')}
                className={btn}
                disabled={i === steps.length - 1}
                onClick={() => onMove(i, 1)}
              >
                ↓
              </button>
              {/* Dropping a screen takes its marks with it, so what is attached
                  is shown first, in the mark colour when there is any. */}
              <button
                type="button"
                className={btn}
                onClick={() => onRemove(i)}
                style={on.length > 0 ? { color: MARK_COLOR } : undefined}
              >
                {t('devFeedback.flow.drop')}
              </button>
            </div>
          );
        })}
        {/* The screen in hand. Not frozen yet, so it cannot be moved or dropped
            — but it has to be listed, or "where did the screen I just drew on
            go?" is the next question. */}
        <div className="flex items-center gap-2 rounded-md px-2 py-2">
          <span className="w-12 shrink-0 text-xs font-semibold text-muted-foreground">
            {t('devFeedback.flow.step', { n: steps.length + 1 })}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs text-muted-foreground">{current.route}</span>
            <span className="block text-[11px] text-muted-foreground">
              {t('devFeedback.flow.current')}
              {onCurrent.length > 0
                ? ` · ${t('devFeedback.flow.marksOn', { labels: onCurrent.join(' ') })}`
                : ''}
            </span>
          </span>
        </div>
        {steps.length === 0 ? (
          <p className="px-2 pb-2 text-[11px] text-muted-foreground">{t('devFeedback.flow.empty')}</p>
        ) : null}
      </div>
    </div>
  );
}
