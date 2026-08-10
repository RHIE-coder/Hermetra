// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import {
  captureSnapshot,
  captureCandidates,
  cleanAttrs,
  isVolatileClass,
} from '@main/pipeline/snapshot';
import { relocate, similarity } from '@main/pipeline/automatch';

/**
 * Phase 1 — reducing a live element to a fingerprint. Run against a real DOM
 * (happy-dom) rather than hand-written objects, because the whole point is that
 * it works on markup, and hand-built snapshots would quietly agree with whatever
 * the code happens to do.
 *
 * Spec: docs/spec/pipeline/README.md — `pipeline.automatch`.
 */

/**
 * The node tsconfig deliberately ships no DOM lib — main-process source must not
 * reach for one. This test does need a document (happy-dom provides it at run
 * time), so it declares exactly what it touches rather than opening DOM types to
 * every file under `src/main`.
 */
declare const document: {
  body: { innerHTML: string };
  querySelector(selector: string): unknown;
  querySelectorAll(selector: string): ArrayLike<unknown>;
};

type Capturable = Parameters<typeof captureSnapshot>[0];

const dom = (html: string) => {
  document.body.innerHTML = html;
};
const all = (selector: string) =>
  document.querySelectorAll(selector) as ArrayLike<Capturable>;
const el = (sel: string) => document.querySelector(sel) as Capturable;

describe('captureSnapshot — what it records', () => {
  it('records tag, attributes, own text and ancestry', () => {
    dom('<main><ul><li><a id="c1" class="title" href="/x">Charizard</a></li></ul></main>');
    const s = captureSnapshot(el('#c1'));

    expect(s.tag).toBe('a');
    expect(s.attrs).toEqual({ id: 'c1', class: 'title', href: '/x' });
    expect(s.text).toBe('Charizard');
    expect(s.path).toEqual(['html', 'body', 'main', 'ul', 'li']);
  });

  it('records the element own text, not its descendants', () => {
    dom('<div id="row">Total <span>9999</span></div>');
    expect(captureSnapshot(el('#row')).text).toBe('Total');
  });

  it('normalises whitespace so reformatted markup is not a different element', () => {
    dom('<p id="t">  Buy\n   now  </p>');
    expect(captureSnapshot(el('#t')).text).toBe('Buy now');
  });

  it('counts position among same-tag siblings only', () => {
    dom('<ul><li>a</li><hr><li id="second">b</li></ul>');
    expect(captureSnapshot(el('#second')).index).toBe(1);
  });
});

describe('captureSnapshot — what it deliberately throws away', () => {
  it('drops style, which is layout and not identity', () => {
    dom('<a id="x" style="color:red" href="/y">t</a>');
    expect(captureSnapshot(el('#x')).attrs.style).toBeUndefined();
  });

  it('drops framework bookkeeping that is regenerated every build', () => {
    const kept = cleanAttrs({ id: 'a', 'data-v-1f2e3d': '', '_ngcontent-x': '', 'ng-star-inserted': '' });
    expect(Object.keys(kept)).toEqual(['id']);
  });

  it('drops generated class tokens but keeps written ones', () => {
    expect(isVolatileClass('css-1x2y3z')).toBe(true);
    expect(isVolatileClass('Button_root__a1b2c')).toBe(true);
    expect(isVolatileClass('card-title')).toBe(false);
    expect(cleanAttrs({ class: 'card-title css-1x2y3z' })).toEqual({ class: 'card-title' });
  });

  it('omits class entirely when every token was generated', () => {
    expect(cleanAttrs({ class: 'css-aaaa1 css-bbbb2' }).class).toBeUndefined();
  });
});

/**
 * The two halves together, on markup rather than on fixtures: a deploy that
 * rewrites hashed classes and reparents the node must not lose the element.
 */
describe('capture + relocate — a redesign end to end', () => {
  it('relocates the element after a rebuild changed hashes and nesting', () => {
    dom('<main><ul><li><a id="buy" class="btn css-1a2b3c" href="/buy">Buy now</a></li></ul></main>');
    const before = captureSnapshot(el('#buy'));

    // 다음 배포: 해시 클래스가 갈리고, 한 겹 더 깊어지고, 순서도 밀렸다.
    dom(`<main><section><div><ul>
           <li><a class="css-zzz9" href="/help">Help</a></li>
           <li><a id="buy" class="btn css-9z8y7x" href="/buy">Buy now</a></li>
         </ul></div></section></main>`);
    const candidates = captureCandidates(all('a'));

    const r = relocate({ snapshot: before, selector: '#buy', savedAt: '2026-08-10T00:00:00Z' }, candidates);
    expect(r.outcome).toBe('relocated');
    expect(candidates[r.index!]!.attrs.id).toBe('buy');
  });

  it('scores the same element higher than its neighbours on the same page', () => {
    dom('<ul><li><a id="a1" class="row" href="/1">Charizard</a></li></ul>');
    const stored = captureSnapshot(el('#a1'));

    dom(`<ul><li><a id="a1" class="row" href="/1">Charizard</a></li>
             <li><a id="a2" class="row" href="/2">Blastoise</a></li></ul>`);
    const same = captureSnapshot(el('#a1'));
    const other = captureSnapshot(el('#a2'));

    expect(similarity(stored, same)).toBeGreaterThan(similarity(stored, other));
  });

  it('refuses rather than guessing when the page holds two identical rows', () => {
    dom('<ul><li><a class="row" href="/1">Price</a></li></ul>');
    const stored = captureSnapshot(el('.row'));

    dom(`<ul><li><a class="row" href="/1">Price</a></li>
             <li><a class="row" href="/1">Price</a></li></ul>`);
    const candidates = captureCandidates(all('a'));

    const r = relocate({ snapshot: stored, selector: '.row', savedAt: '2026-08-10T00:00:00Z' }, candidates);
    expect(r.outcome).toBe('uncertain');
    expect(r.index).toBeNull();
  });
});
