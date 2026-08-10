#!/usr/bin/env node
// surface-verify — 이 프로젝트의 표면 어댑터 (Electron 데스크탑, browser 프로파일).
//
// 역할 분담(계약 §0): **값을 뽑는 것만** 여기서 한다. 무엇이 위반인지는 판정기
// (surface-checks.mjs)가 정한다. 그래서 여기엔 DOM·CSS 어휘가 있어도 되고,
// 판정기엔 있으면 안 된다.
//
// 사용법:
//   node .harness/steward/project/impl/surface-verify.mjs                # 화면 전부 × 3폼팩터 × 2테마
//   node .harness/steward/project/impl/surface-verify.mjs --nav=nav-bridge-bus
//   node .harness/steward/project/impl/surface-verify.mjs --form=narrow --theme=dark
//   node .harness/steward/project/impl/surface-verify.mjs --write-baseline
//
// 산출: <바통>/surface-verify.json = CaptureResult[] (정규화 모델). surface-gate 훅이
//   이 파일을 읽고 판정기를 **직접 다시 돌린다** — 여기 적힌 status 를 믿지 않는다.
// 종료코드: 0 통과 · 1 차단 위반 · 2 cannot-verify. 2를 통과로 승격 금지.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { judge, fingerprint } from './surface-checks.mjs';

const ADAPTER_VERSION = '1';
const ROOT = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const MAIN_ENTRY = path.join(ROOT, 'out', 'main', 'index.js');
const RENDERER_ENTRY = path.join(ROOT, 'out', 'renderer', 'index.html');
const BASELINE_PATH = path.join(ROOT, '.harness', 'steward', 'project', 'surface-baseline.json');

const arg = (name, fallback = null) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const flag = (name) => process.argv.slice(2).includes(`--${name}`);

// 화면 목록의 정본은 e2e 스모크의 NAV_ITEMS 다 — 두 곳에 적으면 갈라진다.
function navTargets() {
  const spec = fs.readFileSync(path.join(ROOT, 'tests', 'e2e', 'smoke.spec.ts'), 'utf8');
  const ids = [...spec.matchAll(/testid:\s*'(nav-[a-z-]+)'/g)].map((m) => m[1]);
  if (!ids.length) throw new Error('nav 목록을 smoke.spec.ts 에서 읽지 못했다');
  return ids;
}

// 접힌 서랍 안의 화면도 판정 대상이다 — 행이 DOM 에 없으면 서랍을 열고 다시 본다.
// 못 열면 그대로 둔다: 뒤따르는 click 이 실패하고 그 캡처가 cannot-verify 로 남는 것이
// 맞다(못 본 것을 통과로 적지 않는다).
// 서랍은 둘이고 따로 접힌다 — 행이 속한 서랍의 손잡이를 잡는다.
const drawerToggle = (nav) =>
  nav.startsWith('nav-pipeline-') ? 'nav-pipeline-toggle' : 'nav-legacy-toggle';

async function revealNav(win, nav) {
  if (await win.getByTestId(nav).isVisible().catch(() => false)) return;
  const toggle = win.getByTestId(drawerToggle(nav));
  if (await toggle.isVisible().catch(() => false)) await toggle.click();
}

// 폼팩터: 좁음·중간·넓음 (계약 §4 — 픽셀 표면은 최소 3구성). 창 크기 단위는 화면점.
const FORMS = {
  narrow: { label: 'narrow', w: 1024, h: 720 },
  medium: { label: 'medium', w: 1280, h: 800 },
  wide: { label: 'wide', w: 1600, h: 1000 },
};

const built = () => fs.existsSync(MAIN_ENTRY) && fs.existsSync(RENDERER_ENTRY);

function featureName() {
  const cfg = path.join(ROOT, '.harness', 'steward', 'config.yaml');
  if (fs.existsSync(cfg)) {
    const m = fs.readFileSync(cfg, 'utf8').match(/^feature:\s*(.+)$/m);
    if (m) {
      const v = m[1].replace(/#.*$/, '').trim().replace(/^["']|["']$/g, '');
      if (v) return v;
    }
  }
  const r = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  const branch = (r.stdout ?? '').trim();
  if (branch && branch !== 'HEAD') return branch.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return 'default';
}

/**
 * 렌더러 안에서 도는 추출기. 여기서 뽑은 값이 정규화 모델의 알맹이다.
 *   - 실효 배경색: 조상을 거슬러 올라가 불투명한 색을 만날 때까지 알파 합성한다.
 *     (버튼 위의 반투명 오버레이 같은 것을 "그냥 흰색" 으로 착각하면 대비 판정이 거짓말을 한다)
 *   - 잘림: 가로 스크롤 폭이 보이는 폭보다 크고 넘침이 감춰져 있으면 잘린 것으로 본다.
 *   - essential: 기본 true. 장식용 아이콘·구분선은 텍스트가 없으니 애초에 대비 대상이 아니다.
 */
const EXTRACTOR = () => {
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (fgc, bgc) => [
    Math.round(fgc.r * fgc.a + bgc[0] * (1 - fgc.a)),
    Math.round(fgc.g * fgc.a + bgc[1] * (1 - fgc.a)),
    Math.round(fgc.b * fgc.a + bgc[2] * (1 - fgc.a)),
  ];
  const effectiveBg = (node) => {
    const stack = [];
    let el = node;
    while (el) {
      const c = parse(getComputedStyle(el).backgroundColor);
      if (c && c.a > 0) {
        if (c.a >= 0.999) {
          let acc = [c.r, c.g, c.b];
          for (let i = stack.length - 1; i >= 0; i--) acc = over(stack[i], acc);
          return acc;
        }
        stack.push(c);
      }
      el = el.parentElement;
    }
    let acc = [255, 255, 255];
    for (let i = stack.length - 1; i >= 0; i--) acc = over(stack[i], acc);
    return acc;
  };
  const roleOf = (el) => {
    const explicit = el.getAttribute('role');
    if (explicit) return explicit;
    const tag = el.tagName.toLowerCase();
    if (tag === 'button') return 'button';
    if (tag === 'a') return 'link';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return 'input';
    return 'text';
  };
  const INTERACTIVE = 'button, a[href], a[data-testid], input, textarea, select, [role="button"], [role="tab"], [role="menuitem"], [tabindex]:not([tabindex="-1"])';

  /**
   * 보이는 영역으로 잘라낸 사각형. 조상 중 넘침을 감추거나 자체 스크롤하는 것이 있으면
   * 그 안쪽으로 교집합을 취한다. 안 그러면 편집기 같은 내부 스크롤러의 내용이 "화면 밖으로
   * 삐져나온 것" 으로 잡히고(Monaco 는 폭 16777214 짜리 측정 노드를 둔다), 사람이 실제로
   * 보는 것과 모델이 어긋난다.
   *
   * 잘림에는 두 종류가 있고, 둘을 같이 신고하면 판정기가 거짓말을 한다:
   *
   *   - **못 닿는 잘림.** 스크롤되지 않는 조상이 잘랐다. 남은 조각이 그 요소의 전부다.
   *   - **스크롤로 닿는 잘림.** 그 축으로 실제 스크롤되는 조상이 잘랐다. 나머지는 사라진 게
   *     아니라 접힌 선 아래에 있다 — 목록이 길어지면 늘 생기는 정상 상태다.
   *
   * 뒤쪽을 `offscreen` 으로 표시해 내보낸다. 크기 판정(표적)은 이걸 보고 빠져야 한다.
   * 화면 밖으로 밀린 32px 행을 "7px 짜리 못 누를 표적" 으로 읽으면, 스크롤되는 목록을
   * 가진 표면은 전부 영구 위반이 된다.
   */
  const visibleRect = (node) => {
    const r = node.getBoundingClientRect();
    let box = { l: r.left, t: r.top, rt: r.right, b: r.bottom };
    let offscreen = false;
    let el = node.parentElement;
    while (el) {
      const cs = getComputedStyle(el);
      if (cs.overflow !== 'visible' || cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        const p = el.getBoundingClientRect();
        const next = {
          l: Math.max(box.l, p.left),
          t: Math.max(box.t, p.top),
          rt: Math.min(box.rt, p.right),
          b: Math.min(box.b, p.bottom),
        };
        // 잘린 축과 스크롤되는 축이 같을 때만 "닿을 수 있다" 고 본다.
        const cutY = next.t > box.t + 0.5 || next.b < box.b - 0.5;
        const cutX = next.l > box.l + 0.5 || next.rt < box.rt - 0.5;
        if (cutY && el.scrollHeight > el.clientHeight + 1) offscreen = true;
        if (cutX && el.scrollWidth > el.clientWidth + 1) offscreen = true;
        box = next;
        if (box.rt <= box.l || box.b <= box.t) return null; // 완전히 잘려 보이지 않는다
      }
      el = el.parentElement;
    }
    return { x: box.l, y: box.t, w: box.rt - box.l, h: box.b - box.t, offscreen };
  };

  const out = [];
  const seen = new Set();
  const push = (el, forceInteractive) => {
    if (seen.has(el)) return;
    const rect = visibleRect(el);
    if (!rect || rect.w <= 0 || rect.h <= 0) return;
    // 화면과 겹치는 부분이 아예 없는 요소는 보이지 않는다 — 스크린리더용 숨김 노드나
    // 측정용 노드가 판을 벗어난 좌표(-15985 같은)에 사는 정상 패턴이다. 일부라도 걸치면
    // 남긴다 — 그게 진짜 "삐져나온" 결함이다.
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    if (rect.x + rect.w <= 0 || rect.y + rect.h <= 0 || rect.x >= vw || rect.y >= vh) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return;
    seen.add(el);
    // 자기 자신의 텍스트만 센다 — 컨테이너가 자손의 글자를 자기 것처럼 신고하면
    // 색 짝이 엉뚱해진다.
    const own = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(' ')
      .trim();
    const fgc = parse(cs.color);
    const bg = effectiveBg(el);
    const interactive = forceInteractive || el.matches(INTERACTIVE);
    const states = [];
    if (el === document.activeElement) states.push('focused');
    if (el.matches(':disabled, [aria-disabled="true"], [disabled]')) states.push('disabled');
    if (el.matches('[aria-selected="true"], [data-state="active"]')) states.push('selected');
    const clipped = cs.overflow !== 'visible' || cs.textOverflow === 'ellipsis';
    out.push({
      role: roleOf(el),
      text: own || null,
      fg: own && fgc ? over(fgc, bg) : null,
      bg: own ? bg : null,
      bounds: {
        x: Math.round(rect.x * 100) / 100,
        y: Math.round(rect.y * 100) / 100,
        w: Math.round(rect.w * 100) / 100,
        h: Math.round(rect.h * 100) / 100,
      },
      states,
      interactive,
      // 보이는 조각이 전부가 아니다 — 나머지는 스크롤하면 나온다.
      ...(rect.offscreen ? { offscreen: true } : {}),
      truncated: Boolean(own) && clipped && el.scrollWidth > el.clientWidth + 1,
      essential: true,
      textSize: own
        ? { px: parseFloat(cs.fontSize) || 0, bold: (parseInt(cs.fontWeight, 10) || 400) >= 700 }
        : undefined,
    });
  };

  for (const el of document.querySelectorAll(INTERACTIVE)) push(el, true);
  for (const el of document.querySelectorAll('body *')) push(el, false);
  return out;
};

async function main() {
  if (!built()) {
    console.log('· out/ 산출물이 없거나 불완전 — npm run build 먼저 돌린다');
    const b = spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' });
    if (b.status !== 0 || !built()) {
      console.error('cannot-verify: 빌드 실패 — 화면을 띄울 수 없다');
      return 2;
    }
  }

  const navs = arg('nav') ? [arg('nav')] : navTargets();
  const forms = arg('form') ? [FORMS[arg('form')]] : [FORMS.narrow, FORMS.medium, FORMS.wide];
  const themes = arg('theme') ? [arg('theme')] : ['light', 'dark'];
  if (forms.some((f) => !f)) {
    console.error(`cannot-verify: --form 은 ${Object.keys(FORMS).join(' | ')} 중 하나다`);
    return 2;
  }

  const featureDir = path.join(ROOT, '.harness', 'steward', 'artifacts', featureName());
  const shotDir = path.join(featureDir, 'shots');
  fs.mkdirSync(shotDir, { recursive: true });

  const { _electron: electron } = await import('@playwright/test');
  const results = [];

  for (const theme of themes) {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetra-surface-'));
    let app;
    try {
      app = await electron.launch({
        args: [MAIN_ENTRY, `--user-data-dir=${userDataDir}`],
        env: { ...process.env, HERMETRA_DRIVERS: 'mock', NODE_ENV: 'test' },
      });
      const win = await app.firstWindow();
      const errors = [];
      win.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      win.on('pageerror', (e) => errors.push(String(e)));
      await win.waitForLoadState('domcontentloaded');

      // 테마는 next-themes 가 localStorage 로 든다 — 심고 다시 읽혀야 확정된다.
      await win.evaluate((t) => localStorage.setItem('theme', t), theme);
      await win.reload();
      await win.waitForLoadState('domcontentloaded');
      await win.waitForTimeout(300);

      for (const form of forms) {
        await app.evaluate(({ BrowserWindow }, size) => {
          const [w] = BrowserWindow.getAllWindows();
          if (w) { w.setSize(size.w, size.h); w.center(); }
        }, form);
        await win.waitForTimeout(200);

        for (const nav of navs) {
          const before = errors.length;
          const target = `${nav}@${form.label}@${theme}`;
          const shot = path.join(shotDir, `${nav.replace(/^nav-/, '')}-${form.label}-${theme}.png`);
          let status = 'ok';
          let elements = [];
          try {
            await revealNav(win, nav);
            await win.getByTestId(nav).click();
            await win.getByTestId(nav.replace(/^nav-/, 'page-')).waitFor({ state: 'visible', timeout: 15_000 });
            await win.waitForTimeout(350); // 전환 애니메이션
            await win.screenshot({ path: shot });
            elements = await win.evaluate(EXTRACTOR);
          } catch (e) {
            status = 'cannot-verify';
            errors.push(`${target}: ${e instanceof Error ? e.message : String(e)}`);
          }
          // 폼팩터로 신고하는 값은 창 크기가 아니라 **이 표면이 실제로 그리는 판**이다.
          //   폭 = 보이는 폭. 폭을 넘치면 가로 스크롤이 생기는 결함이다.
          //   높이 = 스크롤 가능한 문서 높이. 이 표면은 세로로 스크롤되므로 접힌 선 아래에
          //   내용이 있는 것은 결함이 아니다 — 창 높이로 신고하면 fits 가 통째로 거짓말을 한다.
          const viewport = await win.evaluate(() => ({
            w: document.documentElement.clientWidth,
            h: Math.max(
              document.documentElement.scrollHeight,
              document.documentElement.clientHeight,
            ),
          }));
          results.push({
            surface: 'browser',
            target,
            formFactor: { label: form.label, w: viewport.w, h: viewport.h, unit: 'point', theme },
            status,
            capture: path.relative(ROOT, shot),
            errors: errors.slice(before),
            elements,
            meta: {
              adapter: 'electron-renderer',
              adapterVersion: ADAPTER_VERSION,
              caveats: [
                '실효 배경색은 조상 합성으로 근사한다 — 그림자·필터·배경 이미지는 반영되지 않는다',
                '잘림은 가로 넘침만 본다',
                'bounds 는 조상 클리핑을 반영한 보이는 영역이다 — 내부 스크롤러(편집기) 안의 넘침은 결함으로 세지 않는다',
                '접힌 선 아래 · 화면 밖 요소는 모델에 넣지 않는다 — 이 캡처가 검증하는 것은 그 폼팩터에서 실제로 보이는 것뿐이다',
                'formFactor.h 는 스크롤 가능한 문서 높이다 — 세로 스크롤은 결함이 아니므로 fits 는 사실상 가로 넘침만 잡는다',
                'mock 드라이버 상태의 화면이므로 데이터가 채워진 상태의 레이아웃은 덮지 않는다',
              ],
            },
          });
          process.stdout.write(`· ${target} ${status === 'ok' ? `요소 ${elements.length}` : 'cannot-verify'}\n`);
        }
      }
    } catch (e) {
      console.error(`cannot-verify: ${e instanceof Error ? e.message : String(e)}`);
      results.push({
        surface: 'browser', target: `launch@${theme}`,
        formFactor: { label: '-', w: 0, h: 0, unit: 'point', theme },
        status: 'cannot-verify', capture: '', errors: [String(e)], elements: [],
        meta: { adapter: 'electron-renderer', adapterVersion: ADAPTER_VERSION, caveats: [] },
      });
    } finally {
      try { await app?.close(); } catch { /* 죽었어도 임시 디렉터리는 치운다 */ }
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  }

  const record = path.join(featureDir, 'surface-verify.json');
  fs.writeFileSync(record, JSON.stringify(results, null, 2));
  console.log(`✓ 기록: ${path.relative(ROOT, record)} (캡처 ${results.length}건)`);

  const baseline = fs.existsSync(BASELINE_PATH)
    ? JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'))
    : undefined;

  if (flag('write-baseline')) {
    const fresh = judge(results);
    const entries = fresh.findings.map((f) => ({
      check: f.check, key: fingerprint(f), subject: f.subject, detail: f.detail,
    }));
    fs.writeFileSync(BASELINE_PATH, JSON.stringify({
      recordedAt: new Date().toISOString(),
      note: '변경 전에도 나던 findings. 차단에서 빼고 관찰로만 남긴다(계약 §5). 하나씩 고치고 이 목록에서 지운다.',
      findings: entries,
    }, null, 2) + '\n');
    console.log(`✓ 기준선 기록: ${path.relative(ROOT, BASELINE_PATH)} (${entries.length}건)`);
    return fresh.cannotVerify ? 2 : 0;
  }

  const verdict = judge(results, { baseline });
  const byCheck = {};
  for (const f of verdict.findings) {
    byCheck[f.check] ??= { block: 0, observe: 0 };
    byCheck[f.check][f.severity]++;
  }
  console.log('판정:');
  for (const [check, n] of Object.entries(byCheck)) {
    console.log(`  ${check.padEnd(11)} 차단 ${n.block} · 관찰 ${n.observe}`);
  }
  if (!verdict.findings.length) console.log('  위반 없음');
  for (const f of verdict.findings.filter((x) => x.severity === 'block').slice(0, 20)) {
    console.log(`  [차단] ${f.check} ${f.formFactor}/${f.theme} — ${f.subject} (${f.detail})`);
  }
  if (verdict.cannotVerify) {
    console.error('cannot-verify: 렌더에 실패한 캡처가 있다 — 통과로 승격하지 않는다');
    return 2;
  }
  return verdict.blockingCount > 0 ? 1 : 0;
}

process.exit(await main());
