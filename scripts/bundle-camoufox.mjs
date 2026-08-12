/**
 * Stages the **Camoufox browser** into `resources/camoufox/` for packaging.
 *
 * Without this the app has no browser until someone presses start, and then it
 * stalls for ~700 MB of download — or fails outright on a machine with no
 * network. `resolveCamoufoxDir()` in `src/main/sidecar/index.ts` finds what
 * this leaves behind and points the sidecar child at it.
 *
 * It shells out to `camoufox-js fetch` with `CAMOUFOX_INSTALL_DIR` redirected
 * rather than unzipping a release by hand. The layout that command produces —
 * the app bundle, the GeoIP database, and the `version.json` the library checks
 * before trusting a directory — is the layout the library expects, and
 * reproducing it here would be a second copy of a rule that lives over there.
 *
 * **Host platform only.** The fetcher picks its release from the OS it is
 * running on, so this cannot stage a Windows browser from a mac the way
 * `bundle-node.mjs` can. That is the same limit the packaging notes already
 * record for win32 and linux.
 *
 *   node scripts/bundle-camoufox.mjs           스테이징 (이미 있으면 건너뜀)
 *   node scripts/bundle-camoufox.mjs --force   지우고 다시 받는다
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'resources', 'camoufox');
const STAMP = path.join(OUT_DIR, 'version.json');
const FORCE = process.argv.slice(2).includes('--force');

const CLI = path.join(ROOT, 'node_modules', 'camoufox-js', 'dist', '__main__.js');

/** Bytes under a directory. Reported so the packaged size is never a surprise. */
function sizeOf(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) total += sizeOf(p);
    else if (entry.isFile()) total += fs.statSync(p).size;
  }
  return total;
}

function main() {
  if (!fs.existsSync(CLI)) {
    throw new Error(`camoufox-js 가 없다: ${CLI} — npm install 먼저`);
  }

  if (fs.existsSync(STAMP) && !FORCE) {
    const mb = (sizeOf(OUT_DIR) / 1024 / 1024).toFixed(0);
    process.stdout.write(`이미 준비됨: ${path.relative(ROOT, OUT_DIR)} (${mb}MB) — 다시 받으려면 --force\n`);
    return;
  }

  if (FORCE) fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  process.stdout.write(`Camoufox 를 ${path.relative(ROOT, OUT_DIR)} 로 받는다 (수백 MB, 몇 분 걸린다)\n`);
  // Real Node, not Electron: this pulls in `better-sqlite3`, whose shipped
  // build segfaults under Electron's V8. A build script runs under node, so
  // this is the one place it is safe — the same reason the sidecar exists.
  const run = spawnSync(process.execPath, [CLI, 'fetch'], {
    stdio: 'inherit',
    env: { ...process.env, CAMOUFOX_INSTALL_DIR: OUT_DIR },
  });

  if (run.status !== 0) {
    throw new Error(`camoufox-js fetch 가 ${run.status} 로 끝났다`);
  }
  if (!fs.existsSync(STAMP)) {
    // Without the stamp the app refuses the directory, so a silent partial
    // fetch must fail the build rather than ship an unusable folder.
    throw new Error(`받았는데 version.json 이 없다: ${STAMP}`);
  }

  const mb = (sizeOf(OUT_DIR) / 1024 / 1024).toFixed(0);
  process.stdout.write(`준비됨: ${path.relative(ROOT, OUT_DIR)} (${mb}MB, ${process.platform}/${process.arch})\n`);
}

try {
  main();
} catch (e) {
  process.stderr.write(`bundle-camoufox 실패: ${e.message}\n`);
  process.exit(1);
}
