// Review — the one place a collected round is looked at and fixed.
//
// It replaced two panels that split the job in half: a list that showed the
// memos but could only *open* an item (and an item from an earlier screen had
// nowhere for its memo box to stand, so it could be neither edited nor deleted),
// and a flow panel that showed screen routes and badge numbers with no memo and
// no drawing in sight. Between them, pulling one item out of a round meant
// dropping the whole screen — which took every other item's marks on it too, and
// left the user redrawing from memory.
//
// So: **screens are the spine, and the items left on each hang under it.** The
// memo box is an input that edits in place, with no "edit mode" step, because a
// memo is not tied to a screen the way coordinates are — that is precisely what
// makes an earlier screen's item reachable at all.
//
// It uses nothing from `components/ui`, like the rest of this tool: the moment it
// is wanted is the moment those parts may be broken.
import { useT } from '@/lib/i18n';
import { SCROLL_ATTR } from './inspect';
import type { ReviewScreen } from './review';
import { MARK_COLOR, SKETCH_BADGE_COLOR } from './types';

type Props = {
  screens: ReviewScreen[];
  /** Collected screens as thumbnails, by capture number. Missing = not read yet
   *  or nothing on disk; the row stands either way. */
  shots: Record<number, string>;
  /**
   * The one line for something that was quietly lost (a merge, a dropped
   * screen). It has to be drawn **here**: this panel covers the toolbar, and the
   * hint slot under it, so a notice left there is announced into a covered spot.
   */
  notice: string | null;
  /** Groups being picked for a merge. Null when not picking. */
  mergeIds: number[] | null;
  onMemo: (id: number, memo: string) => void;
  onRemoveMark: (id: number) => void;
  onRemoveHere: (id: number, screen: number) => void;
  onContinue: (id: number) => void;
  onSketch: (id: number) => void;
  onMoveStep: (index: number, delta: number) => void;
  onRemoveStep: (index: number) => void;
  onMergeStart: () => void;
  onMergeToggle: (id: number) => void;
  onMergeApply: () => void;
  onMergeCancel: () => void;
  onClose: () => void;
};

const btn =
  'shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-card-foreground hover:bg-muted disabled:opacity-30';

/**
 * Ceiling on the row. Left to fill the window, the handles land at the far right
 * edge and the eye crosses the whole screen between the memo being fixed and the
 * button that acts on it.
 */
const MEMO_MAX = 620;
/** Thumbnail + memo box + handles. The header is bound to the same width, or
 *  "close" floats alone at the window edge and reads as a different screen. */
const PANEL_MAX = 1082;

export function ReviewModal({
  screens,
  shots,
  notice,
  mergeIds,
  onMemo,
  onRemoveMark,
  onRemoveHere,
  onContinue,
  onSketch,
  onMoveStep,
  onRemoveStep,
  onMergeStart,
  onMergeToggle,
  onMergeApply,
  onMergeCancel,
  onClose,
}: Props) {
  const t = useT();
  const frozen = screens.filter((s) => !s.current).length;
  const items = screens.reduce((n, s) => n + s.rows.length, 0);
  const picking = mergeIds !== null;

  return (
    // Covers on-screen drawing entirely — nothing may be drawn behind it.
    <div
      data-testid="dev-feedback-review"
      className="absolute inset-0 z-10 flex flex-col items-center gap-2 bg-black/45 p-3 backdrop-blur-[2px]"
    >
      <div className="flex w-full items-center gap-2" style={{ maxWidth: PANEL_MAX }}>
        <span className="rounded-full bg-card px-2.5 py-1 text-xs font-semibold text-card-foreground">
          {t('devFeedback.review.title')}
        </span>
        {/* The notice outranks the standing line: it answers something the user
            did half a second ago, and this panel is the only place it can be
            seen at all. */}
        {notice ? (
          <span
            data-testid="dev-feedback-review-notice"
            className="min-w-0 truncate rounded-full bg-card px-2.5 py-1 text-[11px] font-medium"
            style={{ color: MARK_COLOR }}
          >
            {notice}
          </span>
        ) : (
          <span className="min-w-0 truncate rounded-full bg-card px-2.5 py-1 text-[11px] text-muted-foreground">
            {picking ? t('devFeedback.group.mergePrompt') : t('devFeedback.flow.subtitle')}
          </span>
        )}
        <span className="flex-1" />
        {picking ? (
          <>
            <button
              type="button"
              data-testid="dev-feedback-merge-apply"
              disabled={mergeIds.length < 2}
              onClick={onMergeApply}
              className="rounded-full bg-card px-3 py-1.5 text-xs font-semibold shadow-lg disabled:opacity-40"
              style={{ color: mergeIds.length >= 2 ? MARK_COLOR : undefined }}
            >
              {mergeIds.length >= 2
                ? t('devFeedback.group.mergeCount', { n: mergeIds.length })
                : t('devFeedback.group.merge')}
            </button>
            <button
              type="button"
              onClick={onMergeCancel}
              className="rounded-full bg-card px-3 py-1.5 text-xs font-semibold text-card-foreground shadow-lg"
            >
              {t('devFeedback.close')}
            </button>
          </>
        ) : (
          <>
            {items > 1 ? (
              <button
                type="button"
                data-testid="dev-feedback-merge-start"
                onClick={onMergeStart}
                className="rounded-full bg-card px-3 py-1.5 text-xs font-semibold text-card-foreground shadow-lg"
              >
                {t('devFeedback.group.mergeStart')}
              </button>
            ) : null}
            <button
              type="button"
              data-testid="dev-feedback-review-close"
              onClick={onClose}
              className="rounded-full bg-card px-3 py-1.5 text-xs font-semibold text-card-foreground shadow-lg"
            >
              {t('devFeedback.close')}
            </button>
          </>
        )}
      </div>

      {/*
        The board grows to fit its content and no further (`flex-[0_1_auto]`).
        Stretched, a round of three items covers the window and the bottom half
        sits empty for no reason.
        It is the one box in the overlay allowed to scroll — see SCROLL_ATTR.
        `overscroll-contain` keeps a wheel that reaches the end from carrying on
        into the screen behind, which is frozen and must stay put.
      */}
      <div
        {...{ [SCROLL_ATTR]: '' }}
        data-testid="dev-feedback-review-list"
        className="w-full min-h-0 flex-[0_1_auto] overflow-y-auto overscroll-contain rounded-lg bg-card p-1.5 text-card-foreground shadow-lg"
        style={{ maxWidth: PANEL_MAX }}
      >
        {screens.map((sc, i) => (
          <div key={sc.seq} className="border-b border-border py-1.5 last:border-b-0">
            <div className="flex items-center gap-2 px-1">
              <span
                className={`shrink-0 text-xs font-semibold ${sc.current ? 'text-muted-foreground' : ''}`}
              >
                {t('devFeedback.flow.step', { n: sc.step })}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{sc.route}</span>
              {/* The screen in hand is not frozen, so there is nothing to move
                  or drop yet — the handles are absent rather than disabled. */}
              {sc.current ? null : (
                <>
                  <button
                    type="button"
                    aria-label={t('devFeedback.flow.up')}
                    className={btn}
                    disabled={i === 0}
                    onClick={() => onMoveStep(i, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={t('devFeedback.flow.down')}
                    className={btn}
                    disabled={i >= frozen - 1}
                    onClick={() => onMoveStep(i, 1)}
                  >
                    ↓
                  </button>
                  {/* Dropping a screen takes its items with it, so it wears the
                      mark colour whenever there is anything to lose. */}
                  <button
                    type="button"
                    data-testid="dev-feedback-step-drop"
                    className={btn}
                    onClick={() => onRemoveStep(i)}
                    style={sc.rows.length > 0 ? { color: MARK_COLOR } : undefined}
                  >
                    {t('devFeedback.flow.drop')}
                  </button>
                </>
              )}
            </div>

            <div className="mt-1 flex items-start gap-2 px-1">
              {/* The picture, at half its collected width: it came back at 320
                  for a sharp 160 on a 2x screen.
                  The screen in hand has no picture **by definition** — never a
                  cached one either. Capture numbers are reused after a screen is
                  dropped, so keying only off `shots[seq]` would put the dropped
                  screen's photograph under the live one. */}
              <div className="w-40 shrink-0">
                {!sc.current && shots[sc.seq] ? (
                  <img
                    src={shots[sc.seq]}
                    alt=""
                    className="w-full rounded border border-border"
                  />
                ) : (
                  <div className="grid h-[100px] w-full place-items-center rounded border border-dashed border-border text-[10px] text-muted-foreground">
                    {sc.current
                      ? t('devFeedback.review.currentScreen')
                      : t('devFeedback.flow.noImage')}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                {sc.rows.length === 0 ? (
                  <p className="px-1 py-2 text-[11px] text-muted-foreground">
                    {t('devFeedback.flow.noMarks')}
                  </p>
                ) : null}
                {sc.rows.map((row) => {
                  const picked = mergeIds?.includes(row.id) ?? false;
                  return (
                    <div key={`${sc.seq}-${row.id}`} className="py-1">
                      <div className="flex items-center gap-1.5">
                        {/* Picking for a merge turns the whole row into the
                            button, and the memo box steps aside — an input and
                            a "select me" row cannot share a click. */}
                        {picking ? (
                          <button
                            type="button"
                            data-testid="dev-feedback-merge-pick"
                            onClick={() => onMergeToggle(row.id)}
                            className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 py-1 text-left hover:bg-muted"
                            style={{ maxWidth: MEMO_MAX }}
                          >
                            <span
                              aria-hidden
                              className="shrink-0 text-xs"
                              style={{ color: picked ? MARK_COLOR : undefined }}
                            >
                              {picked ? '◉' : '○'}
                            </span>
                            <span
                              className="shrink-0 text-xs font-semibold"
                              style={{ color: MARK_COLOR }}
                            >
                              {row.label}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-xs">
                              {row.memo.trim() || (
                                <span className="text-muted-foreground">{t('devFeedback.noMemo')}</span>
                              )}
                            </span>
                          </button>
                        ) : (
                          <>
                            <span
                              className="shrink-0 text-xs font-semibold"
                              style={{ color: MARK_COLOR }}
                            >
                              {row.label}
                            </span>
                            {/* Edits in place. There is no mode to enter, and it
                                works for any screen's item — the point of the
                                whole panel. */}
                            <input
                              data-testid="dev-feedback-review-memo"
                              value={row.memo}
                              placeholder={t('devFeedback.memoPlaceholder')}
                              onChange={(e) => onMemo(row.id, e.target.value)}
                              className="min-w-0 flex-1 rounded-md border border-input bg-card px-2 py-1 text-xs outline-none focus:border-primary"
                              style={{ maxWidth: MEMO_MAX }}
                            />
                            {/* The handles sit beside the box they act on. Below
                                it, or at the row's far right, the eye crosses
                                the row on every fix. */}
                            <button
                              type="button"
                              data-testid="dev-feedback-review-continue"
                              className={btn}
                              onClick={() => onContinue(row.id)}
                            >
                              {t('devFeedback.review.continue')}
                            </button>
                            <button type="button" className={btn} onClick={() => onSketch(row.id)}>
                              {row.hasSketch
                                ? t('devFeedback.sketch.edit')
                                : t('devFeedback.sketch.add')}
                            </button>
                            {/* Only on an item that spans screens: on a
                                single-screen one it would be the same thing as
                                "remove", worded differently. */}
                            {row.screens > 1 ? (
                              <button
                                type="button"
                                data-testid="dev-feedback-review-drop-here"
                                className={btn}
                                onClick={() => onRemoveHere(row.id, sc.seq)}
                              >
                                {t('devFeedback.review.dropHere')}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              data-testid="dev-feedback-review-remove"
                              className={btn}
                              onClick={() => onRemoveMark(row.id)}
                            >
                              {t('devFeedback.remove')}
                            </button>
                          </>
                        )}
                      </div>
                      {/* What it pointed at, under the box rather than beside
                          it: the memo is what is being read and fixed.
                          The mark count is **this screen's**, not the group's —
                          the row is about this screen, and it is what "drop this
                          screen's share" will take. That the group reaches
                          further is said by "N screens" next to it. */}
                      <p className="mt-0.5 pl-4 text-[10px] text-muted-foreground">
                        {row.where ?? t('devFeedback.emptySpot')}
                        {` · ${t('devFeedback.group.parts', { n: row.partsHere })}`}
                        {row.screens > 1 ? (
                          <span style={{ color: MARK_COLOR }}>
                            {` · ${t('devFeedback.group.screens', { n: row.screens })}`}
                          </span>
                        ) : null}
                        {row.hasSketch ? (
                          <span style={{ color: SKETCH_BADGE_COLOR }}>
                            {` · ${t('devFeedback.sketch.has')}`}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  );
                })}
                {/* Why this screen alone has no picture and no order handles. */}
                {sc.current ? (
                  <p className="px-1 pt-1 text-[10px] text-muted-foreground">
                    {t('devFeedback.flow.current')}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
