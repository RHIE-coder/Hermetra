#!/usr/bin/env node
// ui-shot — steward 능력 바인딩. 빌드된 Electron 앱을 띄워 화면을 캡처한다.
// 증거는 도구가 만든다(surface-verify 계약 §0) — "봤다"는 말이 아니라 이 스크립트의 산출물이 증거다.
//
// 사용법:
//   node .harness/steward/project/impl/ui-shot.mjs
//   node .harness/steward/project/impl/ui-shot.mjs --nav=nav-mobile-devices
//   node .harness/steward/project/impl/ui-shot.mjs --nav=nav-bridge-bus --size=1024x720 --out=/tmp/bus.png
//
// 옵션:
//   --nav=<testid>   사이드바 항목을 눌러 그 화면으로 이동한 뒤 캡처 (page-* 렌더까지 기다린다)
//   --size=WxH       창 크기 (기본 1440x900) — 폼팩터별 캡처에 쓴다
//   --out=<path>     저장 경로 (기본 .harness/steward/artifacts/<작업폴더>/shots/<이름>.png)
//   --user-data-dir  기본은 임시 디렉터리 — 유저의 실제 워크스페이스 데이터를 건드리지 않는다
//
// 종료코드: 0 캡처 성공 · 2 cannot-verify(빌드/실행/캡처 실패). 2를 통과로 승격하지 말 것.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const MAIN_ENTRY = path.join(ROOT, 'out', 'main', 'index.js');
// 렌더러 산출물까지 봐야 한다 — main 만 있고 out/renderer 가 없으면 창이 아예 안 뜬다.
const RENDERER_ENTRY = path.join(ROOT, 'out', 'renderer', 'index.html');

const arg = (name, fallback = null) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const nav = arg('nav');
const [w, h] = (arg('size', '1440x900').split('x').map(Number));
if (!Number.isFinite(w) || !Number.isFinite(h)) {
  console.error('cannot-verify: --size 형식은 WxH 다 (예: --size=1280x800)');
  process.exit(2);
}

// 작업 바통 폴더 규칙은 steward 계약과 같다: config 의 feature → git 브랜치 슬러그 → default.
function currentFeature() {
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

// 캡처는 작업 바통 폴더가 이미 있으면 그 안에 둔다(그 작업의 증거니까). 없으면 바통 밖에
// 둔다 — 스크린샷 한 장 찍은 것이 커밋 관문 훅(바통 존재 = 하네스 작업 진행 중)을 켜면 안 된다.
function defaultOutDir() {
  const feature = currentFeature();
  const baton = path.join(ROOT, '.harness', 'steward', 'artifacts', feature);
  if (fs.existsSync(baton)) return path.join(baton, 'shots');
  return path.join(ROOT, '.harness', 'steward', 'shots', feature);
}
const outPath = path.resolve(
  arg('out', path.join(defaultOutDir(), `${nav ? nav.replace(/^nav-/, '') : 'boot'}-${w}x${h}.png`)),
);

const built = () => fs.existsSync(MAIN_ENTRY) && fs.existsSync(RENDERER_ENTRY);
if (!built()) {
  console.log('· out/ 산출물이 없거나 불완전 — npm run build 먼저 돌린다');
  const build = spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' });
  if (build.status !== 0 || !built()) {
    console.error('cannot-verify: 빌드 실패 — 화면을 띄울 수 없다');
    process.exit(2);
  }
}

const { _electron: electron } = await import('@playwright/test');

const userDataDir = arg('user-data-dir') ?? fs.mkdtempSync(path.join(os.tmpdir(), 'hermetra-uishot-'));
const ownsUserDataDir = !arg('user-data-dir');
const consoleErrors = [];
let app;
try {
  app = await electron.launch({
    args: [MAIN_ENTRY, `--user-data-dir=${userDataDir}`],
    // 드라이버는 mock — 캡처가 실제 브라우저·기기 세션을 열지 않는다.
    env: { ...process.env, HERMETRA_DRIVERS: 'mock', NODE_ENV: 'test' },
  });

  const win = await app.firstWindow();
  win.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  win.on('pageerror', (e) => consoleErrors.push(String(e)));
  await win.waitForLoadState('domcontentloaded');

  await app.evaluate(({ BrowserWindow }, size) => {
    const [target] = BrowserWindow.getAllWindows();
    if (target) { target.setSize(size.w, size.h); target.center(); }
  }, { w, h });

  if (nav) {
    // nav-<x> 를 누르면 page-<x> 가 떠야 한다 — 그 렌더까지 기다린 뒤 캡처한다(준비 전 캡처 금지).
    await win.getByTestId(nav).click();
    await win.getByTestId(nav.replace(/^nav-/, 'page-')).waitFor({ state: 'visible', timeout: 15_000 });
  }
  await win.waitForTimeout(400); // 전환 애니메이션이 끝난 뒤 찍는다

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await win.screenshot({ path: outPath });

  console.log(`✓ 캡처: ${path.relative(ROOT, outPath)} (${w}x${h}${nav ? ` · ${nav}` : ''})`);
  if (consoleErrors.length) {
    console.log(`⚠ 렌더러 콘솔 에러 ${consoleErrors.length}건 — 화면이 그려졌어도 통과로 보지 말 것:`);
    for (const e of consoleErrors.slice(0, 10)) console.log(`  - ${e}`);
  }
} catch (e) {
  console.error(`cannot-verify: ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 2;
} finally {
  try { await app?.close(); } catch { /* 앱이 죽었어도 임시 디렉터리는 치운다 */ }
  if (ownsUserDataDir) fs.rmSync(userDataDir, { recursive: true, force: true });
}
