import { describe, it, expect } from 'vitest';
import {
  contrastRatio,
  judge,
  fingerprint,
  PROFILES,
  type CaptureResult,
  type Element,
} from '../../.harness/steward/project/impl/surface-checks.mjs';

/**
 * The judge is the "Core" half of the surface-verify contract
 * (.claude-plugin steward: contracts/surface-verify.md): it may only consume the
 * normalized model, never surface-specific vocabulary. These tests therefore
 * hand it hand-written models — no Electron, no DOM.
 */

const el = (over: Partial<Element> = {}): Element => ({
  role: 'text',
  text: 'hello',
  fg: [0, 0, 0],
  bg: [255, 255, 255],
  bounds: { x: 0, y: 0, w: 100, h: 30 },
  states: [],
  interactive: false,
  truncated: false,
  essential: true,
  ...over,
});

const capture = (over: Partial<CaptureResult> = {}): CaptureResult => ({
  surface: 'browser',
  target: 'page-x',
  formFactor: { label: 'wide', w: 1440, h: 900, unit: 'point', theme: 'light' },
  status: 'ok',
  capture: 'shots/wide.png',
  errors: [],
  elements: [el()],
  meta: { adapter: 'test', adapterVersion: '0', caveats: [] },
  ...over,
});

const checks = (r: ReturnType<typeof judge>) => r.findings.map((f) => f.check);

describe('surface-verify judge — contrast math', () => {
  it('rates black on white at 21:1 and identical colours at 1:1', () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 1);
    expect(contrastRatio([120, 120, 120], [120, 120, 120])).toBeCloseTo(1, 5);
  });

  it('is symmetric — order of the two colours does not matter', () => {
    expect(contrastRatio([10, 20, 30], [200, 210, 220])).toBeCloseTo(
      contrastRatio([200, 210, 220], [10, 20, 30]),
      5,
    );
  });

  it('blocks body text under 4.5:1', () => {
    // #949494 on white is ~2.9:1
    const r = judge([capture({ elements: [el({ fg: [148, 148, 148] })] })]);
    expect(checks(r)).toContain('contrast');
    expect(r.blockingCount).toBe(1);
  });

  it('allows the same colour once the text is large', () => {
    const r = judge([
      capture({ elements: [el({ fg: [117, 117, 117], textSize: { px: 24, bold: false } })] }),
    ]);
    // #757575 on white is ~4.6:1 — under 4.5 would fail, large-text 3:1 passes
    expect(checks(r)).not.toContain('contrast');
  });

  it('treats bold 19px as large text', () => {
    const r = judge([
      capture({ elements: [el({ fg: [140, 140, 140], textSize: { px: 19, bold: true } })] }),
    ]);
    expect(checks(r)).not.toContain('contrast');
  });

  it('skips elements with no text or no colour pair', () => {
    const r = judge([
      capture({
        elements: [el({ text: null, fg: [148, 148, 148] }), el({ bg: null, fg: [148, 148, 148] })],
      }),
    ]);
    expect(checks(r)).not.toContain('contrast');
  });

  it('does not apply contrast to a surface without colour', () => {
    const r = judge([
      capture({ surface: 'no-colour', elements: [el({ fg: [148, 148, 148] })] }),
    ], { profiles: { 'no-colour': { ...PROFILES.browser, hasColor: false } } });
    expect(checks(r)).not.toContain('contrast');
  });
});

describe('surface-verify judge — layout checks', () => {
  it('blocks two overlapping interactive elements', () => {
    const r = judge([
      capture({
        elements: [
          el({ role: 'button', interactive: true, bounds: { x: 0, y: 0, w: 50, h: 50 } }),
          el({ role: 'button', interactive: true, bounds: { x: 20, y: 20, w: 50, h: 50 } }),
        ],
      }),
    ]);
    expect(checks(r)).toContain('overlap');
  });

  it('ignores overlap between non-interactive elements', () => {
    const r = judge([
      capture({
        elements: [
          el({ bounds: { x: 0, y: 0, w: 50, h: 50 } }),
          el({ bounds: { x: 20, y: 20, w: 50, h: 50 } }),
        ],
      }),
    ]);
    expect(checks(r)).not.toContain('overlap');
  });

  it('ignores interactive elements that merely touch edges', () => {
    const r = judge([
      capture({
        elements: [
          el({ role: 'button', interactive: true, bounds: { x: 0, y: 0, w: 50, h: 50 } }),
          el({ role: 'button', interactive: true, bounds: { x: 50, y: 0, w: 50, h: 50 } }),
        ],
      }),
    ]);
    expect(checks(r)).not.toContain('overlap');
  });

  it('does not call containment an overlap', () => {
    // 중첩(탭이 탭목록 안에 있는 식)은 겹침이 아니다. 이걸 겹침으로 세면 어떤 화면도
    // 통과하지 못하고, 통과 못 하는 가드는 곧 무시된다.
    const r = judge([
      capture({
        elements: [
          el({ role: 'tablist', interactive: true, bounds: { x: 0, y: 0, w: 200, h: 40 } }),
          el({ role: 'tab', text: 'a', interactive: true, bounds: { x: 4, y: 4, w: 90, h: 32 } }),
          el({ role: 'tab', text: 'b', interactive: true, bounds: { x: 100, y: 4, w: 90, h: 32 } }),
        ],
      }),
    ]);
    expect(checks(r)).not.toContain('overlap');
  });

  it('still blocks partial overlap between nested-looking elements', () => {
    const r = judge([
      capture({
        elements: [
          el({ role: 'button', text: 'a', interactive: true, bounds: { x: 0, y: 0, w: 100, h: 40 } }),
          el({ role: 'button', text: 'b', interactive: true, bounds: { x: 90, y: 10, w: 100, h: 40 } }),
        ],
      }),
    ]);
    expect(checks(r)).toContain('overlap');
  });

  it('blocks truncation only when the content is essential', () => {
    const essential = judge([capture({ elements: [el({ truncated: true })] })]);
    expect(checks(essential)).toContain('truncation');

    const decorative = judge([
      capture({ elements: [el({ truncated: true, essential: false })] }),
    ]);
    expect(checks(decorative)).not.toContain('truncation');
  });

  it('blocks elements that spill outside the form factor sideways', () => {
    const r = judge([
      capture({ elements: [el({ bounds: { x: 1400, y: 10, w: 200, h: 20 } })] }),
    ]);
    expect(checks(r)).toContain('fits');
  });

  it('does not block content past the fold on a surface that scrolls that way', () => {
    // browser 프로파일은 세로로 스크롤된다 — 접힌 선 아래 내용은 결함이 아니다.
    const r = judge([
      capture({ elements: [el({ bounds: { x: 10, y: 2000, w: 200, h: 20 } })] }),
    ]);
    expect(checks(r)).not.toContain('fits');
  });

  it('blocks the same overflow on a surface that does not scroll', () => {
    const r = judge(
      [capture({ surface: 'fixed', elements: [el({ bounds: { x: 10, y: 2000, w: 200, h: 20 } })] })],
      { profiles: { fixed: { ...PROFILES.browser, scrollAxis: 'none' } } },
    );
    expect(checks(r)).toContain('fits');
  });

  it('blocks elements placed before the origin on either axis', () => {
    const r = judge([
      capture({ elements: [el({ bounds: { x: -30, y: 10, w: 200, h: 20 } })] }),
    ]);
    expect(checks(r)).toContain('fits');
  });

  it('blocks interactive targets under the minimum size when a pointer exists', () => {
    const small = { role: 'button', interactive: true, bounds: { x: 0, y: 0, w: 18, h: 18 } };
    const withPointer = judge([capture({ elements: [el(small)] })]);
    expect(checks(withPointer)).toContain('hit-target');

    const noPointer = judge(
      [capture({ surface: 'keys-only', elements: [el(small)] })],
      { profiles: { 'keys-only': { ...PROFILES.browser, hasPointer: false, hasTouch: false } } },
    );
    expect(checks(noPointer)).not.toContain('hit-target');
  });
});

describe('surface-verify judge — render and verifiability', () => {
  it('blocks when the surface reported errors', () => {
    const r = judge([capture({ errors: ['TypeError: boom'] })]);
    expect(checks(r)).toContain('render-ok');
  });

  it('reports cannot-verify instead of passing when a capture failed', () => {
    const r = judge([capture({ status: 'cannot-verify', elements: [] })]);
    expect(r.cannotVerify).toBe(true);
    expect(r.blockingCount).toBe(0);
  });

  it('reports cannot-verify for an empty record — nothing verified is not a pass', () => {
    const r = judge([]);
    expect(r.cannotVerify).toBe(true);
  });

  it('passes a clean capture', () => {
    const r = judge([capture()]);
    expect(r.findings).toEqual([]);
    expect(r.blockingCount).toBe(0);
    expect(r.cannotVerify).toBe(false);
  });
});

describe('surface-verify judge — baseline', () => {
  it('downgrades a known finding to an observation instead of blocking', () => {
    const record = [capture({ elements: [el({ fg: [148, 148, 148] })] })];
    const before = judge(record);
    expect(before.blockingCount).toBe(1);

    const baseline = { findings: [{ check: 'contrast', key: fingerprint(before.findings[0]) }] };
    const after = judge(record, { baseline });
    expect(after.blockingCount).toBe(0);
    expect(after.observationCount).toBe(1);
    expect(after.findings[0].severity).toBe('observe');
  });

  it('keeps blocking a finding the baseline does not cover', () => {
    const record = [capture({ elements: [el({ fg: [148, 148, 148] })] })];
    const after = judge(record, { baseline: { findings: [{ check: 'contrast', key: 'other' }] } });
    expect(after.blockingCount).toBe(1);
  });

  it('fingerprints on identity, not on pixel position', () => {
    const a = judge([capture({ elements: [el({ fg: [148, 148, 148] })] })]).findings[0];
    const b = judge([
      capture({ elements: [el({ fg: [148, 148, 148], bounds: { x: 7, y: 9, w: 101, h: 31 } })] }),
    ]).findings[0];
    expect(fingerprint(a)).toBe(fingerprint(b));
  });
});
