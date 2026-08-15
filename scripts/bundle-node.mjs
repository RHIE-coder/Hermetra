/**
 * Stages a **real Node runtime** into `resources/node/` for packaging.
 *
 * The fetch sidecar cannot run on Electron's V8: `camoufox-js` depends on
 * `better-sqlite3`, whose shipped build is V8-ABI, and it segfaults under
 * Electron — in the main process and under `ELECTRON_RUN_AS_NODE` alike
 * (`docs/spec/pipeline/README.md`). `process.execPath` is therefore unusable
 * and a Node binary has to ship beside the app.
 *
 * Downloads the official build for the target platform rather than copying the
 * developer's, so a mac can stage a Windows runtime and the result does not
 * depend on whatever happens to be installed.
 *
 *   node scripts/bundle-node.mjs                    현재 플랫폼
 *   node scripts/bundle-node.mjs --platform=win32 --arch=x64
 *   node scripts/bundle-node.mjs --version=v22.14.0
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { pipeline } from 'node:stream/promises';

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const ROOT = path.resolve(import.meta.dirname, '..');
// Pinned rather than "whatever is newest": a runtime that changes under you
// turns one packaged build into a different one for no recorded reason.
//
// Not any pin, though. The workbench imports the user's `.ts` script directly
// and lets the runtime strip its types (docs/spec/studio/browser.md —
// `AC-studio.browser-21`), which needs a Node that does that unflagged. 22.14
// did not, so this line is a requirement, not a preference.
const VERSION = arg('version', 'v24.19.0');
const PLATFORM = arg('platform', process.platform);
const ARCH = arg('arch', process.arch);
const OUT_DIR = path.join(ROOT, 'resources', 'node');
const CACHE = path.join(ROOT, '.cache', 'node-runtime');

const isWin = PLATFORM === 'win32';
const slug = `node-${VERSION}-${PLATFORM === 'win32' ? 'win' : PLATFORM}-${ARCH}`;
const archive = `${slug}.${isWin ? 'zip' : 'tar.gz'}`;
const url = `https://nodejs.org/dist/${VERSION}/${archive}`;
const binName = isWin ? 'node.exe' : 'node';

async function download(dest) {
  process.stdout.write(`내려받는 중: ${url}\n`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  await pipeline(res.body, fs.createWriteStream(dest));
}

async function main() {
  fs.mkdirSync(CACHE, { recursive: true });
  const archivePath = path.join(CACHE, archive);
  if (!fs.existsSync(archivePath)) await download(archivePath);
  else process.stdout.write(`캐시 사용: ${archivePath}\n`);

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetra-node-'));
  if (isWin) execFileSync('unzip', ['-q', archivePath, '-d', work]);
  else execFileSync('tar', ['-xzf', archivePath, '-C', work]);

  const from = isWin
    ? path.join(work, slug, binName)
    : path.join(work, slug, 'bin', binName);
  if (!fs.existsSync(from)) throw new Error(`아카이브에 ${binName} 이 없다: ${from}`);

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const to = path.join(OUT_DIR, binName);
  fs.copyFileSync(from, to);
  if (!isWin) fs.chmodSync(to, 0o755);
  fs.rmSync(work, { recursive: true, force: true });

  const mb = (fs.statSync(to).size / 1024 / 1024).toFixed(1);
  process.stdout.write(`준비됨: ${path.relative(ROOT, to)} (${mb}MB, ${VERSION} ${PLATFORM}/${ARCH})\n`);
}

main().catch((e) => {
  process.stderr.write(`bundle-node 실패: ${e.message}\n`);
  process.exit(1);
});
