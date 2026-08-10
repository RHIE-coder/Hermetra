import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CHANNELS } from '@shared/ipc/channels';
import { PNG_DATA_URL_PREFIX } from '@shared/dev-feedback';
import { discardDraft, finishFeedback, saveDraftStep } from '@main/services/devFeedback';

/**
 * The save side of the dev feedback tool.
 *
 * Feedback is collected across several screens over minutes, so it is written
 * to a draft folder as it goes rather than held anywhere it can be lost. What
 * matters here: each screen lands as it is frozen, the finished round is a
 * folder an agent can read in flow order, and neither a broken request nor a
 * failed screenshot takes the rest of it down.
 */

let tmpRoot: string;

// One transparent pixel — a real PNG, so the decoded bytes are checkable.
const PNG =
  PNG_DATA_URL_PREFIX +
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const at = new Date(2026, 7, 10, 14, 32, 7);
const draft = '_draft-20260810-143207-web-remote';
const folder = '20260810-143207-web-remote';

const target = {
  tag: 'span',
  className: 'rounded-full bg-card',
  testId: 'bus-var-row',
  text: 'session.token',
  cssPath: 'main > span',
  components: ['Badge', 'VariableBusPage'],
  rect: { x: 10, y: 20, width: 80, height: 24 },
};

const part = (step: number) => ({
  kind: 'shape' as const,
  bounds: { x: 10, y: 20, width: 80, height: 24 },
  target,
  step,
});

const step = (route: string, hasImage = true) => ({
  route,
  viewport: { width: 1320, height: 880 },
  theme: 'dark' as const,
  hasImage,
});

/** Freezes two screens into a draft the way the overlay does. */
async function collectTwoScreens() {
  const first = await saveDraftStep(
    { draft: null, seq: 1, route: '/web/remote' },
    { at, root: tmpRoot, capture: async () => PNG },
  );
  if (!first.ok) throw new Error(first.error);
  const second = await saveDraftStep(
    { draft: first.draft, seq: 2, route: '/mobile/devices' },
    { at, root: tmpRoot, capture: async () => PNG },
  );
  if (!second.ok) throw new Error(second.error);
  return first.draft;
}

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetra-feedback-'));
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('dev feedback — IPC contract', () => {
  it('registers a channel per step of the round', () => {
    expect(CHANNELS.DEV_FEEDBACK_STEP).toBe('dev:feedback:step');
    expect(CHANNELS.DEV_FEEDBACK_SAVE).toBe('dev:feedback:save');
    expect(CHANNELS.DEV_FEEDBACK_DISCARD).toBe('dev:feedback:discard');
  });
});

describe('saveDraftStep — a screen is frozen before it is left', () => {
  it('mints a draft folder on the first screen and writes it in capture order', async () => {
    const res = await saveDraftStep(
      { draft: null, seq: 1, route: '/web/remote' },
      { at, root: tmpRoot, capture: async () => PNG },
    );

    expect(res).toEqual({ ok: true, draft });
    // The underscore keeps "read the newest folder" off an unfinished round.
    expect(fs.readdirSync(tmpRoot)).toEqual([draft]);
    expect(fs.readdirSync(path.join(tmpRoot, draft))).toEqual(['screen-1.png']);
  });

  it('adds later screens to the same draft', async () => {
    const name = await collectTwoScreens();
    expect(name).toBe(draft);
    expect(fs.readdirSync(path.join(tmpRoot, draft)).sort()).toEqual(['screen-1.png', 'screen-2.png']);
  });

  // The coordinates and the elements are most of the value; a compositor
  // hiccup must not end the round.
  it('keeps the step when the screenshot fails', async () => {
    const res = await saveDraftStep(
      { draft: null, seq: 1, route: '/web/remote' },
      {
        at,
        root: tmpRoot,
        capture: async () => {
          throw new Error('capturePage failed');
        },
      },
    );

    expect(res.ok).toBe(true);
    expect(fs.readdirSync(path.join(tmpRoot, draft))).toEqual([]);
  });

  // The draft name comes back from the renderer and becomes a path segment.
  it('refuses a draft name it did not mint, and a bad route or seq', async () => {
    const opts = { at, root: tmpRoot, capture: async () => PNG };
    expect((await saveDraftStep({ draft: '../../etc', seq: 1, route: '/a' }, opts)).ok).toBe(false);
    expect((await saveDraftStep({ draft: null, seq: 1, route: 'web/remote' }, opts)).ok).toBe(false);
    expect((await saveDraftStep({ draft: null, seq: 0, route: '/a' }, opts)).ok).toBe(false);
    expect(fs.readdirSync(tmpRoot)).toEqual([]);
  });
});

describe('finishFeedback — the round becomes a folder an agent reads', () => {
  it('renames the draft and writes note.md and note.json into it', async () => {
    await collectTwoScreens();

    const res = await finishFeedback(
      {
        draft,
        seqs: [1, 2],
        steps: [step('/web/remote'), step('/mobile/devices')],
        marks: [{ memo: '여기서 발행한 값이 저 화면에 안 온다', sketch: null, parts: [part(1), part(2)] }],
      },
      { at, root: tmpRoot },
    );

    expect(res).toEqual({ ok: true, saved: `.harness/feedback/${folder}` });
    expect(fs.existsSync(path.join(tmpRoot, draft))).toBe(false);

    const dir = path.join(tmpRoot, folder);
    expect(fs.readdirSync(dir).sort()).toEqual(['note.json', 'note.md', 'shot-1.png', 'shot-2.png']);

    const note = fs.readFileSync(path.join(dir, 'note.md'), 'utf-8');
    expect(note).toContain('## 흐름 (화면 2개)');
    expect(note).toContain('여기서 발행한 값이 저 화면에 안 온다');
    expect(note).toContain('화면 2개에 걸쳐 있다');
  });

  // The folder is meant to be read by opening it, so the file names have to be
  // the flow order — not the order the user happened to walk in.
  it('renames the screens into flow order when the user reordered them', async () => {
    await collectTwoScreens();
    // Screen 2 was captured second but the user moved it to the front.
    fs.writeFileSync(path.join(tmpRoot, draft, 'screen-2.png'), 'SECOND');

    const res = await finishFeedback(
      {
        draft,
        seqs: [2, 1],
        steps: [step('/mobile/devices'), step('/web/remote')],
        marks: [{ memo: 'a', sketch: null, parts: [part(1)] }],
      },
      { at, root: tmpRoot },
    );

    expect(res.ok).toBe(true);
    const dir = path.join(tmpRoot, folder);
    expect(fs.readFileSync(path.join(dir, 'shot-1.png'), 'utf-8')).toBe('SECOND');
    // No screen-* left behind: the name alone tells you the order.
    expect(fs.readdirSync(dir).filter((f) => f.startsWith('screen-'))).toEqual([]);
  });

  // Losing one picture is not worth losing the round, but the note must not
  // point at a file that is not there either.
  it('drops a missing screen image from the note instead of failing', async () => {
    await collectTwoScreens();
    fs.rmSync(path.join(tmpRoot, draft, 'screen-2.png'));

    const res = await finishFeedback(
      {
        draft,
        seqs: [1, 2],
        steps: [step('/web/remote'), step('/mobile/devices')],
        marks: [{ memo: 'a', sketch: null, parts: [part(1)] }],
      },
      { at, root: tmpRoot },
    );

    expect(res.ok).toBe(true);
    const dir = path.join(tmpRoot, folder);
    expect(fs.existsSync(path.join(dir, 'shot-2.png'))).toBe(false);
    expect(fs.readFileSync(path.join(dir, 'note.md'), 'utf-8')).toContain('그림 없음');
  });

  it('writes one file per attached sketch, named after its group', async () => {
    await collectTwoScreens();

    await finishFeedback(
      {
        draft,
        seqs: [1, 2],
        steps: [step('/web/remote'), step('/mobile/devices')],
        marks: [{ memo: 'a', sketch: PNG, parts: [part(1)] }],
      },
      { at, root: tmpRoot },
    );

    const dir = path.join(tmpRoot, folder);
    expect(fs.existsSync(path.join(dir, 'sketch-1.png'))).toBe(true);
    // The bytes stay out of note.json — it has to remain a file a human can open.
    expect(fs.readFileSync(path.join(dir, 'note.json'), 'utf-8')).not.toContain('iVBORw0KGgo');
  });

  // A half-written folder that looks finished is worse than a draft the user
  // can send again.
  it('leaves the draft alone when the request is broken', async () => {
    await collectTwoScreens();

    const res = await finishFeedback(
      { draft, seqs: [1, 2], steps: [step('/web/remote'), step('/mobile/devices')], marks: [] },
      { at, root: tmpRoot },
    );

    expect(res.ok).toBe(false);
    expect(fs.existsSync(path.join(tmpRoot, draft))).toBe(true);
    expect(fs.existsSync(path.join(tmpRoot, folder))).toBe(false);
  });

  it('refuses a screen order that does not match the flow', async () => {
    await collectTwoScreens();
    const res = await finishFeedback(
      {
        draft,
        seqs: [1],
        steps: [step('/web/remote'), step('/mobile/devices')],
        marks: [{ memo: 'a', sketch: null, parts: [part(1)] }],
      },
      { at, root: tmpRoot },
    );
    expect(res.ok).toBe(false);
  });

  it('refuses a draft name it did not mint', async () => {
    const res = await finishFeedback(
      { draft: '../../etc', seqs: [1], steps: [step('/a')], marks: [{ memo: 'a', sketch: null, parts: [part(1)] }] },
      { at, root: tmpRoot },
    );
    expect(res.ok).toBe(false);
  });

  // Closing the browser mid-round leaves a draft nobody will finish; they pile
  // up in the very folder "look at my feedback" reads.
  it('sweeps drafts left abandoned for a day', async () => {
    await collectTwoScreens();
    const stale = path.join(tmpRoot, '_draft-20260101-090000-old');
    fs.mkdirSync(stale);
    const longAgo = new Date(at.getTime() - 48 * 60 * 60 * 1000);
    fs.utimesSync(stale, longAgo, longAgo);

    await finishFeedback(
      {
        draft,
        seqs: [1, 2],
        steps: [step('/web/remote'), step('/mobile/devices')],
        marks: [{ memo: 'a', sketch: null, parts: [part(1)] }],
      },
      { at, root: tmpRoot },
    );

    expect(fs.existsSync(stale)).toBe(false);
  });
});

describe('discardDraft — closing throws the round away', () => {
  it('removes the draft folder', async () => {
    await collectTwoScreens();
    const res = await discardDraft({ draft }, { root: tmpRoot });
    expect(res.ok).toBe(true);
    expect(fs.readdirSync(tmpRoot)).toEqual([]);
  });

  it('refuses to remove anything that is not a draft it minted', async () => {
    const res = await discardDraft({ draft: '20260810-143207-web-remote' }, { root: tmpRoot });
    expect(res.ok).toBe(false);
  });
});
