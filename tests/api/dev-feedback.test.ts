import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CHANNELS } from '@shared/ipc/channels';
import { PNG_DATA_URL_PREFIX } from '@shared/dev-feedback';
import { saveFeedback } from '@main/services/devFeedback';

/**
 * The save side of the dev feedback tool.
 *
 * The handler is dev-only and writes into the repo, so what matters here is
 * that a round of feedback lands as a folder an agent can read, that a broken
 * request writes nothing, and that a failed screenshot does not take the rest
 * of the feedback down with it.
 */

let tmpRoot: string;

// One transparent pixel — a real PNG, so the decoded bytes are checkable.
const PNG =
  PNG_DATA_URL_PREFIX +
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const request = {
  route: '/bridge/bus',
  viewport: { width: 1320, height: 880 },
  theme: 'dark' as const,
  marks: [
    {
      kind: 'shape' as const,
      memo: '이 배지가 글자를 잘라먹음',
      bounds: { x: 10, y: 20, width: 80, height: 24 },
      target: {
        tag: 'span',
        className: 'rounded-full bg-card',
        testId: 'bus-var-row',
        text: 'session.token',
        cssPath: 'main > span',
        components: ['Badge', 'VariableBusPage'],
        rect: { x: 10, y: 20, width: 80, height: 24 },
      },
      sketch: null,
    },
  ],
};

const at = new Date(2026, 7, 2, 14, 32, 7);
const folder = '20260802-143207-bridge-bus';

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetra-feedback-'));
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('dev feedback — IPC contract', () => {
  it('registers one save channel', () => {
    expect(CHANNELS.DEV_FEEDBACK_SAVE).toBe('dev:feedback:save');
  });
});

describe('saveFeedback — a round of feedback lands as a readable folder', () => {
  it('writes note.md, note.json and shot.png under the timestamped folder', async () => {
    const res = await saveFeedback(request, { at, root: tmpRoot, capture: async () => PNG });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.saved).toBe(`.harness/feedback/${folder}`);

    const dir = path.join(tmpRoot, folder);
    expect(fs.readdirSync(dir).sort()).toEqual(['note.json', 'note.md', 'shot.png']);

    const note = fs.readFileSync(path.join(dir, 'note.md'), 'utf-8');
    expect(note).toContain('이 배지가 글자를 잘라먹음');
    expect(note).toContain('VariableBusPage');
    expect(note).toContain('shot.png');

    // The screenshot is written as decoded bytes, not as the base64 text.
    const shot = fs.readFileSync(path.join(dir, 'shot.png'));
    expect(shot.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  });

  it('writes one file per attached sketch, named after its mark', async () => {
    const res = await saveFeedback(
      { ...request, marks: [{ ...request.marks[0], sketch: PNG }] },
      { at, root: tmpRoot, capture: async () => null },
    );

    expect(res.ok).toBe(true);
    const dir = path.join(tmpRoot, folder);
    expect(fs.existsSync(path.join(dir, 'sketch-1.png'))).toBe(true);
    expect(fs.readFileSync(path.join(dir, 'note.md'), 'utf-8')).toContain('sketch-1.png');
    // The bytes stay out of note.json — it has to remain a file a human can open.
    expect(fs.readFileSync(path.join(dir, 'note.json'), 'utf-8')).not.toContain('iVBORw0KGgo');
  });

  // The marks and the element info are worth keeping on their own. Losing the
  // whole round because the compositor hiccuped would be the wrong trade.
  it('keeps the feedback when the screenshot fails', async () => {
    const res = await saveFeedback(request, {
      at,
      root: tmpRoot,
      capture: async () => {
        throw new Error('capturePage failed');
      },
    });

    expect(res.ok).toBe(true);
    const dir = path.join(tmpRoot, folder);
    expect(fs.existsSync(path.join(dir, 'shot.png'))).toBe(false);
    expect(fs.readFileSync(path.join(dir, 'note.md'), 'utf-8')).toContain('캡처 실패');
  });

  it('refuses a broken request without writing anything', async () => {
    const res = await saveFeedback({ ...request, marks: [] }, { at, root: tmpRoot, capture: async () => PNG });

    expect(res.ok).toBe(false);
    expect(fs.readdirSync(tmpRoot)).toEqual([]);
  });

  // The route is whatever the renderer's hash says. It must not be able to
  // walk the write out of the feedback folder.
  it('cannot be walked out of the feedback folder by the route', async () => {
    const res = await saveFeedback(
      { ...request, route: '/../../../etc/hermetra-pwn' },
      { at, root: tmpRoot, capture: async () => null },
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.saved).not.toContain('..');
    const written = fs.readdirSync(tmpRoot);
    expect(written).toHaveLength(1);
    expect(written[0]).toBe('20260802-143207-etc-hermetra-pwn');
  });
});
