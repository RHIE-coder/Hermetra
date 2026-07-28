import { DOMParser } from '@xmldom/xmldom';
import type { InspectorElement } from '@shared/types/mobile';

/**
 * Pure parsers for Appium page sources.
 *
 *  - `parseNativePageSource(xml)` — Android UIAutomator / iOS XCUITest XML.
 *    Bounds parsing covers both shapes: Android's `bounds="[x1,y1][x2,y2]"`
 *    and iOS's `x` / `y` / `width` / `height` integer attributes.
 *  - `parseWebviewPageSource(html)` — Webview HTML document. Bounds is
 *    always null (no native rect in HTML source).
 *
 * Both are tolerant: malformed input returns `[]` instead of throwing, so the
 * IPC handler can fall back to "no elements" without crashing the renderer.
 */

const ANDROID_BOUNDS_RE = /^\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]$/;

function parseAndroidBounds(value: string | null | undefined): InspectorElement['bounds'] {
  if (!value) return null;
  const m = ANDROID_BOUNDS_RE.exec(value.trim());
  if (!m) return null;
  const [, x1s, y1s, x2s, y2s] = m;
  const x1 = Number(x1s);
  const y1 = Number(y1s);
  const x2 = Number(x2s);
  const y2 = Number(y2s);
  if (![x1, y1, x2, y2].every(Number.isFinite)) return null;
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

function parseIosBounds(attrs: Record<string, string>): InspectorElement['bounds'] {
  const x = Number(attrs.x);
  const y = Number(attrs.y);
  const w = Number(attrs.width);
  const h = Number(attrs.height);
  if (![x, y, w, h].every(Number.isFinite)) return null;
  if (attrs.x === undefined || attrs.y === undefined || attrs.width === undefined || attrs.height === undefined) {
    return null;
  }
  return { x, y, w, h };
}

interface MinimalNode {
  nodeType: number;
  nodeName: string;
  attributes?: { length: number; item: (i: number) => { name: string; value: string } | null } | null;
  childNodes?: { length: number; item: (i: number) => MinimalNode } | null;
}

const ELEMENT_NODE = 1;

function readAttrs(node: MinimalNode): Record<string, string> {
  const out: Record<string, string> = {};
  const attrs = node.attributes;
  if (!attrs) return out;
  for (let i = 0; i < attrs.length; i++) {
    const a = attrs.item(i);
    if (a) out[a.name] = a.value;
  }
  return out;
}

function elementChildren(node: MinimalNode): MinimalNode[] {
  const out: MinimalNode[] = [];
  const kids = node.childNodes;
  if (!kids) return out;
  for (let i = 0; i < kids.length; i++) {
    const c = kids.item(i);
    if (c && c.nodeType === ELEMENT_NODE) out.push(c);
  }
  return out;
}

function nodeToElement(node: MinimalNode, idPrefix: string, indexPath: string): InspectorElement {
  const attributes = readAttrs(node);
  const tag = node.nodeName;
  // Try Android first; fall back to iOS attribute shape.
  const bounds: InspectorElement['bounds'] =
    'bounds' in attributes ? parseAndroidBounds(attributes.bounds) : parseIosBounds(attributes);
  const id = `${idPrefix}:${indexPath}`;
  const children = elementChildren(node).map((child, i) =>
    nodeToElement(child, idPrefix, `${indexPath}:${i}`),
  );
  return { id, tag, attributes, bounds, children };
}

/**
 * Parses an Appium native page source.
 *
 * The page source is wrapped in a `<hierarchy>` root that itself has no
 * bounds; we drop it and return its element children as the top-level array,
 * so the root in the tree is the real application element.
 */
export function parseNativePageSource(xml: string): InspectorElement[] {
  if (!xml || !xml.trim()) return [];
  try {
    const doc = new DOMParser({
      onError: () => {
        /* swallow xmldom warnings — we already wrap in try/catch */
      },
    }).parseFromString(xml, 'text/xml');
    const root = (doc as unknown as { documentElement: MinimalNode | null }).documentElement;
    if (!root) return [];
    // Unwrap <hierarchy> if it's the documentElement: its children become roots.
    const tops =
      root.nodeName === 'hierarchy' ? elementChildren(root) : [root];
    return tops.map((n, i) => nodeToElement(n, 'native', String(i)));
  } catch {
    return [];
  }
}

/**
 * Parses a Webview HTML document.
 *
 * We extract the body element (or the documentElement if no body is present)
 * and walk its element children. xmldom is lenient enough to handle most
 * Appium-provided HTML; on hard failure we return [].
 */
export function parseWebviewPageSource(html: string): InspectorElement[] {
  if (!html || !html.trim()) return [];
  try {
    const doc = new DOMParser({
      onError: () => {
        /* swallow xmldom warnings — we already wrap in try/catch */
      },
    }).parseFromString(html, 'text/html');
    const root = (doc as unknown as { documentElement: MinimalNode | null }).documentElement;
    if (!root) return [];
    // Find a <body> child; if absent, walk the documentElement's children.
    const rootChildren = elementChildren(root);
    const body = rootChildren.find((c) => c.nodeName.toLowerCase() === 'body');
    const container: MinimalNode = body ?? root;
    return elementChildren(container).map((n, i) => nodeToElement(n, 'webview', String(i)));
  } catch {
    return [];
  }
}
