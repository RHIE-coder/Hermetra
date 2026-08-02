/**
 * Pure logic of the dev-only screen feedback tool: folder naming, payload
 * validation, badge geometry, and the `note.md` an agent reads.
 *
 * It lives in `shared/` because both sides need it — the renderer draws the
 * badges, the main process writes the files — and neither may import the
 * other. Nothing here touches the DOM, the filesystem or Electron.
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

export type FeedbackMark = {
  /** For a pin, `bounds` is a **position**, not an area (a badge-sized square). */
  kind: FeedbackMarkKind;
  memo: string;
  bounds: FeedbackRect;
  target: FeedbackTarget | null;
  /** File name of the attached proposal drawing. The bytes never live here —
   *  they would make note.json unopenable and store the picture twice. */
  sketchFile: string | null;
};

/**
 * What the renderer sends.
 *
 * There is no `scroll` and no `userAgent`, unlike the browser-side original
 * this was ported from: the app shell is a fixed, non-scrolling window and
 * there is exactly one browser engine, so both fields would be a constant.
 * `theme` replaces them — contrast problems in this app are theme-specific,
 * and a screenshot without its theme sends the reader to the wrong half of
 * `global.css`.
 */
export type FeedbackPayload = {
  route: string;
  viewport: { width: number; height: number };
  theme: 'light' | 'dark' | null;
  marks: FeedbackMark[];
};

/**
 * What crosses IPC. It differs from `FeedbackPayload` in one place: a mark
 * carries the drawing itself on the way in (`sketch`) and only its file name
 * on the way out (`sketchFile`).
 */
export type FeedbackMarkInput = {
  kind: FeedbackMarkKind;
  memo: string;
  bounds: FeedbackRect;
  target: FeedbackTarget | null;
  sketch: string | null;
};

export type FeedbackRequest = {
  route: string;
  viewport: { width: number; height: number };
  theme: 'light' | 'dark' | null;
  marks: FeedbackMarkInput[];
};

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

/** File name of the drawing attached to mark N. The number matches the badge (①→1). */
export function sketchFileName(index: number): string {
  return `sketch-${index + 1}.png`;
}

/** The circled number on a mark. Screen badge and note.md use the same symbol. */
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
 * Id of the badge under (x, y). When badges overlap the later one wins — that
 * is the one visible on top. Null when none is hit.
 */
export function badgeHit<T extends { id: number; bounds: FeedbackRect }>(
  marks: readonly T[],
  x: number,
  y: number,
): number | null {
  for (let i = marks.length - 1; i >= 0; i -= 1) {
    const c = badgeCenter(marks[i].bounds);
    if (Math.hypot(x - c.x, y - c.y) <= BADGE_RADIUS + BADGE_TOUCH_SLACK) return marks[i].id;
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

/** Ceiling on marks. Nobody leaves twenty in one round, and there are twenty badge symbols. */
const MAX_MARKS = 20;

export function parseFeedbackPayload(raw: unknown): ParseResult {
  if (!isRecord(raw)) return { ok: false, error: '본문이 객체가 아닙니다' };

  const route = str(raw.route, 300);
  if (!route.startsWith('/')) return { ok: false, error: 'route가 없습니다' };

  const viewport = isRecord(raw.viewport)
    ? { width: num(raw.viewport.width), height: num(raw.viewport.height) }
    : null;
  if (!viewport || viewport.width === null || viewport.height === null) {
    return { ok: false, error: 'viewport가 없습니다' };
  }

  // An unknown theme is not worth refusing feedback over — it is a hint, not
  // an address. Anything we do not recognise becomes "unknown".
  const theme = raw.theme === 'light' || raw.theme === 'dark' ? raw.theme : null;

  if (!Array.isArray(raw.marks) || raw.marks.length === 0) {
    return { ok: false, error: '표시가 하나도 없습니다' };
  }
  if (raw.marks.length > MAX_MARKS) {
    return { ok: false, error: `표시는 최대 ${MAX_MARKS}개까지입니다` };
  }

  const marks: FeedbackMark[] = [];
  const sketches: ParsedSketch[] = [];
  for (const [i, m] of raw.marks.entries()) {
    if (!isRecord(m)) return { ok: false, error: '표시 형식이 잘못됐습니다' };
    const bounds = parseRect(m.bounds);
    if (!bounds) return { ok: false, error: '표시 영역이 잘못됐습니다' };
    const kind: FeedbackMarkKind = m.kind === 'pin' ? 'pin' : 'shape';
    // A drawing is validated only when there is one. A malformed one is
    // refused rather than dropped: the user drew it, and if the file simply
    // never appears there is no way for them to learn why.
    let sketchFile: string | null = null;
    if (m.sketch != null && m.sketch !== '') {
      if (!isPngDataUrl(m.sketch, MAX_SKETCH_CHARS)) {
        return { ok: false, error: `${markLabel(i)} 표시의 그림 형식이 잘못됐습니다` };
      }
      sketchFile = sketchFileName(i);
      sketches.push({ file: sketchFile, dataUrl: m.sketch });
    }
    marks.push({ kind, memo: str(m.memo, 1000), bounds, target: parseTarget(m.target), sketchFile });
  }

  return {
    ok: true,
    value: { route, viewport: { width: viewport.width, height: viewport.height }, theme, marks },
    sketches,
  };
}

function round(n: number): number {
  return Math.round(n);
}

/**
 * The summary an agent reads. Written so that this one file answers both
 * "what is wrong where" and "which component is that".
 *
 * Korean, like everything under `docs/` — this is a document for the person
 * who left the feedback and the agent that picks it up, not app UI.
 */
export function renderNoteMarkdown(
  payload: FeedbackPayload,
  opts: { at: Date; imageFile: string | null },
): string {
  const lines: string[] = [];
  lines.push(`# 화면 피드백 · ${payload.route}`);
  lines.push('');
  lines.push(`- 남긴 시각: ${formatStamp(opts.at)}`);
  lines.push(`- 창 크기: ${round(payload.viewport.width)} × ${round(payload.viewport.height)}`);
  lines.push(`- 테마: ${payload.theme ?? '알 수 없음'}`);
  if (opts.imageFile) {
    lines.push(`- 화면 이미지: ${opts.imageFile} (표시가 그려진 그대로)`);
  } else {
    lines.push('- 화면 이미지: 없음 (캡처 실패, 아래 좌표와 요소 정보로 판단할 것)');
  }
  lines.push('');

  payload.marks.forEach((mark, i) => {
    const memo = mark.memo.trim() || '(메모 없음)';
    lines.push(`## ${markLabel(i)} ${memo}`);
    lines.push('');
    const b = mark.bounds;
    // A pin is a position, not an area. Unsaid, the 22px badge box reads as
    // "this much of the screen is the problem".
    if (mark.kind === 'pin') {
      lines.push(
        `- 콕 집은 자리: x=${round(b.x + b.width / 2)} y=${round(b.y + b.height / 2)} (영역이 아니라 한 점)`,
      );
    } else {
      lines.push(`- 표시한 영역: x=${round(b.x)} y=${round(b.y)} (${round(b.width)} × ${round(b.height)})`);
    }
    if (mark.sketchFile) {
      lines.push(`- 제안 그림: ${mark.sketchFile} (유저가 "이렇게 생겼으면 좋겠다"고 직접 그린 것)`);
    }
    const t = mark.target;
    if (!t) {
      lines.push('- 가리킨 요소: 찾지 못함 (빈 자리를 표시했을 수 있음)');
      lines.push('');
      return;
    }
    lines.push(`- 가리킨 요소: \`<${t.tag}>\`${t.className ? ` \`${t.className}\`` : ''}`);
    if (t.components.length > 0) {
      lines.push(`- 컴포넌트: ${t.components.join(' ‹ ')}`);
    }
    if (t.testId) lines.push(`- 테스트 아이디: \`${t.testId}\``);
    if (t.text) lines.push(`- 보이던 글자: "${t.text}"`);
    if (t.cssPath) lines.push(`- CSS 경로: \`${t.cssPath}\``);
    lines.push('');
  });

  return lines.join('\n');
}
