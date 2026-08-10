import type { ElementSnapshot } from '@shared/types/automatch';

/**
 * Phase 1 of adaptive relocation: reducing a live element to what survives a
 * redesign.
 *
 * This runs **against a DOM** — inside the scraped page, or against a parsed
 * document — so it takes the minimum structural interface rather than importing
 * anything. That keeps it runnable in a browser context and testable without one.
 *
 * It has to happen on a *successful* extraction. A fingerprint cannot be
 * back-filled: if a run does not record what the element looked like while it
 * still matched, that run can never contribute to relocating it later.
 */

/** The slice of `Element` this needs. Satisfied by a real DOM and by happy-dom alike. */
export interface DomLike {
  tagName: string;
  attributes: ArrayLike<{ name: string; value: string }>;
  childNodes: ArrayLike<{ nodeType: number; textContent: string | null }>;
  parentElement: DomLike | null;
}

/**
 * Attributes worth nothing to identity.
 *
 * `style` is layout, not identity. Framework bookkeeping (`data-reactid`,
 * Angular's `_ngcontent-*`, Vue's `data-v-*`) is regenerated per build, so it
 * looks stable within one scrape and changes wholesale on the next deploy —
 * exactly the shape that makes a fingerprint quietly rot.
 */
export function isVolatileAttr(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n === 'style' ||
    n === 'data-reactid' ||
    n.startsWith('data-v-') ||
    n.startsWith('_ngcontent') ||
    n.startsWith('_nghost') ||
    n.startsWith('ng-')
  );
}

/**
 * Class tokens that are generated rather than written.
 *
 * CSS-in-JS emits `css-1x2y3z`, hashed modules emit `Button_root__a1b2c`. They
 * change every build, so keeping them makes a fingerprint disagree with itself
 * after a deploy that changed nothing a person would notice.
 */
export function isVolatileClass(token: string): boolean {
  return (
    /^(css|sc|jsx|emotion)-[a-z0-9]{4,}$/i.test(token) ||
    /__[a-z0-9]{5,}$/i.test(token) ||
    /^[a-z]+_[a-z]+__[a-z0-9]+$/i.test(token)
  );
}

/** Drops volatile attributes and volatile class tokens. */
export function cleanAttrs(raw: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(raw)) {
    if (isVolatileAttr(name)) continue;
    if (name.toLowerCase() === 'class') {
      const kept = value.split(/\s+/).filter((t) => t && !isVolatileClass(t));
      if (kept.length) out.class = kept.join(' ');
      continue;
    }
    out[name] = value;
  }
  return out;
}

/** The element's own text — not its descendants'. A container's label is not its own. */
function ownText(el: DomLike): string {
  let text = '';
  for (let i = 0; i < el.childNodes.length; i += 1) {
    const node = el.childNodes[i]!;
    if (node.nodeType === 3) text += node.textContent ?? '';
  }
  return text.trim().replace(/\s+/g, ' ');
}

function attrsOf(el: DomLike): Record<string, string> {
  const raw: Record<string, string> = {};
  for (let i = 0; i < el.attributes.length; i += 1) {
    const a = el.attributes[i]!;
    raw[a.name] = a.value;
  }
  return cleanAttrs(raw);
}

/** Ancestor tag chain, outermost first. The element itself is not in it. */
function pathOf(el: DomLike): string[] {
  const chain: string[] = [];
  let cur = el.parentElement;
  while (cur) {
    chain.unshift(cur.tagName.toLowerCase());
    cur = cur.parentElement;
  }
  return chain;
}

/** Position among same-tag siblings — the only index that means anything after a reflow. */
function indexOf(el: DomLike): number {
  const parent = el.parentElement as (DomLike & { children?: ArrayLike<DomLike> }) | null;
  if (!parent?.children) return 0;
  const tag = el.tagName.toLowerCase();
  let seen = 0;
  for (let i = 0; i < parent.children.length; i += 1) {
    const sibling = parent.children[i]!;
    if (sibling === el) return seen;
    if (sibling.tagName.toLowerCase() === tag) seen += 1;
  }
  return seen;
}

/** Reduce one element to a snapshot. */
export function captureSnapshot(el: DomLike): ElementSnapshot {
  return {
    tag: el.tagName.toLowerCase(),
    attrs: attrsOf(el),
    text: ownText(el),
    path: pathOf(el),
    index: indexOf(el),
  };
}

/** Reduce many, preserving order — `relocate()` reports an index into this list. */
export function captureCandidates(elements: ArrayLike<DomLike>): ElementSnapshot[] {
  const out: ElementSnapshot[] = [];
  for (let i = 0; i < elements.length; i += 1) out.push(captureSnapshot(elements[i]!));
  return out;
}
