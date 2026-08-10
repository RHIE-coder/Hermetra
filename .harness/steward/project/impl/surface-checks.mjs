#!/usr/bin/env node
// surface-checks — surface-verify 계약의 "판정" 절반.
//
// 불변식(계약 §0): 이 파일은 **정규화 모델만** 먹는다. 픽셀·DOM·CSS·브라우저 같은
// 표면 어휘가 여기 나오면 결합 누수다. 판별 질문 — "TUI 만 쓰는 프로젝트가 이 파일을
// 한 글자도 안 고치고 쓸 수 있나?" 답이 '예' 여야 한다. 값을 뽑는 일은 어댑터의 몫.
//
// 사용법 (steward 의 surface-gate 훅이 이 형태로 부른다):
//   node surface-checks.mjs <record.json>
// 종료코드: 0 전부 통과 · 1 차단 위반 있음 · 2 cannot-verify (검증 불가 ≠ 통과).
// stdout: { blockingCount, observationCount, cannotVerify, findings[] } JSON.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
// 기준선 — 변경 전에도 나던 findings 는 차단에서 빼고 관찰로만 남긴다(계약 §5).
// 기존 문제로 매번 막으면 "이 실패는 무시해도 됨"이 학습돼 가드가 무력화된다.
const BASELINE_PATH = resolve(HERE, '..', 'surface-baseline.json');

/** 표면을 이름이 아니라 능력으로 기술한다 (계약 §1). */
export const PROFILES = {
  browser: {
    hasColor: true,
    boundsUnit: 'point',
    // 이 표면은 세로로 스크롤된다 — fits 는 가로 넘침만 결함으로 본다.
    scrollAxis: 'y',
    hasPointer: true,
    hasTouch: false,
    hasFocus: true,
    largeTextRule: 'size',
    minTarget: 24,
  },
  'native-desktop': {
    hasColor: true,
    boundsUnit: 'point',
    scrollAxis: 'y',
    hasPointer: true,
    hasTouch: false,
    hasFocus: true,
    largeTextRule: 'size',
    minTarget: 24,
  },
  mobile: {
    hasColor: true,
    boundsUnit: 'dp',
    scrollAxis: 'y',
    hasPointer: false,
    hasTouch: true,
    hasFocus: true,
    largeTextRule: 'size',
    minTarget: 44,
  },
  tui: {
    hasColor: true,
    boundsUnit: 'cell',
    // 문자 화면은 판이 고정이다 — 넘치면 그대로 잘려 보이지 않는다.
    scrollAxis: 'none',
    hasPointer: false,
    hasTouch: false,
    hasFocus: true,
    // 단일 크기 표면은 완화 기준이 없다 — 항상 본문 임계값을 쓴다.
    largeTextRule: 'none',
    minTarget: 1,
  },
};

const BODY_MIN = 4.5; // WCAG 2.2 SC 1.4.3 본문
const LARGE_MIN = 3.0; // 같은 기준의 큰 텍스트 완화

/** sRGB 상대 휘도 (WCAG 2.2). */
export function relativeLuminance([r, g, b]) {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** 두 색의 대비비. 순서와 무관하다. */
export function contrastRatio(a, b) {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * finding 의 신원. 위치가 아니라 **무엇이 어디서 걸렸나**로 만든다 — 레이아웃이 1픽셀
 * 움직일 때마다 기준선이 무효가 되면 기준선은 아무 쓸모가 없다.
 */
export function fingerprint(f) {
  return [f.check, f.formFactor, f.theme ?? '-', f.subject].join('|');
}

const label = (e) => `${e.role}:${(e.text ?? '').trim().slice(0, 40)}`;

const contains = (outer, inner) =>
  inner.x >= outer.x - 0.5 &&
  inner.y >= outer.y - 0.5 &&
  inner.x + inner.w <= outer.x + outer.w + 0.5 &&
  inner.y + inner.h <= outer.y + outer.h + 0.5;

function overlaps(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return false; // 맞닿은 것은 겹친 것이 아니다
  // 한쪽이 다른 쪽을 완전히 품고 있으면 중첩(부모-자식)이다 — 서로를 가리는 겹침이 아니다.
  // 이 예외가 없으면 탭이 탭목록 안에 있는 것 같은 정상 구조가 전부 위반이 된다.
  return !contains(a, b) && !contains(b, a);
}

function textThreshold(profile, element) {
  if (profile.largeTextRule !== 'size') return BODY_MIN;
  const size = element.textSize;
  if (!size) return BODY_MIN;
  const large = size.px >= 24 || (size.bold && size.px >= 18.66);
  return large ? LARGE_MIN : BODY_MIN;
}

/**
 * 정규화 모델 배열을 판정한다.
 * @param {CaptureResult[]} results
 * @param {{ baseline?: {findings: {check: string, key: string}[]}, profiles?: object }} [options]
 */
export function judge(results, options = {}) {
  const profiles = { ...PROFILES, ...(options.profiles ?? {}) };
  const baselineKeys = new Set((options.baseline?.findings ?? []).map((f) => f.key));
  const findings = [];
  let cannotVerify = results.length === 0; // 아무것도 안 봤으면 통과가 아니다

  for (const r of results) {
    const ff = r.formFactor ?? { label: '?', w: 0, h: 0, unit: '?' };
    const ctx = { surface: r.surface, formFactor: ff.label, theme: ff.theme ?? null };
    if (r.status !== 'ok') {
      cannotVerify = true;
      continue;
    }
    const profile = profiles[r.surface];
    if (!profile) {
      // 프로파일을 모르면 어떤 검사가 적용되는지 알 수 없다 — 조용히 통과시키지 않는다.
      cannotVerify = true;
      continue;
    }

    const add = (check, subject, detail) =>
      findings.push({ ...ctx, check, subject, detail, severity: 'block' });

    if ((r.errors ?? []).length) {
      for (const err of r.errors) add('render-ok', String(err).slice(0, 80), String(err));
    }

    const elements = r.elements ?? [];
    for (const e of elements) {
      if (profile.hasColor && e.text && e.fg && e.bg) {
        const need = textThreshold(profile, e);
        const got = contrastRatio(e.fg, e.bg);
        if (got + 1e-9 < need) {
          add('contrast', label(e), `${got.toFixed(2)}:1 < ${need}:1`);
        }
      }
      if (e.essential !== false && e.truncated) {
        add('truncation', label(e), 'essential content is cut off');
      }
      if (profile.boundsUnit && e.bounds) {
        const b = e.bounds;
        // 그 표면이 스크롤되는 축으로 내용이 넘치는 것은 결함이 아니다 — 스크롤이 그 축의
        // 답이기 때문이다. 원점보다 앞(음수)은 어느 축이든 결함이다: 스크롤로 닿을 수 없다.
        const scroll = profile.scrollAxis ?? 'none';
        const checkX = scroll !== 'x' && scroll !== 'both';
        const checkY = scroll !== 'y' && scroll !== 'both';
        const out =
          b.x < -0.5 ||
          b.y < -0.5 ||
          (checkX && b.x + b.w > ff.w + 0.5) ||
          (checkY && b.y + b.h > ff.h + 0.5);
        if (out) {
          add('fits', label(e), `bounds ${b.x},${b.y} ${b.w}x${b.h} outside ${ff.w}x${ff.h}`);
        }
      }
      // 표적 크기는 **그 표적의 크기**를 재는 것이다. `offscreen` 은 보이는 조각이 전부가
      // 아니라는 뜻이고(나머지는 스크롤하면 나온다), 그때의 사각형은 크기가 아니라 위치를
      // 말한다 — 그걸 크기로 읽으면 스크롤되는 목록의 마지막 줄이 언제나 위반이 된다.
      // 못 닿는 잘림은 `offscreen` 이 아니므로 여기서 그대로 걸린다.
      if ((profile.hasPointer || profile.hasTouch) && e.interactive && e.bounds && !e.offscreen) {
        const min = profile.minTarget ?? 24;
        if (e.bounds.w + 1e-9 < min || e.bounds.h + 1e-9 < min) {
          add('hit-target', label(e), `${e.bounds.w}x${e.bounds.h} < ${min}`);
        }
      }
    }

    if (profile.boundsUnit) {
      const targets = elements.filter((e) => e.interactive && e.bounds);
      for (let i = 0; i < targets.length; i++) {
        for (let j = i + 1; j < targets.length; j++) {
          if (overlaps(targets[i].bounds, targets[j].bounds)) {
            const pair = [label(targets[i]), label(targets[j])].sort().join(' + ');
            add('overlap', pair, 'interactive elements overlap');
          }
        }
      }
    }
  }

  for (const f of findings) {
    if (baselineKeys.has(fingerprint(f))) f.severity = 'observe';
  }

  return {
    blockingCount: findings.filter((f) => f.severity === 'block').length,
    observationCount: findings.filter((f) => f.severity === 'observe').length,
    cannotVerify,
    findings,
  };
}

/* ── CLI ─────────────────────────────────────────────────────────────── */

function main(argv) {
  const file = argv[0];
  if (!file) {
    process.stderr.write('usage: surface-checks.mjs <record.json>\n');
    return 2;
  }
  let record;
  try {
    record = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    process.stderr.write(`cannot-verify: ${file} is unreadable (${e.message})\n`);
    return 2;
  }
  const results = Array.isArray(record) ? record : (record.results ?? []);
  let baseline;
  if (existsSync(BASELINE_PATH)) {
    try {
      baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
    } catch {
      process.stderr.write(`cannot-verify: baseline ${BASELINE_PATH} is unreadable\n`);
      return 2;
    }
  }
  const verdict = judge(results, { baseline });
  process.stdout.write(JSON.stringify(verdict, null, 2) + '\n');
  if (verdict.cannotVerify) return 2;
  return verdict.blockingCount > 0 ? 1 : 0;
}

// 직접 실행일 때만 CLI. 테스트는 순수 함수만 가져간다.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exit(main(process.argv.slice(2)));
}
