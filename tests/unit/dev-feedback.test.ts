import { describe, it, expect } from 'vitest';
import {
  BADGE_RADIUS,
  MAX_SKETCH_CHARS,
  PNG_DATA_URL_PREFIX,
  badgeCenter,
  badgeHit,
  feedbackFolderName,
  markLabel,
  parseFeedbackPayload,
  renderNoteMarkdown,
  sketchFileName,
  slugifyRoute,
} from '@shared/dev-feedback';

/**
 * Pure logic of the dev-only screen feedback tool.
 *
 * The whole value of this tool is "does what the user left survive intact and
 * can an agent read it". Three things are pinned here:
 *   1. the save folder name neither collides nor escapes `.harness/feedback/`
 *   2. a broken payload is rejected, a merely sparse one is not
 *   3. `note.md` actually carries what identifies the element (without that,
 *      the tool is just coordinates and the agent is back to guessing)
 */

/** Not a real PNG — the format check only looks at the prefix and the length. */
const PNG = `${PNG_DATA_URL_PREFIX}iVBORw0KGgo=`;

describe('slugifyRoute', () => {
  it('turns a route into a folder fragment', () => {
    expect(slugifyRoute('/bridge/bus')).toBe('bridge-bus');
    expect(slugifyRoute('/mobile/inspector')).toBe('mobile-inspector');
  });

  it('never yields an empty name for the root route', () => {
    expect(slugifyRoute('/')).toBe('root');
  });

  // The route comes from the renderer's hash. If separators or parent hops
  // survive, the save location leaks out of `.harness/feedback/`.
  it('strips path separators and parent hops', () => {
    expect(slugifyRoute('/../../etc/passwd')).toBe('etc-passwd');
    expect(slugifyRoute('/a/../b')).toBe('a-b');
    expect(slugifyRoute('/..')).toBe('root');
  });

  it('truncates a very long route without leaving a trailing hyphen', () => {
    const slug = slugifyRoute(`/${'a'.repeat(30)}/${'b'.repeat(30)}`);
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('feedbackFolderName', () => {
  it('joins the timestamp and the screen', () => {
    expect(feedbackFolderName(new Date(2026, 7, 2, 14, 32, 7), '/bridge/bus')).toBe(
      '20260802-143207-bridge-bus',
    );
  });

  // Pointing at the same screen twice in a row is the actual usage pattern.
  // At minute resolution the second round would silently overwrite the first.
  it('two rounds in the same minute do not overwrite each other', () => {
    const a = feedbackFolderName(new Date(2026, 7, 2, 14, 32, 7), '/bridge/bus');
    const b = feedbackFolderName(new Date(2026, 7, 2, 14, 32, 41), '/bridge/bus');
    expect(a).not.toBe(b);
  });
});

describe('badgeHit — tapping a badge reopens its note', () => {
  const mark = (id: number, x: number, y: number) => ({ id, bounds: { x, y, width: 60, height: 40 } });
  const marks = [mark(1, 100, 100), mark(2, 300, 300)];

  it('picks the mark whose badge was tapped', () => {
    const c = badgeCenter(marks[0].bounds);
    expect(badgeHit(marks, c.x, c.y)).toBe(1);
    const c2 = badgeCenter(marks[1].bounds);
    expect(badgeHit(marks, c2.x, c2.y)).toBe(2);
  });

  it('seats the badge on the top-left corner of the mark', () => {
    expect(badgeCenter({ x: 100, y: 100, width: 60, height: 40 })).toEqual({
      x: 100 + BADGE_RADIUS,
      y: 100 + BADGE_RADIUS,
    });
  });

  it('picks nothing far from a badge — that is where drawing starts', () => {
    expect(badgeHit(marks, 200, 200)).toBeNull();
    expect(badgeHit([], 100, 100)).toBeNull();
  });

  // A finger cannot hit an 11px circle exactly. A near miss must still open it.
  it('still hits on a near miss', () => {
    const c = badgeCenter(marks[0].bounds);
    expect(badgeHit(marks, c.x + BADGE_RADIUS + 3, c.y)).toBe(1);
  });

  // Overlapping badges: the one drawn last is the one visible on top.
  it('the later badge wins when two overlap', () => {
    const stacked = [mark(1, 100, 100), mark(2, 102, 102)];
    const c = badgeCenter(stacked[1].bounds);
    expect(badgeHit(stacked, c.x, c.y)).toBe(2);
  });
});

describe('markLabel', () => {
  it('numbers marks with the same symbols the badge draws', () => {
    expect(markLabel(0)).toBe('①');
    expect(markLabel(19)).toBe('⑳');
  });
});

const validMark = {
  kind: 'shape',
  memo: '이 배지가 글자를 잘라먹음',
  bounds: { x: 10, y: 20, width: 80, height: 24 },
  target: {
    tag: 'span',
    className: 'rounded-full bg-card px-2.5 py-1',
    testId: 'bus-var-row',
    text: 'session.token',
    cssPath: 'main > div:nth-of-type(2) > span',
    components: ['Badge', 'VariableBusPage', 'AppShell'],
    rect: { x: 10, y: 20, width: 80, height: 24 },
  },
};

const validPayload = {
  route: '/bridge/bus',
  viewport: { width: 1320, height: 880 },
  theme: 'dark',
  marks: [validMark],
};

describe('parseFeedbackPayload — a sound payload gets through', () => {
  it('accepts a normal payload', () => {
    const r = parseFeedbackPayload(validPayload);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.marks).toHaveLength(1);
    expect(r.value.marks[0].target?.components).toEqual(['Badge', 'VariableBusPage', 'AppShell']);
    expect(r.value.theme).toBe('dark');
  });

  // People circle something and send it without typing anything. The mark
  // itself is the information — dropping it would throw the feedback away.
  it('keeps a mark with an empty memo', () => {
    const r = parseFeedbackPayload({ ...validPayload, marks: [{ ...validMark, memo: '' }] });
    expect(r.ok).toBe(true);
  });

  // Marking empty space finds no element. The mark still has to survive.
  it('keeps a mark whose element was not found', () => {
    const r = parseFeedbackPayload({ ...validPayload, marks: [{ ...validMark, target: null }] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.marks[0].target).toBeNull();
  });

  it('defaults an unknown theme to null instead of rejecting', () => {
    const r = parseFeedbackPayload({ ...validPayload, theme: 'sepia' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.theme).toBeNull();
  });

  it('names a sketch after its mark and hands the bytes to the caller', () => {
    const r = parseFeedbackPayload({
      ...validPayload,
      marks: [{ ...validMark, sketch: PNG }, { ...validMark, sketch: null }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.marks[0].sketchFile).toBe(sketchFileName(0));
    expect(r.value.marks[1].sketchFile).toBeNull();
    expect(r.sketches).toEqual([{ file: 'sketch-1.png', dataUrl: PNG }]);
  });

  // The base64 never goes into note.json — it would make the file unopenable
  // and store the same picture twice.
  it('carries only the file name on the mark, never the image bytes', () => {
    const r = parseFeedbackPayload({ ...validPayload, marks: [{ ...validMark, sketch: PNG }] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(JSON.stringify(r.value)).not.toContain('iVBORw0KGgo');
  });
});

describe('parseFeedbackPayload — a broken request is refused', () => {
  it('refuses a non-object body', () => {
    expect(parseFeedbackPayload('nope').ok).toBe(false);
    expect(parseFeedbackPayload(null).ok).toBe(false);
  });

  it('refuses a missing or relative route', () => {
    expect(parseFeedbackPayload({ ...validPayload, route: '' }).ok).toBe(false);
    expect(parseFeedbackPayload({ ...validPayload, route: 'bridge/bus' }).ok).toBe(false);
  });

  it('refuses a missing viewport', () => {
    expect(parseFeedbackPayload({ ...validPayload, viewport: null }).ok).toBe(false);
    expect(parseFeedbackPayload({ ...validPayload, viewport: { width: 1320 } }).ok).toBe(false);
  });

  // NaN / Infinity in a coordinate turns note.md into unreadable values.
  it('refuses non-finite coordinates', () => {
    const bad = { ...validMark, bounds: { x: 0, y: 0, width: Number.NaN, height: 10 } };
    expect(parseFeedbackPayload({ ...validPayload, marks: [bad] }).ok).toBe(false);
  });

  it('refuses an empty mark list', () => {
    expect(parseFeedbackPayload({ ...validPayload, marks: [] }).ok).toBe(false);
  });

  it('refuses too many marks', () => {
    const many = Array.from({ length: 21 }, () => validMark);
    expect(parseFeedbackPayload({ ...validPayload, marks: many }).ok).toBe(false);
  });

  // The user drew something and it did not arrive — silently dropping it
  // leaves them with no way to know why.
  it('refuses a sketch that is not a PNG data URL, rather than dropping it', () => {
    const bad = { ...validMark, sketch: 'data:image/gif;base64,AAAA' };
    expect(parseFeedbackPayload({ ...validPayload, marks: [bad] }).ok).toBe(false);
    const huge = { ...validMark, sketch: PNG_DATA_URL_PREFIX + 'a'.repeat(MAX_SKETCH_CHARS) };
    expect(parseFeedbackPayload({ ...validPayload, marks: [huge] }).ok).toBe(false);
  });
});

describe('renderNoteMarkdown — an agent can identify the element', () => {
  const at = new Date(2026, 7, 2, 14, 32, 7);
  const payload = parseFeedbackPayload(validPayload);
  if (!payload.ok) throw new Error('fixture must parse');

  it('carries the memo, the component chain and the class list', () => {
    const md = renderNoteMarkdown(payload.value, { at, imageFile: 'shot.png' });
    expect(md).toContain('이 배지가 글자를 잘라먹음');
    expect(md).toContain('Badge');
    expect(md).toContain('VariableBusPage');
    expect(md).toContain('bg-card');
    expect(md).toContain('bus-var-row');
    expect(md).toContain('shot.png');
  });

  // Contrast findings are theme-specific in this app; a shot without its theme
  // sends the reader to the wrong half of global.css.
  it('records which theme the screen was in', () => {
    const md = renderNoteMarkdown(payload.value, { at, imageFile: 'shot.png' });
    expect(md).toContain('dark');
  });

  it('says so when the screenshot failed instead of pointing at a missing file', () => {
    const md = renderNoteMarkdown(payload.value, { at, imageFile: null });
    expect(md).not.toContain('shot.png');
    expect(md.length).toBeGreaterThan(0);
  });

  // A pin is a point, not an area. Without that word a 22px badge box reads as
  // "this much of the screen is the problem".
  it('describes a pin as a point and a shape as an area', () => {
    const pin = parseFeedbackPayload({
      ...validPayload,
      marks: [{ ...validMark, kind: 'pin', bounds: { x: 100, y: 100, width: 22, height: 22 } }],
    });
    if (!pin.ok) throw new Error('fixture must parse');
    const md = renderNoteMarkdown(pin.value, { at, imageFile: null });
    expect(md).toContain('한 점');
    expect(md).not.toContain('표시한 영역');

    const shape = renderNoteMarkdown(payload.value, { at, imageFile: null });
    expect(shape).toContain('표시한 영역');
  });

  it('points at the attached sketch file', () => {
    const withSketch = parseFeedbackPayload({
      ...validPayload,
      marks: [{ ...validMark, sketch: PNG }],
    });
    if (!withSketch.ok) throw new Error('fixture must parse');
    const md = renderNoteMarkdown(withSketch.value, { at, imageFile: null });
    expect(md).toContain('sketch-1.png');
  });
});
