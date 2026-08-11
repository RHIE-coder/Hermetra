// Handling groups — attaching marks, detaching them, joining what was left
// apart, and splitting it back up. Plus the flow: reordering screens and
// dropping one visited by mistake.
//
// Why it is split out of the overlay: this is where "what is one request" gets
// decided. Group it wrong and the memo the user typed ends up on the wrong
// stroke or disappears — and that loss only surfaces after it has been sent.
// Tangled into the component, none of it can be pinned by a test.
import type { DraftMark, DraftStep, MarkPart } from './types';

/** Adds one mark to the group whose memo is currently open. */
export function appendPart(marks: readonly DraftMark[], id: number, part: MarkPart): DraftMark[] {
  return marks.map((m) => (m.id === id ? { ...m, parts: [...m.parts, part] } : m));
}

/**
 * Removes one mark from a group. **Removing the last one removes the group** —
 * a memo with nothing pointing at anything cannot be placed on a screen.
 */
export function removePart(marks: readonly DraftMark[], id: number, index: number): DraftMark[] {
  return marks.flatMap((m) => {
    if (m.id !== id) return [m];
    const parts = m.parts.filter((_, i) => i !== index);
    return parts.length > 0 ? [{ ...m, parts }] : [];
  });
}

/**
 * Rewrites one group's memo.
 *
 * It takes no screen: coordinates belong to a screen, a sentence does not. That
 * is what lets the review panel edit the memo of a group whose marks are all on
 * an earlier screen — the case the on-screen memo box cannot serve, because it
 * hangs off a mark and there is none here to hang off.
 */
export function setMemo(marks: readonly DraftMark[], id: number, memo: string): DraftMark[] {
  return marks.map((m) => (m.id === id ? { ...m, memo } : m));
}

/** Removes a whole group — every mark it holds, on every screen it reaches. */
export function removeMark(marks: readonly DraftMark[], id: number): DraftMark[] {
  return marks.filter((m) => m.id !== id);
}

/**
 * Removes **one screen's share** of a group, leaving its marks and memo on the
 * other screens alone.
 *
 * This is the smallest unit the review panel can offer for an earlier screen: a
 * single mark cannot be picked there (its coordinates are in that screen's
 * viewport, so there is nothing on this glass to point at), but "this screen's
 * part of this request" can. Without it, pulling one screen out of a request
 * means dropping the screen — which takes every *other* group's marks on it too.
 *
 * Left with no marks the group goes, same rule as `removePart`.
 */
export function removePartsOnScreen(
  marks: readonly DraftMark[],
  id: number,
  screen: number,
): DraftMark[] {
  return marks.flatMap((m) => {
    if (m.id !== id) return [m];
    const parts = m.parts.filter((p) => p.screen !== screen);
    return parts.length > 0 ? [{ ...m, parts }] : [];
  });
}

/** Is this group about to vanish? The caller uses it to close the memo box too. */
export function isLastPart(marks: readonly DraftMark[], id: number): boolean {
  const mark = marks.find((m) => m.id === id);
  return mark !== undefined && mark.parts.length <= 1;
}

export type MergeResult = {
  marks: DraftMark[];
  /** Drawings dropped. One per group, so anything past the first is lost. */
  droppedSketches: number;
};

/**
 * Joins several groups into one. It keeps the **earliest** group's place, so
 * the badge numbers the user has already seen do not shift.
 *
 * Memos are joined rather than picked between — both are sentences the user
 * actually wrote. Drawings cannot be: one per group. The count of dropped ones
 * comes back so the screen can say so instead of losing them quietly.
 */
export function mergeMarks(marks: readonly DraftMark[], ids: readonly number[]): MergeResult {
  const picked = marks.filter((m) => ids.includes(m.id));
  if (picked.length < 2) return { marks: [...marks], droppedSketches: 0 };

  const sketches = picked.map((m) => m.sketch).filter((s): s is string => s !== null);
  const merged: DraftMark = {
    id: picked[0].id,
    parts: picked.flatMap((m) => m.parts),
    memo: picked
      .map((m) => m.memo.trim())
      .filter((memo) => memo !== '')
      .join(' / '),
    sketch: sketches[0] ?? null,
  };

  return {
    marks: marks.flatMap((m) => (m.id === merged.id ? [merged] : ids.includes(m.id) ? [] : [m])),
    droppedSketches: Math.max(0, sketches.length - 1),
  };
}

/**
 * Splits a group back into one group per mark. The memo and the drawing belong
 * to the group and cannot be divided, so the **first mark inherits them** and
 * the rest start empty. Copying them across would put words in the user's mouth.
 */
export function splitMark(
  marks: readonly DraftMark[],
  id: number,
  nextId: () => number,
): DraftMark[] {
  return marks.flatMap((m) => {
    if (m.id !== id || m.parts.length < 2) return [m];
    return m.parts.map((part, i) =>
      i === 0 ? { ...m, parts: [part] } : { id: nextId(), parts: [part], memo: '', sketch: null },
    );
  });
}

/** How many screens this group reaches across. Two or more means "do A, then B breaks". */
export function screenSpan(mark: DraftMark): number {
  return new Set(mark.parts.map((p) => p.screen)).size;
}

/** The marks to draw on the screen in hand — earlier ones are already baked into their own picture. */
export function partsOnScreen(mark: DraftMark, screen: number): MarkPart[] {
  return mark.parts.filter((p) => p.screen === screen);
}

/**
 * Moves one screen up or down the flow.
 *
 * The marks are **untouched**: what a mark holds is the screen's identity
 * (`seq`), not its position, so shuffling the array is the whole operation.
 * A move past either end does nothing — more predictable than wrapping around.
 */
export function moveStep(steps: readonly DraftStep[], from: number, delta: number): DraftStep[] {
  const to = from + delta;
  if (from < 0 || from >= steps.length || to < 0 || to >= steps.length) return [...steps];
  const next = [...steps];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Drops one screen from the flow. **The marks drawn on it go too** — their
 * coordinates are in that screen's viewport and there is nowhere to keep them.
 * A group left with no marks goes with them.
 *
 * The surviving screens keep their `seq`. Renumbering would slide every
 * surviving mark onto a different picture.
 */
export function removeStep(
  steps: readonly DraftStep[],
  marks: readonly DraftMark[],
  index: number,
): { steps: DraftStep[]; marks: DraftMark[] } {
  const gone = steps[index];
  if (!gone) return { steps: [...steps], marks: [...marks] };
  return {
    steps: steps.filter((_, i) => i !== index),
    marks: marks.flatMap((m) => {
      const parts = m.parts.filter((p) => p.screen !== gone.seq);
      return parts.length > 0 ? [{ ...m, parts }] : [];
    }),
  };
}
