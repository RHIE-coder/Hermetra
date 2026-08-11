// Deriving the review list: screens as the spine, the items left on each hanging
// under it.
//
// Why it is split out of the panel: three of these derivations are invisible on
// screen and only surface after the feedback has been sent.
//
//   - The badge number is the group's place in the **whole** list, because that
//     is what is drawn on the screen and written into `note.md`. Counted within
//     a screen it would disagree with both, and the user would be reading a
//     different ① than the agent.
//   - A group that spans screens stands **once per screen**. Stood once, it
//     looks deleted from the others, and "drop just this screen's share" — the
//     smallest thing that can be done to an earlier screen — has nowhere to sit.
//   - The element name comes from the group's first mark **on that screen**.
//     Taken from an earlier screen's mark it names an unrelated component, which
//     sends the reader to the wrong file: the one job this tool has.
//
// The screen in hand is appended here rather than in the panel so it cannot be
// forgotten: without its row, what was just drawn has no row to be edited from,
// and the user cannot tell where it went.
import { markLabel } from '@shared/dev-feedback';
import { partsOnScreen, screenSpan } from './group';
import type { DraftMark, DraftStep } from './types';

/** One item (group) as it stands under one screen. */
export type ReviewRow = {
  id: number;
  /** The badge — counted over every group, so it matches the screen and `note.md`. */
  label: string;
  memo: string;
  /** Marks this group has **on this screen**. */
  partsHere: number;
  /** Marks in the whole group. */
  parts: number;
  /** Screens the group reaches across. More than one means it is a story. */
  screens: number;
  hasSketch: boolean;
  /**
   * What this group pointed at **on this screen**. Null when the spot was empty
   * — the wording for that lives in `messages.ts`, not here.
   */
  where: string | null;
};

/** One screen (leg of the flow) with its items. */
export type ReviewScreen = {
  /** Capture identity (`DraftStep.seq`): what a mark holds, and what names the picture. */
  seq: number;
  /** Position in the flow, from 1. Reordering changes this and nothing else. */
  step: number;
  route: string;
  /** The screen being drawn on. Not frozen, so it has no picture and no order handles. */
  current: boolean;
  hasImage: boolean;
  rows: ReviewRow[];
};

function rowsOn(marks: readonly DraftMark[], screen: number): ReviewRow[] {
  return marks.flatMap((mark, i) => {
    const here = partsOnScreen(mark, screen);
    if (here.length === 0) return [];
    const target = here[0].target;
    return [
      {
        id: mark.id,
        // `i` is the index in the whole list — the badge the user sees.
        label: markLabel(i),
        memo: mark.memo,
        partsHere: here.length,
        parts: mark.parts.length,
        screens: screenSpan(mark),
        hasSketch: mark.sketch !== null,
        where: target?.components[0] ?? target?.tag ?? null,
      },
    ];
  });
}

/**
 * The review list: every frozen screen in flow order, then the screen in hand.
 *
 * `current.seq` is the identity marks drawn right now carry, so its row picks
 * them up the same way a frozen screen's does.
 */
export function reviewScreens(
  steps: readonly DraftStep[],
  marks: readonly DraftMark[],
  current: { seq: number; route: string },
): ReviewScreen[] {
  const frozen = steps.map((step, i) => ({
    seq: step.seq,
    step: i + 1,
    route: step.route,
    current: false,
    hasImage: step.hasImage,
    rows: rowsOn(marks, step.seq),
  }));
  return [
    ...frozen,
    {
      seq: current.seq,
      step: steps.length + 1,
      route: current.route,
      current: true,
      // Not photographed yet. Claiming otherwise would leave the panel waiting
      // for a thumbnail that is not on disk.
      hasImage: false,
      rows: rowsOn(marks, current.seq),
    },
  ];
}
