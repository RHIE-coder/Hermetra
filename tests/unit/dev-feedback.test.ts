import { describe, it, expect } from 'vitest';
import {
  BADGE_RADIUS,
  MAX_SKETCH_CHARS,
  PNG_DATA_URL_PREFIX,
  badgeCenter,
  badgeHit,
  draftFolderName,
  draftShotFileName,
  feedbackFolderName,
  finalFolderName,
  isDraftFolderName,
  markLabel,
  parseFeedbackPayload,
  renderNoteMarkdown,
  shotFileName,
  sketchFileName,
  slugifyRoute,
} from '@shared/dev-feedback';

/**
 * Pure logic of the dev-only screen feedback tool.
 *
 * The whole value of this tool is "does what the user left survive intact and
 * can an agent read it". Three containers nest inside each other — a flow
 * (several screens) holds groups (one message each) holds marks (one stroke or
 * pin each) — and most of what is pinned here is that nothing silently falls
 * out of one of them.
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

describe('draft folders — what is still being collected', () => {
  const at = new Date(2026, 7, 10, 9, 5, 3);

  // The "read the newest folder" habit must not land on an unfinished draft.
  it('marks a draft with a prefix that sorts and reads as unfinished', () => {
    expect(draftFolderName(at, '/bridge/bus')).toBe('_draft-20260810-090503-bridge-bus');
  });

  it('drops the prefix to get the final name, keeping the start time', () => {
    expect(finalFolderName('_draft-20260810-090503-bridge-bus')).toBe('20260810-090503-bridge-bus');
  });

  // The draft name comes back from the renderer and becomes a path segment, so
  // the shape is checked whole — a substring rule would let `..` through.
  it('accepts only names it could have minted itself', () => {
    expect(isDraftFolderName('_draft-20260810-090503-bridge-bus')).toBe(true);
    expect(isDraftFolderName('_draft-20260810-090503-root')).toBe(true);
    expect(isDraftFolderName('20260810-090503-bridge-bus')).toBe(false);
    expect(isDraftFolderName('_draft-../../etc/passwd')).toBe(false);
    expect(isDraftFolderName('_draft-20260810-090503-bridge/bus')).toBe(false);
    expect(isDraftFolderName('_draft-2026-09-bus')).toBe(false);
    expect(isDraftFolderName(null)).toBe(false);
  });

  // Screens are written as they are captured but read in flow order, and the
  // user can reorder the flow before sending. Two namings, renamed once at the
  // end, so no already-written file is ever moved twice.
  it('names a screen by capture order while collecting and by step when finished', () => {
    expect(draftShotFileName(2)).toBe('screen-2.png');
    expect(shotFileName(1)).toBe('shot-1.png');
  });
});

describe('badgeHit — every mark in a group wears the same badge', () => {
  const part = (x: number, y: number, screen = 1) => ({
    bounds: { x, y, width: 60, height: 40 },
    screen,
  });
  const marks = [
    { id: 1, parts: [part(100, 100), part(400, 100)] },
    { id: 2, parts: [part(300, 300)] },
  ];

  it('finds which group and which of its marks was tapped', () => {
    const c = badgeCenter(marks[0].parts[1].bounds);
    expect(badgeHit(marks, c.x, c.y)).toEqual({ id: 1, part: 1 });
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
    const c = badgeCenter(marks[1].parts[0].bounds);
    expect(badgeHit(marks, c.x + BADGE_RADIUS + 3, c.y)).toEqual({ id: 2, part: 0 });
  });

  // Marks from an earlier screen are not on the glass any more — their
  // coordinates belong to a picture that is already baked.
  it('ignores marks that belong to another screen', () => {
    const across = [{ id: 1, parts: [part(100, 100, 1), part(100, 100, 2)] }];
    expect(badgeHit(across, 111, 111, 2)).toEqual({ id: 1, part: 1 });
    expect(badgeHit(across, 111, 111, 3)).toBeNull();
  });

  // The screen filter reads the field a mark being drawn actually carries. Ask
  // for a field it does not have and every comparison is against undefined —
  // no badge is ever hit, and nothing about it fails to compile.
  it('filters on the field a drawn mark carries, not the saved one', () => {
    const saved = [{ id: 1, parts: [{ bounds: { x: 0, y: 0, width: 22, height: 22 }, step: 1 }] }];
    expect(badgeHit(saved, 11, 11, 1)).toBeNull();
    expect(badgeHit([{ id: 1, parts: [part(0, 0, 1)] }], 11, 11, 1)).toEqual({ id: 1, part: 0 });
  });
});

describe('markLabel', () => {
  it('numbers groups with the same symbols the badge draws', () => {
    expect(markLabel(0)).toBe('①');
    expect(markLabel(19)).toBe('⑳');
  });
});

const target = {
  tag: 'span',
  className: 'rounded-full bg-card px-2.5 py-1',
  testId: 'bus-var-row',
  text: 'session.token',
  cssPath: 'main > div:nth-of-type(2) > span',
  components: ['Badge', 'VariableBusPage', 'AppShell'],
  rect: { x: 10, y: 20, width: 80, height: 24 },
};

const part = (over: Record<string, unknown> = {}) => ({
  kind: 'shape',
  bounds: { x: 10, y: 20, width: 80, height: 24 },
  target,
  step: 1,
  ...over,
});

const request = (over: Record<string, unknown> = {}) => ({
  steps: [{ route: '/bridge/bus', viewport: { width: 1320, height: 880 }, theme: 'dark', hasImage: true }],
  marks: [{ memo: '이 배지가 글자를 잘라먹음', parts: [part()], sketch: null }],
  ...over,
});

describe('parseFeedbackPayload — a sound payload gets through', () => {
  it('accepts a one-screen flow and takes the folder route from its first step', () => {
    const r = parseFeedbackPayload(request());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.route).toBe('/bridge/bus');
    expect(r.value.steps).toHaveLength(1);
    expect(r.value.steps[0]).toMatchObject({ index: 1, imageFile: 'shot-1.png', theme: 'dark' });
    expect(r.value.marks[0].parts[0].target?.components).toEqual([
      'Badge',
      'VariableBusPage',
      'AppShell',
    ]);
  });

  // The file name is minted by the writer, never accepted from the renderer —
  // a name off the wire is a path-traversal hole by another route.
  it('names the screen image itself and only takes "was there one"', () => {
    const r = parseFeedbackPayload(
      request({
        steps: [
          { route: '/web/remote', viewport: { width: 1320, height: 880 }, hasImage: true },
          { route: '/mobile/devices', viewport: { width: 1320, height: 880 }, hasImage: false },
        ],
        marks: [{ memo: 'a', parts: [part(), part({ step: 2 })], sketch: null }],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.steps.map((s) => s.imageFile)).toEqual(['shot-1.png', null]);
    expect(JSON.stringify(r.value)).not.toContain('screen-');
  });

  it('keeps a group whose memo is empty and a mark whose element was not found', () => {
    const r = parseFeedbackPayload(
      request({ marks: [{ memo: '', parts: [part({ target: null })], sketch: null }] }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.marks[0].parts[0].target).toBeNull();
  });

  it('defaults an unknown theme to null instead of rejecting the screen', () => {
    const r = parseFeedbackPayload(
      request({ steps: [{ route: '/bridge/bus', viewport: { width: 1, height: 1 }, theme: 'sepia' }] }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.steps[0].theme).toBeNull();
  });

  // A mark pointing at a step that is not in the flow would render as a
  // coordinate on a screenshot that does not exist.
  it('pulls a mark with an out-of-range step back to the first screen', () => {
    const r = parseFeedbackPayload(request({ marks: [{ memo: 'a', parts: [part({ step: 9 })] }] }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.marks[0].parts[0].step).toBe(1);
  });

  it('names a sketch after its group and hands the bytes to the caller', () => {
    const r = parseFeedbackPayload(
      request({
        marks: [
          { memo: 'a', parts: [part()], sketch: PNG },
          { memo: 'b', parts: [part()], sketch: null },
        ],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.marks[0].sketchFile).toBe(sketchFileName(0));
    expect(r.value.marks[1].sketchFile).toBeNull();
    expect(r.sketches).toEqual([{ file: 'sketch-1.png', dataUrl: PNG }]);
    // The base64 never goes into note.json — it would make the file unopenable
    // and store the same picture twice.
    expect(JSON.stringify(r.value)).not.toContain('iVBORw0KGgo');
  });
});

describe('parseFeedbackPayload — a broken request is refused', () => {
  it('refuses a non-object body', () => {
    expect(parseFeedbackPayload('nope').ok).toBe(false);
    expect(parseFeedbackPayload(null).ok).toBe(false);
  });

  it('refuses a flow with no screens', () => {
    expect(parseFeedbackPayload(request({ steps: [] })).ok).toBe(false);
  });

  it('refuses a screen with a missing or relative route, or no viewport', () => {
    expect(parseFeedbackPayload(request({ steps: [{ route: 'bridge/bus', viewport: { width: 1, height: 1 } }] })).ok).toBe(false);
    expect(parseFeedbackPayload(request({ steps: [{ route: '/a', viewport: null }] })).ok).toBe(false);
    expect(parseFeedbackPayload(request({ steps: [{ route: '/a', viewport: { width: 1 } }] })).ok).toBe(false);
  });

  it('refuses a flow longer than a story worth drawing', () => {
    const many = Array.from({ length: 13 }, () => ({
      route: '/bridge/bus',
      viewport: { width: 1, height: 1 },
    }));
    expect(parseFeedbackPayload(request({ steps: many })).ok).toBe(false);
  });

  // NaN / Infinity in a coordinate turns note.md into unreadable values.
  it('refuses non-finite coordinates', () => {
    const bad = part({ bounds: { x: 0, y: 0, width: Number.NaN, height: 10 } });
    expect(parseFeedbackPayload(request({ marks: [{ memo: 'a', parts: [bad] }] })).ok).toBe(false);
  });

  it('refuses an empty group list and a group with no marks', () => {
    expect(parseFeedbackPayload(request({ marks: [] })).ok).toBe(false);
    expect(parseFeedbackPayload(request({ marks: [{ memo: 'a', parts: [] }] })).ok).toBe(false);
  });

  it('refuses too many groups', () => {
    const many = Array.from({ length: 21 }, () => ({ memo: 'a', parts: [part()] }));
    expect(parseFeedbackPayload(request({ marks: many })).ok).toBe(false);
  });

  // The pen adds a mark every time the hand lifts, so a group's ceiling has to
  // be far above the group ceiling — being stingy here refuses the user at the
  // very moment they press send.
  it('allows many marks in one group but not without limit', () => {
    const parts = (n: number) => Array.from({ length: n }, () => part());
    expect(parseFeedbackPayload(request({ marks: [{ memo: 'a', parts: parts(60) }] })).ok).toBe(true);
    expect(parseFeedbackPayload(request({ marks: [{ memo: 'a', parts: parts(61) }] })).ok).toBe(false);
  });

  // The user drew something and it did not arrive — silently dropping it
  // leaves them with no way to know why.
  it('refuses a sketch that is not a PNG data URL, rather than dropping it', () => {
    const bad = { memo: 'a', parts: [part()], sketch: 'data:image/gif;base64,AAAA' };
    expect(parseFeedbackPayload(request({ marks: [bad] })).ok).toBe(false);
    const huge = { memo: 'a', parts: [part()], sketch: PNG_DATA_URL_PREFIX + 'a'.repeat(MAX_SKETCH_CHARS) };
    expect(parseFeedbackPayload(request({ marks: [huge] })).ok).toBe(false);
  });
});

describe('renderNoteMarkdown — one screen', () => {
  const at = new Date(2026, 7, 10, 14, 32, 7);
  const parsed = parseFeedbackPayload(request());
  if (!parsed.ok) throw new Error('fixture must parse');

  it('carries the memo, the component chain, the class list and the theme', () => {
    const md = renderNoteMarkdown(parsed.value, { at });
    expect(md).toContain('이 배지가 글자를 잘라먹음');
    expect(md).toContain('VariableBusPage');
    expect(md).toContain('bg-card');
    expect(md).toContain('bus-var-row');
    expect(md).toContain('shot-1.png');
    expect(md).toContain('dark');
  });

  // Most feedback is one screen. A flow section and step tags on top of that
  // would make the common case the harder one to read.
  it('writes no flow section and no step tags for a single screen', () => {
    const md = renderNoteMarkdown(parsed.value, { at });
    expect(md).not.toContain('## 흐름');
    expect(md).not.toContain('1단계');
  });

  it('says so when the screenshot failed instead of pointing at a missing file', () => {
    const noShot = parseFeedbackPayload(
      request({ steps: [{ route: '/bridge/bus', viewport: { width: 1, height: 1 }, hasImage: false }] }),
    );
    if (!noShot.ok) throw new Error('fixture must parse');
    const md = renderNoteMarkdown(noShot.value, { at });
    expect(md).not.toContain('shot-1.png');
    expect(md).toContain('캡처 실패');
  });

  // A pin is a point, not an area. Without that word a 22px badge box reads as
  // "this much of the screen is the problem".
  it('describes a pin as a point and a shape as an area', () => {
    const pin = parseFeedbackPayload(
      request({ marks: [{ memo: 'a', parts: [part({ kind: 'pin', bounds: { x: 100, y: 100, width: 22, height: 22 } })] }] }),
    );
    if (!pin.ok) throw new Error('fixture must parse');
    expect(renderNoteMarkdown(pin.value, { at })).toContain('한 점');
    expect(renderNoteMarkdown(parsed.value, { at })).toContain('표시한 영역');
  });
});

describe('renderNoteMarkdown — a group is one request', () => {
  const at = new Date(2026, 7, 10, 14, 32, 7);

  // Left unsaid, the note reads as being about the arrow alone and the box and
  // the pin the user drew with it fall out of the story.
  it('says up front that several marks are one request, and keeps one heading', () => {
    const grouped = parseFeedbackPayload(
      request({
        marks: [
          {
            memo: '이 카드를 저 목록으로 옮겨라',
            parts: [part(), part({ kind: 'pin' }), part()],
            sketch: null,
          },
        ],
      }),
    );
    if (!grouped.ok) throw new Error('fixture must parse');
    const md = renderNoteMarkdown(grouped.value, { at });
    expect(md.match(/^## /gm)).toHaveLength(1);
    expect(md).toContain('표시 3개가 **한 요청**');
    // Each mark still carries its own element — measuring the group's bounding
    // box would find the huge wrapper between the marks instead.
    expect(md.match(/가리킨 요소/g)).toHaveLength(3);
  });

  it('leaves a one-mark group written flat, the way it always was', () => {
    const one = parseFeedbackPayload(request());
    if (!one.ok) throw new Error('fixture must parse');
    expect(renderNoteMarkdown(one.value, { at })).not.toContain('한 요청');
  });
});

describe('renderNoteMarkdown — a flow across screens', () => {
  const at = new Date(2026, 7, 10, 14, 32, 7);
  const flow = parseFeedbackPayload({
    steps: [
      { route: '/web/remote', viewport: { width: 1320, height: 880 }, theme: 'light', hasImage: true },
      { route: '/mobile/devices', viewport: { width: 1320, height: 880 }, theme: 'light', hasImage: true },
    ],
    marks: [
      { memo: '여기서 발행한 값이', parts: [part({ step: 1 }), part({ step: 2 })], sketch: null },
      { memo: '이 화면에 안 온다', parts: [part({ step: 2 })], sketch: null },
    ],
  });
  if (!flow.ok) throw new Error('fixture must parse');

  // "I did this on 1 and then 2 did not happen" is the spine of this feedback,
  // and the order is the story — so it is read first.
  it('opens with the flow, in order, naming which groups touched each screen', () => {
    const md = renderNoteMarkdown(flow.value, { at });
    const flowAt = md.indexOf('## 흐름');
    const firstMark = md.indexOf('## ①');
    expect(flowAt).toBeGreaterThan(-1);
    expect(flowAt).toBeLessThan(firstMark);
    expect(md).toContain('/web/remote');
    expect(md).toContain('/mobile/devices');
    expect(md).toContain('shot-2.png');
  });

  it('tags every mark with the step it was drawn on', () => {
    const md = renderNoteMarkdown(flow.value, { at });
    expect(md).toContain('[1단계 /web/remote]');
    expect(md).toContain('[2단계 /mobile/devices]');
  });

  // Without this the reader assumes both marks are on one screenshot and hunts
  // for the second set of coordinates in the wrong picture.
  it('flags a group that spans screens', () => {
    const md = renderNoteMarkdown(flow.value, { at });
    expect(md).toContain('화면 2개에 걸쳐 있다');
  });

  it('titles the note with the first screen and how many more there are', () => {
    expect(renderNoteMarkdown(flow.value, { at })).toContain('# 화면 피드백 · /web/remote 외 화면 1개');
  });
});
