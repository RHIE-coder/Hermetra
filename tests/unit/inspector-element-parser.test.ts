import { describe, it, expect } from 'vitest';
import {
  parseNativePageSource,
  parseWebviewPageSource,
} from '@main/drivers/mobile/inspector-parser';
import type { InspectorElement } from '@shared/types/mobile';

/**
 * Spec acceptance criteria covered here (mobile-inspector-page §Affected layers):
 *
 *   AC8: 요소 추출 → Native + Webview tabs + count + tree.
 *   AC9: hover screenshot → outline highlight; click → bottom detail.
 *   AC10: tree node click → screenshot outline sync.
 *
 * These pure parsers translate raw Appium pageSource (Android UIAutomator XML
 * with `bounds="[x1,y1][x2,y2]"` attribute / iOS XCUITest XML with x/y/width/
 * height attrs / WebView HTML document) into a tree of `InspectorElement`.
 *
 * The bounds field is what powers the screenshot overlay hit-test, so the
 * parser is the only piece worth unit-testing in isolation (per spec §Affected
 * layers — "XML parser util ... pure function, easy to test").
 */

describe('parseNativePageSource — Android bounds format', () => {
  // AC8 (Android shape): root element parsed with class as tag and bounds rect.
  it('parses Android `bounds="[x1,y1][x2,y2]"` into {x, y, w, h}', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<hierarchy>
  <android.widget.FrameLayout bounds="[0,0][1080,1920]"
    package="com.example" resource-id="">
    <android.widget.TextView bounds="[10,20][210,90]" text="Hello"
      resource-id="com.example:id/title"/>
  </android.widget.FrameLayout>
</hierarchy>`;

    const tree = parseNativePageSource(xml);

    expect(tree).toHaveLength(1);
    const root = tree[0]!;
    expect(root.tag).toBe('android.widget.FrameLayout');
    expect(root.bounds).toEqual({ x: 0, y: 0, w: 1080, h: 1920 });
    expect(root.children).toHaveLength(1);
    const child = root.children[0]!;
    expect(child.tag).toBe('android.widget.TextView');
    expect(child.bounds).toEqual({ x: 10, y: 20, w: 200, h: 70 });
  });

  // AC8: each element has a stable id of form "native:<path>".
  it('assigns stable hierarchical ids (native:<i>:<j>...) to every node', () => {
    const xml = `<hierarchy>
  <node bounds="[0,0][100,100]">
    <node bounds="[0,0][50,50]"/>
    <node bounds="[50,50][100,100]"/>
  </node>
</hierarchy>`;

    const tree = parseNativePageSource(xml);
    const root = tree[0]!;
    expect(root.id).toBe('native:0');
    expect(root.children[0]!.id).toBe('native:0:0');
    expect(root.children[1]!.id).toBe('native:0:1');
  });

  // AC8/AC9: attribute dump must round-trip every XML attribute as a string.
  it('captures every XML attribute on each element verbatim in attributes{}', () => {
    const xml = `<hierarchy>
  <android.widget.Button
    bounds="[0,0][120,40]"
    text="Click me"
    resource-id="com.example:id/btn"
    clickable="true"
    enabled="true"/>
</hierarchy>`;

    const tree = parseNativePageSource(xml);
    const node = tree[0]!;
    expect(node.attributes.text).toBe('Click me');
    expect(node.attributes['resource-id']).toBe('com.example:id/btn');
    expect(node.attributes.clickable).toBe('true');
    expect(node.attributes.enabled).toBe('true');
  });

  // AC8: bounds is null when neither Android nor iOS format is present
  // (e.g. <hierarchy> root wrapper has no bounds).
  it('leaves bounds=null when neither Android nor iOS rect attributes are present', () => {
    const xml = `<hierarchy>
  <android.widget.FrameLayout>
    <android.widget.TextView bounds="[0,0][10,10]"/>
  </android.widget.FrameLayout>
</hierarchy>`;
    const tree = parseNativePageSource(xml);
    expect(tree[0]!.bounds).toBeNull();
    // Child still parses its bounds normally.
    expect(tree[0]!.children[0]!.bounds).toEqual({ x: 0, y: 0, w: 10, h: 10 });
  });

  // AC8 (iOS shape): XCUITest serialises rects as x/y/width/height integer attrs.
  it('parses iOS x/y/width/height integer attributes into {x, y, w, h}', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<XCUIElementTypeApplication name="Hello" x="0" y="0" width="375" height="812">
  <XCUIElementTypeButton name="Submit" x="20" y="100" width="100" height="40"/>
</XCUIElementTypeApplication>`;

    const tree = parseNativePageSource(xml);
    const root = tree[0]!;
    expect(root.tag).toBe('XCUIElementTypeApplication');
    expect(root.bounds).toEqual({ x: 0, y: 0, w: 375, h: 812 });
    const btn = root.children[0]!;
    expect(btn.tag).toBe('XCUIElementTypeButton');
    expect(btn.bounds).toEqual({ x: 20, y: 100, w: 100, h: 40 });
    expect(btn.attributes.name).toBe('Submit');
  });

  // Defensive: malformed bounds string (missing closing bracket) must not crash.
  it('returns bounds=null for malformed Android bounds attribute (does not throw)', () => {
    const xml = `<hierarchy>
  <node bounds="[0,0][not-a-number]"/>
</hierarchy>`;
    expect(() => parseNativePageSource(xml)).not.toThrow();
    const tree = parseNativePageSource(xml);
    expect(tree[0]!.bounds).toBeNull();
  });

  // Defensive: empty XML / no roots → []
  it('returns [] for an empty or whitespace-only document', () => {
    expect(parseNativePageSource('')).toEqual([]);
    expect(parseNativePageSource('   \n\n')).toEqual([]);
  });
});

describe('parseWebviewPageSource — HTML document', () => {
  // AC8 (Webview): parses a simple HTML body into an InspectorElement[] tree.
  it('parses HTML <body> children into an element tree, tag = lower-case tag name', () => {
    const html = `<!DOCTYPE html><html><body>
  <div id="root">
    <button class="primary">Hello</button>
  </div>
</body></html>`;

    const tree = parseWebviewPageSource(html);

    // There is one top-level element in <body> ('div#root').
    expect(tree).toHaveLength(1);
    const div = tree[0]!;
    expect(div.tag).toBe('div');
    expect(div.attributes.id).toBe('root');
    expect(div.children).toHaveLength(1);
    const btn = div.children[0]!;
    expect(btn.tag).toBe('button');
    expect(btn.attributes.class).toBe('primary');
  });

  // AC8: ids must be prefixed `webview:` so they don't collide with native ids.
  it('assigns stable hierarchical ids (webview:<i>:<j>...) per node', () => {
    const html = `<html><body>
  <ul><li>A</li><li>B</li></ul>
</body></html>`;
    const tree = parseWebviewPageSource(html);
    const ul = tree[0]!;
    expect(ul.id).toBe('webview:0');
    expect(ul.children[0]!.id).toBe('webview:0:0');
    expect(ul.children[1]!.id).toBe('webview:0:1');
  });

  // AC8 / Webview tab "No webview context" state — when input is empty, []
  it('returns [] for empty input (used when there is no webview context)', () => {
    expect(parseWebviewPageSource('')).toEqual([]);
  });

  // The parser must be tolerant — invalid HTML should still produce something or [].
  it('does not throw on malformed HTML input', () => {
    expect(() => parseWebviewPageSource('<div><span></div>')).not.toThrow();
  });
});

describe('parser output shape', () => {
  // Type-level sanity: every node returned by parseNativePageSource conforms to
  // InspectorElement. We assert the runtime shape here so the parser cannot
  // silently break the contract InspectorElement promises.
  it('every native node has id, tag, attributes{}, bounds, children[]', () => {
    const xml = `<hierarchy>
  <node bounds="[0,0][1,1]" k="v">
    <leaf bounds="[0,0][1,1]"/>
  </node>
</hierarchy>`;
    const walk = (n: InspectorElement) => {
      expect(typeof n.id).toBe('string');
      expect(typeof n.tag).toBe('string');
      expect(typeof n.attributes).toBe('object');
      expect(n.attributes).not.toBeNull();
      expect(Array.isArray(n.children)).toBe(true);
      // bounds is either null or has numeric x/y/w/h.
      if (n.bounds !== null) {
        expect(typeof n.bounds.x).toBe('number');
        expect(typeof n.bounds.y).toBe('number');
        expect(typeof n.bounds.w).toBe('number');
        expect(typeof n.bounds.h).toBe('number');
      }
      for (const c of n.children) walk(c);
    };
    for (const root of parseNativePageSource(xml)) walk(root);
  });
});
