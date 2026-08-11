import { describe, it, expect } from 'vitest';
import type { FeedbackTarget } from '@shared/dev-feedback';
import { reviewScreens } from './review';
import type { DraftMark, DraftStep, MarkPart } from './types';

/**
 * The review list is derived, not stored — which is exactly why it can go wrong
 * quietly. Three derivations carry the whole panel and none of them is visible
 * by looking at the screen:
 *   - the badge number is counted over **all** groups (the screen and note.md
 *     count that way; counting per screen would disagree with both)
 *   - a group spanning screens stands **once per screen** (stood once, it looks
 *     deleted from the others and "drop just this screen's share" has nowhere
 *     to attach)
 *   - the element name comes from **this screen's** first mark (from an earlier
 *     screen's it sends the reader to an unrelated file)
 */

const target = (name: string): FeedbackTarget => ({
  tag: 'span',
  className: '',
  testId: null,
  text: '',
  cssPath: '',
  components: [name],
  rect: { x: 0, y: 0, width: 10, height: 10 },
});

const part = (over: Partial<MarkPart> = {}): MarkPart => ({
  kind: 'shape',
  shape: null,
  bounds: { x: 0, y: 0, width: 10, height: 10 },
  target: null,
  screen: 1,
  ...over,
});

const mark = (id: number, over: Partial<DraftMark> = {}): DraftMark => ({
  id,
  parts: [part()],
  memo: '',
  sketch: null,
  ...over,
});

const step = (seq: number, route = '/bridge/bus'): DraftStep => ({
  seq,
  route,
  viewport: { width: 1320, height: 880 },
  theme: 'light',
  hasImage: true,
});

const here = { seq: 3, route: '/web/remote' };

describe('reviewScreens — the flow is the spine', () => {
  // Not seeing the screen in hand, the user cannot tell where what they just
  // drew went, and the group they drew has no row to be edited from.
  it('always stands the screen in hand last, with no picture and no order handles', () => {
    const list = reviewScreens([step(1, '/a'), step(2, '/b')], [], here);
    expect(list.map((s) => s.route)).toEqual(['/a', '/b', '/web/remote']);
    expect(list.map((s) => s.step)).toEqual([1, 2, 3]);
    expect(list[2]).toMatchObject({ seq: 3, current: true, hasImage: false });
    expect(list.slice(0, 2).every((s) => !s.current)).toBe(true);
  });

  it('stands the screen in hand alone when nothing is frozen yet', () => {
    const list = reviewScreens([], [], here);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ step: 1, current: true });
  });

  // The flow order is the array order; the capture number is the picture's name.
  // Reordering must renumber the steps without touching the pictures.
  it('numbers the steps by flow order while keeping each capture number', () => {
    const list = reviewScreens([step(2, '/b'), step(1, '/a')], [], here);
    expect(list.map((s) => [s.step, s.seq])).toEqual([
      [1, 2],
      [2, 1],
      [3, 3],
    ]);
  });

  it('carries the failed capture through so the panel can say so', () => {
    const list = reviewScreens([{ ...step(1), hasImage: false }], [], here);
    expect(list[0].hasImage).toBe(false);
  });
});

describe('reviewScreens — which items stand where', () => {
  it('leaves a screen with no marks without any row', () => {
    const marks = [mark(1, { parts: [part({ screen: 2 })] })];
    const list = reviewScreens([step(1, '/a'), step(2, '/b')], marks, here);
    expect(list[0].rows).toEqual([]);
    expect(list[1].rows.map((r) => r.id)).toEqual([1]);
  });

  // Stood only once, the item looks deleted from the other screens, and there
  // is nowhere to hang "drop only this screen's share".
  it('stands a group that spans screens once per screen it reaches', () => {
    const marks = [mark(1, { parts: [part({ screen: 1 }), part({ screen: 2 }), part({ screen: 2 })] })];
    const list = reviewScreens([step(1, '/a'), step(2, '/b')], marks, here);
    expect(list[0].rows[0]).toMatchObject({ id: 1, partsHere: 1, parts: 3, screens: 2 });
    expect(list[1].rows[0]).toMatchObject({ id: 1, partsHere: 2, parts: 3, screens: 2 });
  });

  it('stands the marks drawn on the screen in hand under its own row', () => {
    const marks = [mark(1, { parts: [part({ screen: 3 })] })];
    const list = reviewScreens([step(1, '/a')], marks, here);
    expect(list[0].rows).toEqual([]);
    expect(list[1].rows.map((r) => r.id)).toEqual([1]);
  });

  it('reports the memo and whether a drawing is attached', () => {
    const marks = [mark(1, { memo: '정렬이 깨짐', sketch: 'A' }), mark(2)];
    const list = reviewScreens([], marks, { seq: 1, route: '/a' });
    expect(list[0].rows[0]).toMatchObject({ memo: '정렬이 깨짐', hasSketch: true });
    expect(list[0].rows[1]).toMatchObject({ memo: '', hasSketch: false });
  });
});

describe('reviewScreens — the badge counts over every group', () => {
  // The badge drawn on the screen and written into note.md is the group's place
  // in the whole list. Counted per screen, the panel would disagree with both.
  it('numbers by the group’s place in the whole list, not within the screen', () => {
    const marks = [
      mark(1, { parts: [part({ screen: 1 })] }),
      mark(2, { parts: [part({ screen: 2 })] }),
      mark(3, { parts: [part({ screen: 2 })] }),
    ];
    const list = reviewScreens([step(1, '/a'), step(2, '/b')], marks, here);
    expect(list[0].rows.map((r) => r.label)).toEqual(['①']);
    // ② and ③ — not ① and ② as a per-screen count would give.
    expect(list[1].rows.map((r) => r.label)).toEqual(['②', '③']);
  });

  it('keeps one number for a group standing on several screens', () => {
    const marks = [mark(1), mark(2, { parts: [part({ screen: 1 }), part({ screen: 2 })] })];
    const list = reviewScreens([step(1, '/a'), step(2, '/b')], marks, here);
    expect(list[0].rows.map((r) => r.label)).toEqual(['①', '②']);
    expect(list[1].rows.map((r) => r.label)).toEqual(['②']);
  });
});

describe('reviewScreens — the element name comes from this screen', () => {
  // An earlier screen's element points at an unrelated component, so the row
  // would send the reader to the wrong file — the one thing this tool is for.
  it('names the element from the group’s first mark on that screen', () => {
    const marks = [
      mark(1, {
        parts: [
          part({ screen: 1, target: target('PlanView') }),
          part({ screen: 2, target: target('CompareView') }),
        ],
      }),
    ];
    const list = reviewScreens([step(1, '/a'), step(2, '/b')], marks, here);
    expect(list[0].rows[0].where).toBe('PlanView');
    expect(list[1].rows[0].where).toBe('CompareView');
  });

  it('falls back to the tag, and to nothing when the spot was empty', () => {
    const bare = { ...target('X'), components: [] };
    const marks = [
      mark(1, { parts: [part({ screen: 1, target: bare })] }),
      mark(2, { parts: [part({ screen: 1, target: null })] }),
    ];
    const list = reviewScreens([step(1, '/a')], marks, here);
    expect(list[0].rows[0].where).toBe('span');
    // Null, not a phrase: the words belong to messages.ts, not to this file.
    expect(list[0].rows[1].where).toBeNull();
  });
});
