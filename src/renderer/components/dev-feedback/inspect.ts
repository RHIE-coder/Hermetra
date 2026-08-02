// Digs out what was actually under a point on screen.
//
// This is where the tool earns its keep. Handed only coordinates, an agent is
// back to "somewhere around here"; handed the DOM element and the React
// component names at that spot, it can go straight to the source file.
import type { FeedbackTarget } from '@shared/dev-feedback';

/** Marker that keeps the overlay out of its own probe. */
export const FEEDBACK_ATTR = 'data-hermetra-feedback';

// The React tree is full of plumbing — routers, providers, Radix internals.
// Passed through as-is, the component chain fills up with noise and the
// component that actually drew the screen gets buried.
//
// Anything ending in Context / Provider / Boundary is dropped wholesale: it is
// wiring, and it answers nothing about "which file is this bit of screen from".
const NOISE_SUFFIX = /(Context|Provider|Boundary|Root|Node|Handler)$/;
const NOISE_EXACT =
  /^(Routes|Route|Router|HashRouter|BrowserRouter|MemoryRouter|Outlet|Navigate|RenderedRoute|Location|Fragment|Suspense|Activity|StrictMode|Slot|SlotClone|Presence|Primitive)$/;

function isNoise(name: string): boolean {
  return NOISE_SUFFIX.test(name) || NOISE_EXACT.test(name) || !/^[A-Z]/.test(name);
}

type FiberLike = {
  type?: unknown;
  return?: FiberLike | null;
};

function fiberOf(el: Element): FiberLike | null {
  for (const key of Object.keys(el)) {
    if (key.startsWith('__reactFiber$')) {
      return (el as unknown as Record<string, FiberLike>)[key] ?? null;
    }
  }
  return null;
}

function nameOfType(type: unknown): string | null {
  if (typeof type === 'function') {
    const fn = type as { displayName?: string; name?: string };
    return fn.displayName || fn.name || null;
  }
  // memo() / forwardRef() wrappers arrive as objects, not functions.
  if (type && typeof type === 'object') {
    const obj = type as { displayName?: string; render?: { name?: string }; type?: unknown };
    if (obj.displayName) return obj.displayName;
    if (obj.render?.name) return obj.render.name;
    if (obj.type) return nameOfType(obj.type);
  }
  return null;
}

/**
 * The React component chain that produced this element, innermost first, up to
 * six. React 19 dev builds do not reliably expose the JSX call site, so the
 * component name stands in for it — name + className + text finds the file in
 * one grep.
 */
export function componentChainOf(el: Element): string[] {
  let fiber = fiberOf(el);
  const names: string[] = [];
  let hops = 0;
  while (fiber && hops < 80 && names.length < 6) {
    hops += 1;
    const name = nameOfType(fiber.type);
    if (name && !isNoise(name) && names[names.length - 1] !== name) names.push(name);
    fiber = fiber.return ?? null;
  }
  return names;
}

/** A CSS selector path up the parents. Tells two uses of the same component apart. */
export function cssPathOf(el: Element): string {
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node.nodeType === 1 && parts.length < 6 && node.tagName !== 'BODY') {
    const tag = node.tagName.toLowerCase();
    const parent: Element | null = node.parentElement;
    if (!parent) {
      parts.unshift(tag);
      break;
    }
    const current = node;
    const siblings = [...parent.children].filter((c) => c.tagName === current.tagName);
    parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${siblings.indexOf(current) + 1})` : tag);
    node = parent;
  }
  return parts.join(' > ');
}

function describe(el: Element): FeedbackTarget {
  const rect = el.getBoundingClientRect();
  return {
    tag: el.tagName.toLowerCase(),
    // An SVG element's className is an object, not a string — read the attribute.
    className: (el.getAttribute('class') ?? '').trim().slice(0, 400),
    testId: el.getAttribute('data-testid'),
    text: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120),
    cssPath: cssPathOf(el),
    components: componentChainOf(el),
    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
  };
}

function elementAt(x: number, y: number): Element | null {
  // Take everything stacked at the point and drop only our own overlay.
  // Hiding the overlay for a frame instead would make the screen blink.
  for (const el of document.elementsFromPoint(x, y)) {
    if (el.closest(`[${FEEDBACK_ATTR}]`)) continue;
    if (el === document.body || el === document.documentElement) continue;
    return el;
  }
  return null;
}

/**
 * Finds the element under a mark. The centre is tried first, then four points
 * inside the area. Circling something is the natural gesture, so the centre is
 * usually right; the extra probes cover a ring drawn around empty padding.
 */
export function targetInBounds(bounds: {
  x: number;
  y: number;
  width: number;
  height: number;
}): FeedbackTarget | null {
  const { x, y, width, height } = bounds;
  const probes: Array<[number, number]> = [
    [x + width / 2, y + height / 2],
    [x + width * 0.3, y + height * 0.3],
    [x + width * 0.7, y + height * 0.3],
    [x + width * 0.3, y + height * 0.7],
    [x + width * 0.7, y + height * 0.7],
  ];
  for (const [px, py] of probes) {
    const el = elementAt(px, py);
    if (el) return describe(el);
  }
  return null;
}
