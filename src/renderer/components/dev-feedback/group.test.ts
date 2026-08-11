import { describe, it, expect } from 'vitest';
import {
  appendPart,
  isLastPart,
  mergeMarks,
  moveStep,
  partsOnScreen,
  removeMark,
  removePart,
  removePartsOnScreen,
  removeStep,
  screenSpan,
  setMemo,
  splitMark,
} from './group';
import type { DraftMark, DraftStep, MarkPart } from './types';

/**
 * Grouping is where "what is one request" gets decided, and where the user's
 * own words can go missing. A memo attached to the wrong marks, or dropped on
 * a merge, only shows up after it has been sent — which is why this logic is
 * kept out of the overlay and pinned here instead.
 */

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

describe('appendPart — the open memo is what collects', () => {
  it('adds a mark to the group that is listening', () => {
    const marks = [mark(1), mark(2)];
    const next = appendPart(marks, 1, part({ kind: 'pin' }));
    expect(next[0].parts).toHaveLength(2);
    expect(next[1].parts).toHaveLength(1);
  });
});

describe('removePart — erasing takes one stroke, not the message', () => {
  // A crooked box should not cost the user the sentence they just typed.
  it('removes one mark and leaves the memo alone', () => {
    const marks = [mark(1, { parts: [part(), part()], memo: '이 카드를 옮겨라' })];
    const next = removePart(marks, 1, 0);
    expect(next[0].parts).toHaveLength(1);
    expect(next[0].memo).toBe('이 카드를 옮겨라');
  });

  // A memo with nothing left pointing at anything cannot be placed on a screen.
  it('drops the whole group when the last mark goes', () => {
    expect(removePart([mark(1), mark(2)], 1, 0).map((m) => m.id)).toEqual([2]);
  });

  it('tells the caller in advance that this was the last one', () => {
    expect(isLastPart([mark(1)], 1)).toBe(true);
    expect(isLastPart([mark(1, { parts: [part(), part()] })], 1)).toBe(false);
    expect(isLastPart([mark(1)], 99)).toBe(false);
  });
});

describe('setMemo — the memo is not tied to a screen', () => {
  // The review panel edits the memo of a group whose marks are on an earlier
  // screen. Coordinates belong to a screen; the sentence does not.
  it('rewrites one group’s memo and leaves the others alone', () => {
    const marks = [mark(1, { memo: '처음' }), mark(2, { memo: '그대로' })];
    const next = setMemo(marks, 1, '고친 말');
    expect(next.map((m) => m.memo)).toEqual(['고친 말', '그대로']);
    // The marks themselves are untouched — this is a text edit, nothing else.
    expect(next[0].parts).toBe(marks[0].parts);
  });

  it('does nothing for a group that is not there', () => {
    expect(setMemo([mark(1, { memo: 'a' })], 9, 'b')[0].memo).toBe('a');
  });
});

describe('removeMark — dropping a whole group', () => {
  // The smallest thing the panel could offer used to be "drop the screen",
  // which took every other group's marks on it too.
  it('takes the group with every mark it holds, across screens', () => {
    const across = mark(1, { parts: [part({ screen: 1 }), part({ screen: 2 })] });
    const out = removeMark([across, mark(2)], 1);
    expect(out.map((m) => m.id)).toEqual([2]);
  });

  it('does nothing for a group that is not there', () => {
    expect(removeMark([mark(1)], 9)).toHaveLength(1);
  });
});

describe('removePartsOnScreen — one screen’s share of a group', () => {
  const across = mark(1, {
    parts: [part({ screen: 1 }), part({ screen: 2 }), part({ screen: 2 })],
    memo: '한 요청',
    sketch: 'A',
  });

  // The point of the whole thing: pulling this screen out of a request without
  // touching what it says about the other one.
  it('drops that screen’s marks and keeps the rest, memo and drawing included', () => {
    const out = removePartsOnScreen([across], 1, 2);
    expect(out).toHaveLength(1);
    expect(out[0].parts.map((p) => p.screen)).toEqual([1]);
    expect(out[0]).toMatchObject({ memo: '한 요청', sketch: 'A' });
  });

  // Same rule as removePart: a memo with nothing pointing at anything cannot be
  // placed on a screen.
  it('drops the group when that screen held its last marks', () => {
    expect(removePartsOnScreen([across, mark(2)], 1, 1).map((m) => m.id)).toEqual([1, 2]);
    expect(removePartsOnScreen([mark(1, { parts: [part({ screen: 1 })] })], 1, 1)).toHaveLength(0);
  });

  it('leaves other groups alone even when they are on that screen', () => {
    const out = removePartsOnScreen([across, mark(2, { parts: [part({ screen: 2 })] })], 1, 2);
    expect(out[1].parts).toHaveLength(1);
  });
});

describe('mergeMarks — joining what was left separately', () => {
  const a = mark(1, { memo: '카드를 옮겨라', sketch: 'A' });
  const b = mark(2, { memo: '이 목록으로', sketch: 'B' });
  const c = mark(3, { memo: '' });

  it('keeps the earliest group so the badge numbers do not shift', () => {
    const { marks } = mergeMarks([a, b, c], [2, 1]);
    expect(marks.map((m) => m.id)).toEqual([1, 3]);
    expect(marks[0].parts).toHaveLength(2);
  });

  // Both sentences are things the user actually wrote; keeping one would throw
  // away half of what they said.
  it('joins the memos instead of picking one, and skips the empty ones', () => {
    expect(mergeMarks([a, b, c], [1, 2, 3]).marks[0].memo).toBe('카드를 옮겨라 / 이 목록으로');
  });

  // One drawing per group is the model, so a merge has to lose some — but it
  // says how many rather than losing them quietly.
  it('keeps the first drawing and reports how many were dropped', () => {
    const result = mergeMarks([a, b], [1, 2]);
    expect(result.marks[0].sketch).toBe('A');
    expect(result.droppedSketches).toBe(1);
    expect(mergeMarks([a, c], [1, 3]).droppedSketches).toBe(0);
  });

  it('does nothing when fewer than two were picked', () => {
    expect(mergeMarks([a, b], [1]).marks).toHaveLength(2);
  });
});

describe('splitMark — undoing a wrong grouping', () => {
  // Copying the memo onto each piece would put words in the user's mouth.
  it('gives every mark its own group, the memo staying with the first', () => {
    const marks = [mark(1, { parts: [part(), part(), part()], memo: '한 요청', sketch: 'A' })];
    let next = 7;
    const out = splitMark(marks, 1, () => next++);
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({ id: 1, memo: '한 요청', sketch: 'A' });
    expect(out[1]).toMatchObject({ id: 7, memo: '', sketch: null });
    expect(out[2]).toMatchObject({ id: 8, memo: '', sketch: null });
    expect(out.every((m) => m.parts.length === 1)).toBe(true);
  });

  it('leaves a single-mark group as it is', () => {
    expect(splitMark([mark(1)], 1, () => 9)).toHaveLength(1);
  });
});

describe('screenSpan · partsOnScreen — only this screen is live', () => {
  const across = mark(1, { parts: [part({ screen: 1 }), part({ screen: 2 }), part({ screen: 2 })] });

  it('counts the screens a group reaches across', () => {
    expect(screenSpan(across)).toBe(2);
    expect(screenSpan(mark(2))).toBe(1);
  });

  // Marks from an earlier screen are already baked into that screen's picture;
  // drawing them here would put them at unrelated coordinates.
  it('hands back only the marks belonging to the screen being drawn', () => {
    expect(partsOnScreen(across, 2)).toHaveLength(2);
    expect(partsOnScreen(across, 3)).toHaveLength(0);
  });
});

describe('moveStep — the flow order is the story', () => {
  const steps = [step(1, '/a'), step(2, '/b'), step(3, '/c')];

  it('moves a screen without touching any mark', () => {
    expect(moveStep(steps, 2, -1).map((s) => s.route)).toEqual(['/a', '/c', '/b']);
    expect(moveStep(steps, 0, 1).map((s) => s.route)).toEqual(['/b', '/a', '/c']);
  });

  // Wrapping around is less predictable than a button that does nothing.
  it('does nothing at the ends rather than wrapping', () => {
    expect(moveStep(steps, 0, -1)).toEqual(steps);
    expect(moveStep(steps, 2, 1)).toEqual(steps);
    expect(moveStep(steps, 9, 1)).toEqual(steps);
  });
});

describe('removeStep — dropping a screen visited by mistake', () => {
  const steps = [step(1, '/a'), step(2, '/b')];
  const marks = [
    mark(1, { parts: [part({ screen: 1 }), part({ screen: 2 })] }),
    mark(2, { parts: [part({ screen: 2 })] }),
  ];

  // The coordinates are in that screen's viewport — there is nowhere to keep
  // them once the screen is gone.
  it('takes that screen’s marks with it, and any group left empty', () => {
    const out = removeStep(steps, marks, 1);
    expect(out.steps.map((s) => s.route)).toEqual(['/a']);
    expect(out.marks).toHaveLength(1);
    expect(out.marks[0].parts).toHaveLength(1);
  });

  // Renumbering would slide every surviving mark onto a different picture.
  it('leaves the capture numbers of the remaining screens alone', () => {
    const out = removeStep([step(1), step(2), step(3)], [], 0);
    expect(out.steps.map((s) => s.seq)).toEqual([2, 3]);
  });

  it('does nothing for an index that is not there', () => {
    expect(removeStep(steps, marks, 9).steps).toHaveLength(2);
  });
});
