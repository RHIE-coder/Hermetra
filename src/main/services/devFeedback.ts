/**
 * Dev-only screen feedback writer.
 *
 * Drops what the user marked on screen into `.harness/feedback/<stamp>-<screen>/`
 * inside the repo, so an agent can read which element is wrong and why.
 *
 * Two things are deliberate:
 *  (1) The IPC handler is registered only in an unpackaged app (`ipc/register.ts`).
 *      This writes files with no guard of any kind and has no business existing
 *      in a shipped build.
 *  (2) Taking the screenshot is injected, not imported. Electron's
 *      `webContents.capturePage()` is the real one; a test passes its own. The
 *      service stays a plain function over a payload and a directory.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  PNG_DATA_URL_PREFIX,
  feedbackFolderName,
  isPngDataUrl,
  parseFeedbackPayload,
  renderNoteMarkdown,
  type FeedbackSaveResult,
} from '@shared/dev-feedback';

/** Ceiling for one screenshot. A 2x window PNG runs 1-3MB; this is headroom,
 *  not a target — it only stops an absurd value from eating the process. */
const MAX_SHOT_CHARS = 24 * 1024 * 1024;

/** Where the folders go. Relative to the repo root, which is the cwd in dev. */
export const FEEDBACK_DIR = path.join('.harness', 'feedback');

export type SaveFeedbackOptions = {
  at?: Date;
  /** Absolute feedback root. Defaults to `<cwd>/.harness/feedback`. */
  root?: string;
  /** Returns a PNG data URL of the window, or null when there is none. */
  capture?: () => Promise<string | null>;
};

/** Decodes the base64 half of a data URL into the bytes that go on disk. */
function pngBytes(dataUrl: string): Buffer {
  return Buffer.from(dataUrl.slice(PNG_DATA_URL_PREFIX.length), 'base64');
}

export async function saveFeedback(
  raw: unknown,
  opts: SaveFeedbackOptions = {},
): Promise<FeedbackSaveResult> {
  const parsed = parseFeedbackPayload(raw);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const at = opts.at ?? new Date();
  const root = opts.root ?? path.join(process.cwd(), FEEDBACK_DIR);
  const folder = feedbackFolderName(at, parsed.value.route);
  const dir = path.join(root, folder);

  // A failed capture must not lose the round: the marks and the element info
  // carry most of the value on their own.
  let shot: string | null = null;
  try {
    const captured = (await opts.capture?.()) ?? null;
    shot = isPngDataUrl(captured, MAX_SHOT_CHARS) ? captured : null;
  } catch (err) {
    console.warn('[dev-feedback] screenshot failed', err);
  }

  try {
    await mkdir(dir, { recursive: true });
    if (shot) await writeFile(path.join(dir, 'shot.png'), pngBytes(shot));
    // Sketch names were decided by validation (they follow the badge numbers);
    // note.json carries only those names.
    for (const sketch of parsed.sketches) {
      await writeFile(path.join(dir, sketch.file), pngBytes(sketch.dataUrl));
    }
    await writeFile(
      path.join(dir, 'note.md'),
      renderNoteMarkdown(parsed.value, { at, imageFile: shot ? 'shot.png' : null }),
      'utf8',
    );
    await writeFile(path.join(dir, 'note.json'), JSON.stringify(parsed.value, null, 2), 'utf8');
  } catch (err) {
    console.error('[dev-feedback]', err);
    return { ok: false, error: '저장하지 못했습니다' };
  }

  return { ok: true, saved: `${FEEDBACK_DIR.split(path.sep).join('/')}/${folder}` };
}
