/**
 * Pure logic of the dev-only screen feedback tool: folder naming, payload
 * validation, badge geometry, and the `note.md` an agent reads.
 *
 * It lives in `shared/` because both sides need it — the renderer draws the
 * badges, the main process writes the files — and neither may import the
 * other. Nothing here touches the DOM, the filesystem or Electron.
 *
 * Three containers nest: a **flow** (several screens) holds **groups** (one
 * message each) holds **marks** (one stroke or one pinned point each). Groups
 * and screens cross: one message can span several screens, and one screen can
 * carry several messages.
 *
 * Why it is split out at all: this tool is worth exactly as much as the
 * question "can an agent read what was left and find the code". A colliding
 * folder name silently overwrites feedback and a malformed `note.md` makes it
 * unreadable — neither can be pinned by a test if the logic is tangled up with
 * the DOM and `fs`.
 */

export type FeedbackRect = { x: number; y: number; width: number; height: number };

/** What was actually under the mark. This, not the coordinates, is the address of the code. */
export type FeedbackTarget = {
  tag: string;
  className: string;
  testId: string | null;
  text: string;
  cssPath: string;
  /** React component names, innermost first. The shortest path to the source file. */
  components: string[];
  rect: FeedbackRect;
};

/** The gesture decides the kind: a tap is a point (pin), a drag is an area (shape). */
export type FeedbackMarkKind = 'pin' | 'shape';

/** One mark inside a group — a stroke (or a pinned spot) and what it pointed at. */
export type FeedbackMarkPart = {
  /** For a pin, `bounds` is a **position**, not an area (a badge-sized square). */
  kind: FeedbackMarkKind;
  bounds: FeedbackRect;
  target: FeedbackTarget | null;
  /**
   * Which step (screen) it was drawn on, from 1.
   *
   * The coordinates are in **that screen's viewport**. Without this, something
   * drawn on screen A points at an unrelated spot on screen B — which is
   * exactly the failure that made a flow necessary.
   */
  step: number;
};

/**
 * One leg of the flow = one screen.
 *
 * A step is added every time the user freezes the current screen with "next
 * screen". Coming back to the same route later is still a new step: the screen
 * may look the same, but what happened before it is different.
 */
export type FeedbackStep = {
  /** Position in the flow, from 1. Reordering the flow changes this. */
  index: number;
  route: string;
  /** This step's screenshot. Null when the capture failed. */
  imageFile: string | null;
  viewport: { width: number; height: number };
  /**
   * Which theme this screen was in. Contrast problems here are theme-specific,
   * so a screenshot without its theme sends the reader to the wrong half of
   * `global.css`. It sits on the step, not the payload — the topbar can switch
   * theme halfway through a flow.
   */
  theme: 'light' | 'dark' | null;
};

/**
 * A group: one memo covering one or more marks.
 *
 * Why a group and not a mark: "move this card into that list" needs an arrow,
 * a box and a pin to say once. With a memo per mark the user writes the same
 * sentence three times, or two marks land with no memo at all and nobody can
 * tell what they meant.
 *
 * The element is captured **per mark**, never for the group: one rectangle
 * around the whole group measures the huge wrapper between the marks, which is
 * the failure the pin was introduced to remove.
 */
export type FeedbackMark = {
  memo: string;
  /** The marks in this group. At least one. */
  parts: FeedbackMarkPart[];
  /** File name of the attached proposal drawing. The bytes never live here —
   *  they would make note.json unopenable and store the picture twice. */
  sketchFile: string | null;
};

export type FeedbackPayload = {
  /** The first step's screen. The folder is named after it — the flow started there. */
  route: string;
  /** The flow. At least one; a single-screen round is a flow of length 1. */
  steps: FeedbackStep[];
  marks: FeedbackMark[];
};

/**
 * What crosses IPC. It differs from `FeedbackPayload` in two places: a group
 * carries the drawing itself on the way in (`sketch`) and only its file name on
 * the way out, and a step says `hasImage` rather than naming a file — the file
 * name is minted by the writer, because a name off the wire is a path.
 */
export type FeedbackStepInput = {
  route: string;
  viewport: { width: number; height: number };
  theme: 'light' | 'dark' | null;
  hasImage: boolean;
};

export type FeedbackMarkInput = {
  memo: string;
  sketch: string | null;
  parts: Array<{
    kind: FeedbackMarkKind;
    bounds: FeedbackRect;
    target: FeedbackTarget | null;
    step: number;
  }>;
};

export type FeedbackRequest = {
  /** The draft folder this flow has been collecting into. */
  draft: string;
  /** Capture order of each step, in flow order. The writer renames files with it. */
  seqs: number[];
  steps: FeedbackStepInput[];
  marks: FeedbackMarkInput[];
};

/** Freezing the current screen into the draft. The image is taken by the writer. */
export type FeedbackStepRequest = {
  /** Null on the first screen — the writer mints the draft folder then. */
  draft: string | null;
  /** Capture order of this screen, from 1. Never reused, even after a reorder. */
  seq: number;
  route: string;
};

export type FeedbackStepResult = { ok: true; draft: string } | { ok: false; error: string };
/** What the renderer gets back: where it landed, or why it did not. */
export type FeedbackSaveResult = { ok: true; saved: string } | { ok: false; error: string };

/** One drawing for the writer to put on disk. Validation names it; the writer writes it. */
export type ParsedSketch = { file: string; dataUrl: string };

export type ParseResult =
  | { ok: true; value: FeedbackPayload; sketches: ParsedSketch[] }
  | { ok: false; error: string };

/** Sketches arrive as PNG data URLs. Nothing else is accepted. */
export const PNG_DATA_URL_PREFIX = 'data:image/png;base64,';
/** Ceiling for one sketch. White board, a few strokes — it has no reason to be large. */
export const MAX_SKETCH_CHARS = 8 * 1024 * 1024;

/** Is this a PNG data URL? Format and size both. */
export function isPngDataUrl(v: unknown, maxChars: number): v is string {
  return typeof v === 'string' && v.startsWith(PNG_DATA_URL_PREFIX) && v.length <= maxChars;
}

/** File name of the drawing attached to group N. The number matches the badge (①→1). */
export function sketchFileName(index: number): string {
  return `sketch-${index + 1}.png`;
}

/**
 * Screen image name while the draft is still filling up — **capture order**.
 *
 * Why it differs from the final name (`shot-N.png`): the user can reorder the
 * flow, so capture order and step order drift apart. Renaming files during
 * collection means moving something already written every time the order
 * changes; instead they pile up in capture order and are renamed **once**, on
 * send.
 */
export function draftShotFileName(captureSeq: number): string {
  return `screen-${captureSeq}.png`;
}

/** Final screen image name — flow order (step 1 is `shot-1.png`). */
export function shotFileName(step: number): string {
  return `shot-${step}.png`;
}

/** The circled number on a group. Screen badge and note.md use the same symbol. */
const MARK_LABELS = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';

export function markLabel(index: number): string {
  return MARK_LABELS[index] ?? `(${index + 1})`;
}

/** Radius of the number badge. Screen SVG and hit testing must read one value. */
export const BADGE_RADIUS = 11;
// A finger cannot land on an exact 11px circle. Widen the hit test only.
const BADGE_TOUCH_SLACK = 5;

/** Where the badge is drawn: on the top-left corner of the mark. */
export function badgeCenter(bounds: FeedbackRect): { x: number; y: number } {
  return { x: bounds.x + BADGE_RADIUS, y: bounds.y + BADGE_RADIUS };
}

/**
 * Is (x, y) inside this mark's badge? The distance to its centre if so, else
 * null. Reopening a memo and erasing a mark must measure with the same ruler.
 */
export function badgeContains(bounds: FeedbackRect, x: number, y: number): number | null {
  const c = badgeCenter(bounds);
  const d = Math.hypot(x - c.x, y - c.y);
  return d <= BADGE_RADIUS + BADGE_TOUCH_SLACK ? d : null;
}

/**
 * The badge under (x, y) — which group, and which of its marks. Null if none.
 * When badges overlap the later one wins: that is the one visible on top.
 *
 * **Every mark in a group wears the same number**, so tapping any of them opens
 * the same memo — three ① badges on screen mean those three are one story.
 */
export function badgeHit<
  T extends { id: number; parts: readonly { bounds: FeedbackRect; screen?: number }[] },
>(marks: readonly T[], x: number, y: number, onScreen?: number): { id: number; part: number } | null {
  for (let i = marks.length - 1; i >= 0; i -= 1) {
    const parts = marks[i].parts;
    for (let p = parts.length - 1; p >= 0; p -= 1) {
      // Only this screen's marks. One from an earlier screen is invisible here,
      // so hitting it would be touching a ghost — and its coordinates are in
      // another viewport anyway.
      //
      // The field is `screen` and not `step` on purpose: that is what a mark
      // being drawn carries (a screen's identity, not its place in the flow),
      // and `partHit` filters by the same name. Named `step` here it would
      // still type-check — the field is optional — and silently read undefined
      // on every mark, so no badge would ever be hit.
      if (onScreen !== undefined && parts[p].screen !== onScreen) continue;
      if (badgeContains(parts[p].bounds, x, y) !== null) return { id: marks[i].id, part: p };
    }
  }
  return null;
}

/**
 * Turns a route into a folder fragment. Every separator and special character
 * has to go, or a route carrying `..` or `/` walks the save location out of
 * `.harness/feedback/`.
 */
export function slugifyRoute(route: string): string {
  const slug = route
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return slug || 'root';
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

/** Human-readable stamp, in local time — the clock of whoever left the feedback. */
export function formatStamp(at: Date): string {
  return (
    `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ` +
    `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`
  );
}

/**
 * Name of the save folder. Seconds are in it so that two rounds of feedback on
 * the same screen do not silently overwrite each other.
 */
export function feedbackFolderName(at: Date, route: string): string {
  const date = `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}`;
  const time = `${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`;
  return `${date}-${time}-${slugifyRoute(route)}`;
}

/**
 * Where feedback that is still being collected lives.
 *
 * Why on disk at all: walking through several screens takes minutes, and the
 * dev server repaints the page on every save — which is precisely what one is
 * doing when this tool is wanted. Held in memory, one reload throws away
 * several screens' worth of work.
 *
 * The leading underscore is the point of the name: the "read the newest folder"
 * habit must be visibly steered away from a round that has not been sent yet.
 */
export const DRAFT_PREFIX = '_draft-';

export function draftFolderName(at: Date, route: string): string {
  return `${DRAFT_PREFIX}${feedbackFolderName(at, route)}`;
}

/**
 * Is this draft name one we could have minted?
 *
 * The value becomes a path segment, so the **whole shape** is checked — a
 * `..` or a `/` slipped in here writes outside `.harness/feedback`. A
 * whitelist is the only safe form of this test.
 */
export function isDraftFolderName(v: unknown): v is string {
  return typeof v === 'string' && /^_draft-\d{8}-\d{6}-[a-z0-9-]{1,40}$/.test(v);
}

/** The final name for a finished draft. The time stays the time the flow began. */
export function finalFolderName(draft: string): string {
  return draft.slice(DRAFT_PREFIX.length);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function str(v: unknown, max = 2000): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

function parseRect(v: unknown): FeedbackRect | null {
  if (!isRecord(v)) return null;
  const x = num(v.x);
  const y = num(v.y);
  const width = num(v.width);
  const height = num(v.height);
  if (x === null || y === null || width === null || height === null) return null;
  return { x, y, width, height };
}

function parseTarget(v: unknown): FeedbackTarget | null {
  if (!isRecord(v)) return null;
  const rect = parseRect(v.rect);
  if (!rect) return null;
  const components = Array.isArray(v.components)
    ? v.components.filter((c): c is string => typeof c === 'string').slice(0, 8)
    : [];
  return {
    tag: str(v.tag, 40) || 'unknown',
    className: str(v.className, 400),
    testId: typeof v.testId === 'string' ? v.testId.slice(0, 120) : null,
    text: str(v.text, 200),
    cssPath: str(v.cssPath, 600),
    components,
    rect,
  };
}

function parsePart(v: unknown, stepCount: number): FeedbackMarkPart | null {
  if (!isRecord(v)) return null;
  const bounds = parseRect(v.bounds);
  if (!bounds) return null;
  // A step outside the flow would put a coordinate on a screenshot that does
  // not exist. Fall back to the first screen rather than refusing the round.
  const rawStep = num(v.step);
  const step = rawStep !== null && rawStep >= 1 && rawStep <= stepCount ? Math.round(rawStep) : 1;
  return { kind: v.kind === 'pin' ? 'pin' : 'shape', bounds, target: parseTarget(v.target), step };
}

/**
 * One leg of the flow. `imageFile` is **not taken from the renderer** — the
 * writer names its own files and only asks here whether there was an image.
 * Accepting the name would be the same path-traversal hole by another door.
 */
function parseStep(v: unknown, index: number): FeedbackStep | null {
  if (!isRecord(v)) return null;
  const route = str(v.route, 300);
  if (!route.startsWith('/')) return null;
  const viewport = isRecord(v.viewport)
    ? { width: num(v.viewport.width), height: num(v.viewport.height) }
    : null;
  if (!viewport || viewport.width === null || viewport.height === null) return null;
  return {
    index,
    route,
    imageFile: v.hasImage === true ? shotFileName(index) : null,
    viewport: { width: viewport.width, height: viewport.height },
    // An unrecognised theme is a hint we lose, not an address — not worth
    // refusing a round of feedback over.
    theme: v.theme === 'light' || v.theme === 'dark' ? v.theme : null,
  };
}

/** Ceiling on groups. Nobody leaves twenty messages in one round, and there are twenty badges. */
const MAX_MARKS = 20;
/**
 * Marks allowed in one group — far above the group ceiling on purpose. The pen
 * adds one every time the hand lifts, so explaining a single request can pass
 * twenty in seconds. Being stingy here refuses the user at the very moment
 * they press send, with everything already drawn.
 */
const MAX_PARTS = 60;
/** Flow ceiling. A story that needs a dozen screens is better written as prose. */
const MAX_STEPS = 12;

export function parseFeedbackPayload(raw: unknown): ParseResult {
  if (!isRecord(raw)) return { ok: false, error: '본문이 객체가 아닙니다' };

  if (!Array.isArray(raw.steps) || raw.steps.length === 0) {
    return { ok: false, error: '화면이 하나도 없습니다' };
  }
  if (raw.steps.length > MAX_STEPS) {
    return { ok: false, error: `화면은 최대 ${MAX_STEPS}개까지입니다` };
  }
  const steps: FeedbackStep[] = [];
  for (const [i, rawStep] of raw.steps.entries()) {
    const step = parseStep(rawStep, i + 1);
    if (!step) return { ok: false, error: `${i + 1}번째 화면 정보가 잘못됐습니다` };
    steps.push(step);
  }
  const route = steps[0].route;

  if (!Array.isArray(raw.marks) || raw.marks.length === 0) {
    return { ok: false, error: '표시가 하나도 없습니다' };
  }
  if (raw.marks.length > MAX_MARKS) {
    return { ok: false, error: `묶음은 최대 ${MAX_MARKS}개까지입니다` };
  }

  const marks: FeedbackMark[] = [];
  const sketches: ParsedSketch[] = [];
  for (const [i, m] of raw.marks.entries()) {
    if (!isRecord(m)) return { ok: false, error: '표시 형식이 잘못됐습니다' };
    if (!Array.isArray(m.parts) || m.parts.length === 0) {
      return { ok: false, error: `${markLabel(i)} 묶음에 표시가 없습니다` };
    }
    if (m.parts.length > MAX_PARTS) {
      return { ok: false, error: `${markLabel(i)} 묶음의 표시는 최대 ${MAX_PARTS}개까지입니다` };
    }
    const parts: FeedbackMarkPart[] = [];
    for (const rawPart of m.parts) {
      const part = parsePart(rawPart, steps.length);
      if (!part) return { ok: false, error: '표시 영역이 잘못됐습니다' };
      parts.push(part);
    }
    // A drawing is validated only when there is one. A malformed one is
    // refused rather than dropped: the user drew it, and if the file simply
    // never appears there is no way for them to learn why.
    let sketchFile: string | null = null;
    if (m.sketch != null && m.sketch !== '') {
      if (!isPngDataUrl(m.sketch, MAX_SKETCH_CHARS)) {
        return { ok: false, error: `${markLabel(i)} 묶음의 그림 형식이 잘못됐습니다` };
      }
      sketchFile = sketchFileName(i);
      sketches.push({ file: sketchFile, dataUrl: m.sketch });
    }
    marks.push({ memo: str(m.memo, 1000), parts, sketchFile });
  }

  return { ok: true, value: { route, steps, marks }, sketches };
}

function round(n: number): number {
  return Math.round(n);
}

/** Where one mark is. A pin is a position, not an area — unsaid, the 22px badge
 *  box reads as "this much of the screen is the problem". */
function geometryLine(part: FeedbackMarkPart): string {
  const b = part.bounds;
  if (part.kind === 'pin') {
    return `콕 집은 자리: x=${round(b.x + b.width / 2)} y=${round(b.y + b.height / 2)} (영역이 아니라 한 점)`;
  }
  return `표시한 영역: x=${round(b.x)} y=${round(b.y)} (${round(b.width)} × ${round(b.height)})`;
}

/** What the mark pointed at — this, not the coordinates, is the address of the code. */
function targetLines(t: FeedbackTarget | null): string[] {
  if (!t) return ['가리킨 요소: 찾지 못함 (빈 자리를 표시했을 수 있음)'];
  const out = [`가리킨 요소: \`<${t.tag}>\`${t.className ? ` \`${t.className}\`` : ''}`];
  if (t.components.length > 0) out.push(`컴포넌트: ${t.components.join(' ‹ ')}`);
  if (t.testId) out.push(`테스트 아이디: \`${t.testId}\``);
  if (t.text) out.push(`보이던 글자: "${t.text}"`);
  if (t.cssPath) out.push(`CSS 경로: \`${t.cssPath}\``);
  return out;
}

/** Step tag in front of a mark. Pure noise when the flow is a single screen. */
function stepTag(part: FeedbackMarkPart, steps: FeedbackStep[]): string {
  if (steps.length < 2) return '';
  const step = steps.find((s) => s.index === part.step) ?? steps[0];
  return `[${step.index}단계 ${step.route}] `;
}

/**
 * The summary an agent reads. Written so that this one file answers both
 * "what is wrong where" and "which component is that".
 *
 * Korean, like everything under `docs/` — this is a document for the person
 * who left the feedback and the agent that picks it up, not app UI.
 */
export function renderNoteMarkdown(payload: FeedbackPayload, opts: { at: Date }): string {
  const { steps, marks } = payload;
  const multi = steps.length > 1;
  const lines: string[] = [];
  lines.push(`# 화면 피드백 · ${payload.route}${multi ? ` 외 화면 ${steps.length - 1}개` : ''}`);
  lines.push('');
  lines.push(`- 남긴 시각: ${formatStamp(opts.at)}`);
  lines.push('');

  // The flow comes first when there is more than one screen: "I did this on 1
  // and then 2 did not happen" is the spine of the feedback, and the order is
  // that story.
  if (multi) {
    lines.push(`## 흐름 (화면 ${steps.length}개)`);
    lines.push('');
    lines.push('유저가 화면을 옮겨 가며 남긴 하나의 이야기다. 순서대로 읽는다.');
    lines.push('');
    for (const step of steps) {
      const on = marks
        .map((m, i) => (m.parts.some((p) => p.step === step.index) ? markLabel(i) : null))
        .filter((label): label is string => label !== null);
      const image = step.imageFile ?? '그림 없음 (캡처 실패)';
      const size = `${round(step.viewport.width)} × ${round(step.viewport.height)}`;
      lines.push(
        `${step.index}. \`${step.route}\` · ${image} · 창 ${size} · 테마 ${step.theme ?? '알 수 없음'}` +
          (on.length > 0 ? ` · 표시 ${on.join(' ')}` : ' · (표시 없음)'),
      );
    }
    lines.push('');
  } else {
    const only = steps[0];
    lines.push(`- 창 크기: ${round(only.viewport.width)} × ${round(only.viewport.height)}`);
    lines.push(`- 테마: ${only.theme ?? '알 수 없음'}`);
    if (only.imageFile) {
      lines.push(`- 화면 이미지: ${only.imageFile} (표시가 그려진 그대로)`);
    } else {
      lines.push('- 화면 이미지: 없음 (캡처 실패, 아래 좌표와 요소 정보로 판단할 것)');
    }
    lines.push('');
  }

  marks.forEach((mark, i) => {
    const memo = mark.memo.trim() || '(메모 없음)';
    const label = markLabel(i);
    lines.push(`## ${label} ${memo}`);
    lines.push('');
    // Say up front when a group holds several marks. Unsaid, the note reads as
    // being about one arrow, and everything else the user pointed at with it
    // breaks off into a separate story.
    const grouped = mark.parts.length > 1;
    const spans = new Set(mark.parts.map((p) => p.step)).size;
    if (grouped) {
      lines.push(
        `- 아래 표시 ${mark.parts.length}개가 **한 요청**이다 (화면과 그림에도 ${label} 배지가 ${mark.parts.length}개 다 붙어 있다)` +
          // A request that crosses screens means "do this on A and B goes
          // wrong". Unsaid, the reader hunts for every coordinate in one image.
          (spans > 1 ? ` · **화면 ${spans}개에 걸쳐 있다** (각 표시의 단계를 보라)` : ''),
      );
    }
    if (mark.sketchFile) {
      lines.push(`- 제안 그림: ${mark.sketchFile} (유저가 "이렇게 생겼으면 좋겠다"고 직접 그린 것)`);
    }
    mark.parts.forEach((part, pi) => {
      const tag = stepTag(part, steps);
      // A one-mark group stays flat, the way it always read — that is the
      // common case, and dressing it up makes the common case the harder one.
      if (!grouped) {
        lines.push(`- ${tag}${geometryLine(part)}`);
        for (const line of targetLines(part.target)) lines.push(`- ${line}`);
        return;
      }
      lines.push(`- ${pi + 1}) ${tag}${geometryLine(part)}`);
      for (const line of targetLines(part.target)) lines.push(`  - ${line}`);
    });
    lines.push('');
  });

  return lines.join('\n');
}
