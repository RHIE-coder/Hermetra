import { describe, it, expect } from 'vitest';
import {
  createLineSplitter,
  decodeFrame,
  decodeRequest,
  encodeLine,
} from '@main/sidecar/protocol';

/**
 * The wire between Electron main and the sidecar: one JSON object per line.
 *
 * The sidecar owns the browser now, so stdout carries more than an endpoint —
 * replies and streamed log lines share it. What keeps that readable is the rule
 * that a line is either one JSON frame or noise, and noise is dropped.
 *
 * Spec: docs/spec/studio/README.md — `studio.sidecar` 계약.
 */

describe('encodeLine', () => {
  it('writes one object per line, terminated', () => {
    expect(encodeLine({ t: 'ready', endpoint: 'ws://x' })).toBe('{"t":"ready","endpoint":"ws://x"}\n');
  });

  it('never emits a raw newline inside the line', () => {
    const line = encodeLine({ t: 'log', text: 'first\nsecond' });
    expect(line.slice(0, -1)).not.toContain('\n');
    expect(JSON.parse(line)).toEqual({ t: 'log', text: 'first\nsecond' });
  });
});

describe('createLineSplitter', () => {
  it('holds a frame that arrives in two chunks until it is whole', () => {
    const seen: string[] = [];
    const feed = createLineSplitter((line) => seen.push(line));

    feed('{"t":"ready","endp');
    expect(seen).toEqual([]);

    feed('oint":"ws://x"}\n');
    expect(seen).toEqual(['{"t":"ready","endpoint":"ws://x"}']);
  });

  it('splits two frames that share one chunk', () => {
    const seen: string[] = [];
    const feed = createLineSplitter((line) => seen.push(line));

    feed('{"a":1}\n{"b":2}\n');
    expect(seen).toEqual(['{"a":1}', '{"b":2}']);
  });

  it('keeps a trailing partial line back', () => {
    const seen: string[] = [];
    const feed = createLineSplitter((line) => seen.push(line));

    feed('{"a":1}\n{"b":');
    expect(seen).toEqual(['{"a":1}']);
  });
});

describe('decodeFrame', () => {
  it('reads the frames the sidecar sends', () => {
    expect(decodeFrame('{"t":"ready","endpoint":"ws://x"}')).toEqual({
      t: 'ready',
      endpoint: 'ws://x',
    });
    expect(decodeFrame('{"t":"reply","id":7,"ok":true,"value":[1,2]}')).toEqual({
      t: 'reply',
      id: 7,
      ok: true,
      value: [1, 2],
    });
    expect(decodeFrame('{"t":"reply","id":8,"ok":false,"error":"boom"}')).toEqual({
      t: 'reply',
      id: 8,
      ok: false,
      error: 'boom',
    });
    expect(
      decodeFrame('{"t":"log","runId":"r1","at":5,"level":"error","text":"nope"}'),
    ).toEqual({ t: 'log', runId: 'r1', at: 5, level: 'error', text: 'nope' });
  });

  // A dependency writing to stdout must never be mistaken for a frame — the
  // whole reason the format is pinned.
  it.each([
    ['chatter', '[sidecar] starting camoufox'],
    ['blank', ''],
    ['half an object', '{'],
    ['null', 'null'],
    ['an array', '[1,2]'],
    ['a frame with no tag', '{"endpoint":"ws://x"}'],
    ['a tag that is not a string', '{"t":42}'],
    ['a tag nobody sends', '{"t":"whatever"}'],
    ['a reply with no id', '{"t":"reply","ok":true}'],
  ])('drops %s', (_why, line) => {
    expect(decodeFrame(line)).toBeNull();
  });
});

describe('decodeRequest', () => {
  it('reads the operations main asks for', () => {
    expect(decodeRequest('{"id":1,"op":"pages"}')).toEqual({ id: 1, op: 'pages' });
    expect(decodeRequest('{"id":2,"op":"navigate","url":"https://x"}')).toEqual({
      id: 2,
      op: 'navigate',
      url: 'https://x',
    });
    expect(decodeRequest('{"id":3,"op":"close-page","index":1}')).toEqual({
      id: 3,
      op: 'close-page',
      index: 1,
    });
  });

  it.each([
    ['junk', 'not json'],
    ['no id', '{"op":"pages"}'],
    ['an id that is not a number', '{"id":"1","op":"pages"}'],
    ['an op nobody implements', '{"id":1,"op":"launch-missiles"}'],
  ])('drops %s', (_why, line) => {
    expect(decodeRequest(line)).toBeNull();
  });
});
