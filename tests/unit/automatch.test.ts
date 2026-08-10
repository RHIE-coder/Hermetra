import { describe, it, expect } from 'vitest';
import { similarity, relocate, WEIGHTS } from '@main/pipeline/automatch';
import { DEFAULT_THRESHOLDS } from '@shared/types/automatch';
import type { ElementSnapshot, ElementFingerprint } from '@shared/types/automatch';

/**
 * Adaptive relocation. Pure: snapshots in, a decision out. No DOM, no browser.
 *
 * Spec: docs/spec/pipeline/README.md — `pipeline.automatch`.
 */

const snap = (over: Partial<ElementSnapshot> = {}): ElementSnapshot => ({
  tag: 'a',
  attrs: { class: 'card-title link', href: '/card/1' },
  text: 'Charizard',
  path: ['html', 'body', 'main', 'ul', 'li'],
  index: 0,
  ...over,
});

const print = (s: ElementSnapshot, selector = '.card-title'): ElementFingerprint => ({
  snapshot: s,
  selector,
  savedAt: '2026-08-10T00:00:00.000Z',
});

describe('similarity — the scale itself', () => {
  it('scores an identical snapshot 1', () => {
    expect(similarity(snap(), snap())).toBe(1);
  });

  it('scores a completely unrelated snapshot near 0', () => {
    const other = snap({
      tag: 'input', attrs: { type: 'checkbox' }, text: '', path: ['html', 'head'], index: 9,
    });
    expect(similarity(snap(), other)).toBeLessThan(0.2);
  });

  it('never leaves 0..1', () => {
    const pairs: [ElementSnapshot, ElementSnapshot][] = [
      [snap(), snap({ attrs: {} })],
      [snap({ attrs: {}, text: '' }), snap({ attrs: {}, text: '' })],
      [snap({ path: [] }), snap({ path: [] })],
    ];
    for (const [a, b] of pairs) {
      const s = similarity(a, b);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });

  it('is symmetric — the order of comparison cannot change the answer', () => {
    const a = snap();
    const b = snap({ text: 'Blastoise', attrs: { class: 'card-title', href: '/card/9' } });
    expect(similarity(a, b)).toBeCloseTo(similarity(b, a), 10);
  });
});

describe('similarity — what a redesign actually changes', () => {
  it('survives a class rename when id and text hold', () => {
    const before = snap({ attrs: { id: 'card-1', class: 'old-card' } });
    const after = snap({ attrs: { id: 'card-1', class: 'brand-new-utility-classes' } });
    expect(similarity(before, after)).toBeGreaterThan(0.75);
  });

  it('survives being moved deeper in the tree when the element itself is unchanged', () => {
    const before = snap();
    const after = snap({ path: ['html', 'body', 'div', 'section', 'main', 'ul', 'li'] });
    expect(similarity(before, after)).toBeGreaterThan(0.75);
  });

  it('weighs a stable id far above a class list, because classes churn', () => {
    const base = snap({ attrs: { id: 'buy', class: 'btn primary' }, text: 'Buy' });
    const idKept = snap({ attrs: { id: 'buy', class: 'x1 x2' }, text: 'Buy' });
    const idLost = snap({ attrs: { class: 'btn primary' }, text: 'Buy' });
    expect(similarity(base, idKept)).toBeGreaterThan(similarity(base, idLost));
  });

  it('treats a testid like an id — it exists precisely to be stable', () => {
    const base = snap({ attrs: { 'data-testid': 'row-total' }, text: '100' });
    const kept = snap({ attrs: { 'data-testid': 'row-total' }, text: '250' });
    const lost = snap({ attrs: { 'data-testid': 'row-subtotal' }, text: '250' });
    // 관계를 고정한다. 절대값을 박으면 가중치를 조정할 때마다 근거 없이 숫자를 따라가게 된다.
    expect(similarity(base, kept)).toBeGreaterThan(similarity(base, lost));
  });

  /**
   * testid 만 같고 텍스트도 위치도 전부 달라진 경우는 **애매한 게 맞다.** 하나의 강한
   * 신호가 나머지 전부의 반대를 이기게 두면, 그게 조용히 틀린 요소를 집어오는 경로가 된다.
   */
  it('does not let one strong signal outvote everything disagreeing with it', () => {
    const base = snap({ attrs: { 'data-testid': 'row-total' }, text: '100' });
    const suspicious = snap({
      attrs: { 'data-testid': 'row-total' }, text: '250', path: ['html', 'div'],
    });
    const score = similarity(base, suspicious);
    expect(score).toBeGreaterThan(DEFAULT_THRESHOLDS.floor); // 버릴 정도는 아니고
    expect(score).toBeLessThan(DEFAULT_THRESHOLDS.accept);   // 자동 채택할 정도도 아니다
  });

  it('does not call two different rows the same element just because they share a shape', () => {
    const a = snap({ text: 'Charizard', attrs: { class: 'card-title', href: '/card/1' } });
    const b = snap({ text: 'Blastoise', attrs: { class: 'card-title', href: '/card/2' }, index: 1 });
    expect(similarity(a, b)).toBeLessThan(0.9);
  });
});

describe('relocate — the stored selector still works', () => {
  it('reports exact and relocates nothing', () => {
    const fp = print(snap());
    const r = relocate(fp, [snap()], { selectorStillMatches: true });
    expect(r.outcome).toBe('exact');
    expect(r.index).toBe(0);
    expect(r.score).toBe(1);
  });
});

describe('relocate — choosing, and refusing to', () => {
  it('relocates to a clear winner and reports the score', () => {
    const fp = print(snap({ attrs: { id: 'card-1', class: 'old' } }));
    const candidates = [
      snap({ tag: 'footer', attrs: {}, text: 'copyright', path: ['html', 'body'] }),
      snap({ attrs: { id: 'card-1', class: 'redesigned' } }),
      snap({ tag: 'input', attrs: { type: 'text' }, text: '' }),
    ];
    const r = relocate(fp, candidates);
    expect(r.outcome).toBe('relocated');
    expect(r.index).toBe(1);
    expect(r.score).toBeGreaterThan(0.75);
  });

  /** The whole reason this is not "return the highest score". */
  it('refuses when two candidates are equally good — that is a coin flip, not a match', () => {
    const fp = print(snap({ text: 'Price', attrs: { class: 'price' } }));
    const twin = snap({ text: 'Price', attrs: { class: 'price' } });
    const r = relocate(fp, [twin, { ...twin, index: 1 }]);

    expect(r.outcome).toBe('uncertain');
    expect(r.index).toBeNull();
    expect(r.reason).toMatch(/구분|ambiguous|비슷/i);
  });

  it('refuses when the best match is only a resemblance', () => {
    const fp = print(snap({ text: 'Charizard', attrs: { id: 'card-1' } }));
    const vague = snap({ tag: 'a', attrs: { class: 'link' }, text: 'Something else', index: 4 });
    const r = relocate(fp, [vague]);

    expect(['uncertain', 'lost']).toContain(r.outcome);
    expect(r.index).toBeNull();
  });

  it('reports lost when nothing on the page resembles it', () => {
    const fp = print(snap());
    const r = relocate(fp, [
      snap({ tag: 'script', attrs: {}, text: '', path: ['html', 'head'], index: 3 }),
    ]);
    expect(r.outcome).toBe('lost');
    expect(r.index).toBeNull();
  });

  it('reports lost, not a crash, when the page has no candidates at all', () => {
    const r = relocate(print(snap()), []);
    expect(r.outcome).toBe('lost');
    expect(r.score).toBe(0);
    expect(r.index).toBeNull();
  });

  it('always carries the runner-up, so the screen can show what it nearly picked', () => {
    const fp = print(snap({ attrs: { id: 'a' } }));
    const r = relocate(fp, [snap({ attrs: { id: 'a' } }), snap({ attrs: { id: 'b' } })]);
    expect(r.runnerUp).toBeGreaterThan(0);
    expect(r.runnerUp).toBeLessThanOrEqual(r.score);
  });

  it('honours thresholds handed to it', () => {
    const fp = print(snap({ attrs: { id: 'card-1' } }));
    const near = snap({ attrs: { id: 'card-1' }, text: 'Charizard EX' });

    const strict = relocate(fp, [near], { thresholds: { accept: 0.99, floor: 0.4, margin: 0.08 } });
    expect(strict.outcome).toBe('uncertain');

    const loose = relocate(fp, [near], { thresholds: { accept: 0.3, floor: 0.1, margin: 0.01 } });
    expect(loose.outcome).toBe('relocated');
  });
});

describe('weights are a declared policy, not scattered magic numbers', () => {
  it('sums to 1, so a score is a fraction and not an opinion', () => {
    const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('ranks identity attributes above position', () => {
    expect(WEIGHTS.identity).toBeGreaterThan(WEIGHTS.position);
    expect(WEIGHTS.text).toBeGreaterThan(WEIGHTS.position);
  });
});
