/**
 * Dev-only screen feedback writer.
 *
 * Drops what the user marked on screen into `.harness/feedback/<stamp>-<screen>/`
 * inside the repo, so an agent can read which element is wrong and why.
 *
 * A round can span several screens and take minutes, so it is **written as it
 * goes**: every time the user freezes a screen it lands in a `_draft-` folder,
 * and sending only renames that folder. Held anywhere else, one dev-server
 * reload — which is what one is doing when this tool is wanted — would throw
 * away several screens' worth of work.
 *
 * Two things are deliberate:
 *  (1) The IPC handlers are registered only in an unpackaged app
 *      (`ipc/register.ts`). This writes files with no guard of any kind and has
 *      no business existing in a shipped build.
 *  (2) Taking the screenshot is injected, not imported. Electron's
 *      `webContents.capturePage()` is the real one; a test passes its own.
 */
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  DRAFT_PREFIX,
  PNG_DATA_URL_PREFIX,
  draftFolderName,
  draftShotFileName,
  finalFolderName,
  isDraftFolderName,
  isPngDataUrl,
  parseFeedbackPayload,
  renderNoteMarkdown,
  shotFileName,
  type FeedbackSaveResult,
  type FeedbackShotResult,
  type FeedbackStepResult,
} from '@shared/dev-feedback';

/** Ceiling for one screenshot. A 2x window PNG runs 1-3MB; this is headroom,
 *  not a target — it only stops an absurd value from eating the process. */
const MAX_SHOT_CHARS = 24 * 1024 * 1024;

/** Where the folders go. Relative to the repo root, which is the cwd in dev. */
export const FEEDBACK_DIR = path.join('.harness', 'feedback');

/** A draft left untouched this long was abandoned (the app was just closed). */
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export type FeedbackOptions = {
  at?: Date;
  /** Absolute feedback root. Defaults to `<cwd>/.harness/feedback`. */
  root?: string;
  /** Returns a PNG data URL of the window, or null when there is none. */
  capture?: () => Promise<string | null>;
  /**
   * Shrinks a collected screen into a thumbnail data URL. Injected for the same
   * reason as `capture`: Electron's `nativeImage` is the real one, and a test
   * that had to load it could not run in a plain node environment.
   */
  thumbnail?: (png: Buffer) => string | null;
};

/** Decodes the base64 half of a data URL into the bytes that go on disk. */
function pngBytes(dataUrl: string): Buffer {
  return Buffer.from(dataUrl.slice(PNG_DATA_URL_PREFIX.length), 'base64');
}

function rootDir(opts: FeedbackOptions): string {
  return opts.root ?? path.join(process.cwd(), FEEDBACK_DIR);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Freezes the current screen into the draft. The first screen mints the folder.
 *
 * The image is named by **capture order** (`screen-N.png`). Flow order can
 * still change, and renaming during collection would mean moving a file that
 * is already written every time it does; it is renamed once, on send.
 */
export async function saveDraftStep(
  raw: unknown,
  opts: FeedbackOptions = {},
): Promise<FeedbackStepResult> {
  if (!isRecord(raw)) return { ok: false, error: '본문이 객체가 아닙니다' };

  const route = typeof raw.route === 'string' ? raw.route : '';
  if (!route.startsWith('/')) return { ok: false, error: 'route가 없습니다' };

  const seq = typeof raw.seq === 'number' && Number.isInteger(raw.seq) && raw.seq >= 1 ? raw.seq : null;
  if (seq === null) return { ok: false, error: '화면 번호가 잘못됐습니다' };

  const at = opts.at ?? new Date();
  let folder: string;
  if (raw.draft == null) {
    folder = draftFolderName(at, route);
  } else if (isDraftFolderName(raw.draft)) {
    folder = raw.draft;
  } else {
    return { ok: false, error: '초안 이름이 잘못됐습니다' };
  }

  // A failed capture must not lose the screen: the marks and the elements
  // carry most of the value on their own.
  let shot: string | null = null;
  try {
    const captured = (await opts.capture?.()) ?? null;
    shot = isPngDataUrl(captured, MAX_SHOT_CHARS) ? captured : null;
  } catch (err) {
    console.warn('[dev-feedback] screenshot failed', err);
  }

  const dir = path.join(rootDir(opts), folder);
  try {
    await mkdir(dir, { recursive: true });
    if (shot) await writeFile(path.join(dir, draftShotFileName(seq)), pngBytes(shot));
  } catch (err) {
    console.error('[dev-feedback]', err);
    return { ok: false, error: '화면을 저장하지 못했습니다' };
  }

  return { ok: true, draft: folder };
}

/**
 * Reads one collected screen back as a thumbnail, for the review panel.
 *
 * **Every failure answers `null`.** The panel is carried by the memos and the
 * elements; a picture that was swept, never captured or cannot be decoded must
 * cost a thumbnail and nothing else — refusing the whole panel over it would be
 * backwards.
 *
 * The draft name and the screen number both arrive off the wire and both become
 * path segments, so both are checked exactly as `saveDraftStep` checks them: a
 * whitelisted draft shape, and an integer screen number from 1.
 */
export async function readDraftShot(
  raw: unknown,
  opts: FeedbackOptions = {},
): Promise<FeedbackShotResult> {
  if (!isRecord(raw) || !isDraftFolderName(raw.draft)) return { dataUrl: null };
  if (typeof raw.seq !== 'number' || !Number.isInteger(raw.seq) || raw.seq < 1) {
    return { dataUrl: null };
  }
  try {
    const png = await readFile(path.join(rootDir(opts), raw.draft, draftShotFileName(raw.seq)));
    return { dataUrl: opts.thumbnail?.(png) ?? null };
  } catch {
    /* no picture for this screen — the capture failed, or a sweep took it */
    return { dataUrl: null };
  }
}

/**
 * Clears drafts abandoned for over a day — the app was closed mid-round. They
 * pile up in exactly the folder "look at my feedback" reads. A failure here is
 * swallowed: losing the round being saved to a housekeeping error would be
 * backwards.
 */
async function sweepStaleDrafts(root: string, now: number): Promise<void> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith(DRAFT_PREFIX)) continue;
      const dir = path.join(root, entry.name);
      const info = await stat(dir);
      if (now - info.mtimeMs > DRAFT_TTL_MS) await rm(dir, { recursive: true, force: true });
    }
  } catch {
    /* nothing to sweep if the folder is not there yet */
  }
}

/**
 * Ends the round: renames the screens into flow order, writes the note, and
 * renames the draft folder to its final name (keeping the time the flow began).
 */
export async function finishFeedback(
  raw: unknown,
  opts: FeedbackOptions = {},
): Promise<FeedbackSaveResult> {
  if (!isRecord(raw)) return { ok: false, error: '본문이 객체가 아닙니다' };
  if (!isDraftFolderName(raw.draft)) return { ok: false, error: '초안 이름이 잘못됐습니다' };

  const parsed = parseFeedbackPayload(raw);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  // `seqs[i]` is the capture order of flow step i+1 — how the renderer says
  // which picture goes where after a reorder.
  const seqs = Array.isArray(raw.seqs) ? raw.seqs : [];
  if (seqs.length !== parsed.value.steps.length) return { ok: false, error: '화면 순서가 맞지 않습니다' };

  const at = opts.at ?? new Date();
  const root = rootDir(opts);
  const dir = path.join(root, raw.draft);
  const finalFolder = finalFolderName(raw.draft);

  try {
    for (const [i, seq] of seqs.entries()) {
      if (typeof seq !== 'number' || !Number.isInteger(seq) || seq < 1) {
        return { ok: false, error: '화면 순서가 잘못됐습니다' };
      }
      const step = parsed.value.steps[i];
      if (!step.imageFile) continue;
      try {
        await rename(path.join(dir, draftShotFileName(seq)), path.join(dir, shotFileName(i + 1)));
      } catch (err) {
        // One missing picture (swept, or deleted by hand) is not worth throwing
        // the round away — the coordinates and elements are the substance. But
        // the note must not claim a file that is not there.
        console.warn('[dev-feedback] screen image missing', step.route, err);
        step.imageFile = null;
      }
    }
    // Sketch names were decided by validation (they follow the badge numbers);
    // note.json carries only those names.
    for (const sketch of parsed.sketches) {
      await writeFile(path.join(dir, sketch.file), pngBytes(sketch.dataUrl));
    }
    await writeFile(path.join(dir, 'note.md'), renderNoteMarkdown(parsed.value, { at }), 'utf8');
    await writeFile(path.join(dir, 'note.json'), JSON.stringify(parsed.value, null, 2), 'utf8');
    // The rename goes last. If anything above fails the round stays a draft the
    // user can send again, and a half-written folder never stands in the list
    // pretending to be finished feedback.
    await rename(dir, path.join(root, finalFolder));
  } catch (err) {
    console.error('[dev-feedback]', err);
    return { ok: false, error: '저장하지 못했습니다' };
  }

  await sweepStaleDrafts(root, at.getTime());
  return { ok: true, saved: `${FEEDBACK_DIR.split(path.sep).join('/')}/${finalFolder}` };
}

/** The user closed the overlay. Throw the collected draft away — an unfinished
 *  round left behind would stand in the list as if it were feedback. */
export async function discardDraft(
  raw: unknown,
  opts: FeedbackOptions = {},
): Promise<{ ok: boolean; error?: string }> {
  if (!isRecord(raw) || !isDraftFolderName(raw.draft)) {
    return { ok: false, error: '초안 이름이 잘못됐습니다' };
  }
  try {
    await rm(path.join(rootDir(opts), raw.draft), { recursive: true, force: true });
  } catch (err) {
    console.error('[dev-feedback]', err);
    return { ok: false, error: '초안을 지우지 못했습니다' };
  }
  return { ok: true };
}
