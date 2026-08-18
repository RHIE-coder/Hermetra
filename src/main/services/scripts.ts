import fs from 'node:fs';
import path from 'node:path';
import type { ScriptFile, ScriptFileBody, ScriptMoveRequest } from '@shared/types/web';
import { STUDIO_AMBIENT_DTS } from '@shared/studio/ambient';
import { workspaceManager } from './workspaceManager';

type Slot = 'web' | 'mobile' | 'studio';

/**
 * What the tree shows. Wider than "what runs" on purpose: the guides
 * (`GUIDE_ko.md`, `GUIDE_en.md`) are seeded into this folder, and a guide nobody
 * can open is not a guide. The editor already highlights markdown; only this
 * filter was hiding it. The Run button is what draws the line between openable
 * and runnable — see `RUNNABLE_EXT` in the editor.
 */
const LISTED_EXT = /\.(ts|js|tsx|jsx|md)$/i;

const SEED_WEB = `// Web automation script.
//   page: the active Playwright page
//   env:  process env variables
//   bus:  shared variable bus
//   log:  append to the run output
//
// example:
//   await page.goto(env.BASE_URL ?? 'https://example.com');
//   log('title:', await page.title());
//   bus.set('page.title', await page.title());

await page.goto('https://example.com');
log('title:', await page.title());
`;

const SEED_MOBILE = `// Mobile automation script (WebdriverIO + Appium).
//   driver: WebdriverIO browser instance
//   env:    process env variables
//   bus:    shared variable bus
//   log:    append to the run output
//
// example:
//   const el = await driver.$('~login');
//   await el.click();
//   bus.set('mobile.loginClicked', '1');

const el = await driver.$('~login');
await el.click();
log('login tapped');
`;

/**
 * The studio seed is a **script**, not a contract.
 *
 * It runs top to bottom, the way the Playwright documentation writes one, and
 * everything it uses is either the language or the library. Nothing on the page
 * is this app's invention — the runner imports the file with a real Node
 * runtime, so TypeScript, `import` and installed packages are simply available.
 *
 * Leading with an export contract made a workbench for trying things look like a
 * framework to fill in, which is the opposite of what this screen is. The
 * `extract`/`transform` pair the seed once advertised is gone from the runner
 * too (2026-08-18) — a file runs top to bottom, and a default export is the only
 * thing called on the author's behalf.
 *
 * **It imports, and the file it imports is seeded with it.** Saying "imports of
 * your other scripts work" in a comment leaves the two things that actually bite
 * to be guessed — which folder, and that `.ts` is not optional — and both are
 * invisible until a run fails. A line that runs answers them without being read
 * as instructions. Anything named here has to be exported over in SEED_STUDIO_LIB
 * (`tests/api/scripts.test.ts` reads the import clause and checks).
 */
const SEED_STUDIO = `// Browser workbench. This file is a script: it runs top to bottom, as written,
// in a real Node runtime. TypeScript, imports of your other scripts, and any
// package you install under scripts/ (npm i cheerio) all work.
//
// Already in scope: page (the active tab) · context · browser · ctx.url (the
// address bar) · env. console.log lands in the panel below, as it happens.
// GUIDE_ko.md / GUIDE_en.md, next to this file, have the rest — including why
// the browser being Firefox matters when you read the Playwright docs.

// ── Using one of your own files ─────────────────────────────────────────────
// \`clean\` and \`Row\` are not this app's. They are in lib/rows.ts, one folder
// down; open it, it is an ordinary module. The '.ts' is not optional — Node
// loads these as ES modules, and an ES module asks for a file by its real name.
// An installed package is a bare name instead: import { load } from 'cheerio';
import { clean, type Row } from './lib/rows.ts';

await page.goto(ctx.url ?? 'https://example.com');
console.log('title:', await page.title());

/** Everything matching \`selector\`, as rows of text. */
const rowsOf = (selector: string): Promise<Row[]> =>
  page.$$eval(selector, (els: Element[]) => els.map((el) => ({ text: el.textContent ?? '' })));

const raw: Row[] = await rowsOf('h1, p, a');

// Both, so you can see what the imported function actually did: wrapped text
// collapsed onto one line, blanks dropped, repeats dropped.
console.log('raw    ', raw);
console.log('cleaned', clean(raw));
`;

/**
 * The other side of the seed's import.
 *
 * It has to be worth importing. The first version trimmed one string, which
 * anybody would write inline — so the example demonstrated the mechanics of
 * `import` and nothing about why a `lib/` folder exists. This one has enough
 * logic that repeating it in every script would be the annoyance the folder
 * exists to remove.
 *
 * Its API is a break from the one shipped before 2026-08-14 (`clean(row)` took a
 * single row). That is why the pair is replaced together — see
 * `replaceUntouchedSeed`.
 */
const SEED_STUDIO_LIB = `// Your own module — nothing here is this app's invention. Whatever you would
// rather not write twice goes in a file like this, and your scripts import it.

export interface Row {
  text: string;
}

/**
 * Text pulled off a page comes wrapped across lines, padded, and repeated.
 * Doing this once inline is fine. Doing it in every script is the reason this
 * file exists.
 */
export function clean(rows: Row[]): Row[] {
  const seen = new Set<string>();
  const out: Row[] = [];
  for (const row of rows) {
    const text = row.text.replace(/\\s+/g, ' ').trim();
    if (text === '' || seen.has(text)) continue;
    seen.add(text);
    out.push({ ...row, text });
  }
  return out;
}
`;

/**
 * Every `lib/rows.ts` this app has written.
 *
 * Same rule as the seed: a copy still byte-for-byte one of ours is ours to
 * replace, and one changed line makes it theirs. Not a template — a record.
 */
const PAST_STUDIO_LIBS = [
  // Shipped alongside the stage-contract seed, and still on disk in every
  // workspace opened before 2026-08-14.
  `export interface Row {
  title: string;
}

/** Shared helpers live here and are imported by whatever needs them. */
export function clean(row: Row): Row {
  return { ...row, title: row.title.trim() };
}
`,
  // 2026-08-14, briefly: reworded, same one-row API.
  `// A plain module. Nothing here is this app's invention — put whatever you reuse
// in files like this one and import them from your scripts.

export interface Row {
  title: string;
}

export function clean(row: Row): Row {
  return { ...row, title: row.title.trim() };
}
`,
  // 2026-08-14, and still what ships: listed so a pair holding it can have its
  // script upgraded (`replaceUntouchedSeed` stops when the companion is not ours).
  `// Your own module — nothing here is this app's invention. Whatever you would
// rather not write twice goes in a file like this, and your scripts import it.

export interface Row {
  text: string;
}

/**
 * Text pulled off a page comes wrapped across lines, padded, and repeated.
 * Doing this once inline is fine. Doing it in every script is the reason this
 * file exists.
 */
export function clean(rows: Row[]): Row[] {
  const seen = new Set<string>();
  const out: Row[] = [];
  for (const row of rows) {
    const text = row.text.replace(/\\s+/g, ' ').trim();
    if (text === '' || seen.has(text)) continue;
    seen.add(text);
    out.push({ ...row, text });
  }
  return out;
}
`,
];

/**
 * The studio seeds this app has shipped before.
 *
 * A seed only lands in an **empty** slot, so a workspace opened once keeps
 * whatever starter file shipped that day — and the ones below teach a runtime
 * this app no longer has (`new Function`, no types, an import that would have
 * thrown). They are matched byte for byte: an untouched file is ours to
 * replace, and one changed line makes it the person's, which we leave alone.
 *
 * Do not edit these strings to match a new seed. They are a record of what was
 * written to disk, not a template.
 */
const PAST_STUDIO_SEEDS = [
  // Shipped 2026-08-12..13, and before that under the name `pipeline`.
  `// Stage script. Stages reference the functions this exports.
//   extract(page, ctx)  → ingestion. Returns raw rows, unchanged.
//   transform(raw)      → processing. Reshapes them for storage.
//
// Reuse needs nothing new: put a shared step in its own file under lib/ and
// pull it in with an ordinary ES module import.

export async function extract(page, ctx) {
  await page.goto(ctx.url ?? 'https://example.com');
  return page.$$eval('h1', (els) => els.map((el) => ({ title: el.textContent })));
}

export function transform(raw) {
  return raw.map((row) => ({ ...row, title: row.title?.trim() }));
}
`,
]
  .flatMap((seed) => [seed, seed.replace('// Stage script.', '// Pipeline script.')])
  .concat([
    // 2026-08-13, briefly: the runtime was right by then, but the seed still led
    // with the stage contract instead of a script.
    `// Stage script. Stages reference the functions this exports.
//   extract(page, ctx)  → ingestion. Returns raw rows, unchanged.
//   transform(raw)      → processing. Reshapes them for storage.
//
// This is a real module. TypeScript, the import below, and any package you
// install under scripts/ (npm i cheerio) all work — the file is imported by a
// real Node runtime, not evaluated as a string.

import { clean, type Row } from './lib/rows.ts'; // the extension is not optional in ESM

export async function extract(page: any, ctx: { url?: string }): Promise<Row[]> {
  await page.goto(ctx.url ?? 'https://example.com');
  return page.$$eval('h1', (els: Element[]) =>
    els.map((el) => ({ title: el.textContent ?? '' })),
  );
}

export function transform(raw: Row[]): Row[] {
  return raw.map(clean);
}
`,
    // 2026-08-13..14: a script by then, and right about the runtime — but with
    // nothing to import, so "imports of your other scripts work" stayed a claim.
    // Someone opened the workbench, saw a lib/ folder left over from the seed
    // above, and had to ask what it was for.
    `// Browser workbench. This file is a script: it runs top to bottom, as written,
// in a real Node runtime. TypeScript, imports of your other scripts, and any
// package you install under scripts/ (npm i cheerio) all work.
//
// Already in scope: page (the active tab) · context · browser · ctx.url (the
// address bar) · env. console.log lands in the panel below, as it happens.

await page.goto(ctx.url ?? 'https://example.com');

const title: string = await page.title();
console.log('title:', title);

const headings: string[] = await page.$$eval('h1', (els: Element[]) =>
  els.map((el) => el.textContent?.trim() ?? ''),
);
console.log(headings.length, 'headings', headings);

// A pipeline stage calls a script by the function it exports instead:
//   export async function extract(page, ctx) { ... }
//   export function transform(raw) { ... }
`,
    // 2026-08-14, briefly: the import demo had landed, but the file still signed
    // off with the stage contract — three lines naming a convention this app
    // invented, for screens that are not built, with nothing explaining either.
    // "왜 필요한지 모르겠음" was the reply, and it was the right one.
    `// Browser workbench. This file is a script: it runs top to bottom, as written,
// in a real Node runtime. TypeScript, imports of your other scripts, and any
// package you install under scripts/ (npm i cheerio) all work.
//
// Already in scope: page (the active tab) · context · browser · ctx.url (the
// address bar) · env. console.log lands in the panel below, as it happens.

// Your own file, one folder down — open lib/rows.ts to see the other side.
// The '.ts' is not optional: Node loads these as ES modules, and an ES module
// asks for the file by its real name. A package you installed is a bare name
// instead: import { load } from 'cheerio';
import { clean, type Row } from './lib/rows.ts';

await page.goto(ctx.url ?? 'https://example.com');

const title: string = await page.title();
console.log('title:', title);

const headings: Row[] = await page.$$eval('h1', (els: Element[]) =>
  els.map((el) => ({ title: el.textContent ?? '' })),
);
console.log(headings.length, 'headings', headings.map(clean));

// A pipeline stage calls a script by the function it exports instead:
//   export async function extract(page, ctx) { ... }
//   export function transform(raw) { ... }
`,
    // 2026-08-14..18: right about everything except where the guide is. It sent
    // the reader to `GUIDE.md`, and 2026-08-18 split that file into one per
    // language, so the pointer in every workspace opened in those four days
    // names a file the app now deletes.
    `// Browser workbench. This file is a script: it runs top to bottom, as written,
// in a real Node runtime. TypeScript, imports of your other scripts, and any
// package you install under scripts/ (npm i cheerio) all work.
//
// Already in scope: page (the active tab) · context · browser · ctx.url (the
// address bar) · env. console.log lands in the panel below, as it happens.
// GUIDE.md, next to this file, has the rest — including why the browser being
// Firefox matters when you read the Playwright docs.

// ── Using one of your own files ─────────────────────────────────────────────
// \`clean\` and \`Row\` are not this app's. They are in lib/rows.ts, one folder
// down; open it, it is an ordinary module. The '.ts' is not optional — Node
// loads these as ES modules, and an ES module asks for a file by its real name.
// An installed package is a bare name instead: import { load } from 'cheerio';
import { clean, type Row } from './lib/rows.ts';

await page.goto(ctx.url ?? 'https://example.com');
console.log('title:', await page.title());

/** Everything matching \`selector\`, as rows of text. */
const rowsOf = (selector: string): Promise<Row[]> =>
  page.$$eval(selector, (els: Element[]) => els.map((el) => ({ text: el.textContent ?? '' })));

const raw: Row[] = await rowsOf('h1, p, a');

// Both, so you can see what the imported function actually did: wrapped text
// collapsed onto one line, blanks dropped, repeats dropped.
console.log('raw    ', raw);
console.log('cleaned', clean(raw));
`,
  ]);

/**
 * The slot root is a **module root**.
 *
 * Node resolves both `./lib/x.ts` and a bare package name by walking up from the
 * script file, so this one file is what turns the folder a person edits in into
 * somewhere they can \`npm i cheerio\`. The app does not install anything on
 * their behalf — quietly fetching dependencies is not ours to do.
 */
const SEED_PACKAGE_JSON = `{
  "name": "hermetra-workspace-scripts",
  "private": true,
  "type": "module"
}
`;

/**
 * The globals the runner injects before importing a script.
 *
 * They exist so a snippet copied from the legacy web screen still runs inside a
 * module (`page` would otherwise be a free variable). Writing them down is what
 * stops an editor from painting that snippet red; it changes nothing at
 * runtime. The renderer hands Monaco the same text — see `@shared/studio`.
 */
const SEED_ENV_DTS = STUDIO_AMBIENT_DTS;

/**
 * The guide, seeded next to the scripts — one file per language.
 *
 * It exists because of a question nobody could answer from inside the app:
 * "what syntax do I even look up?" (2026-08-14). Two thirds of the answer is
 * Playwright's own documentation and can only be a link. The other third —
 * which globals are already in scope, that the engine under Playwright is
 * Firefox, that a relative import keeps its `.ts` — is this app's own, is
 * written down nowhere a person would think to look, and is what this file is
 * for.
 *
 * It ships as a file in the workspace rather than a panel in the UI so that it
 * opens in the same editor as the scripts, works with no network, and can be
 * edited or deleted like anything else in that folder.
 *
 * **Both languages, always** (2026-08-18). Every string the UI shows exists in
 * `en` and `ko` — `MessageKey` will not compile otherwise — and the one document
 * that explains how to write a script was English only. Seeding just the one
 * matching the current UI language would make a guide that disappears when
 * somebody flips the switch, and the person reading is the one who knows which
 * language they want. So both are laid down and the tree shows the choice.
 */
const GUIDE_FILES = ['GUIDE_ko.md', 'GUIDE_en.md'] as const;

/** The single English guide shipped from 2026-08-14 to 2026-08-18. */
const LEGACY_GUIDE = 'GUIDE.md';

const SEED_GUIDE_EN = `# Browser workbench — what to read, and what is this app's own

This file was put here by Hermetra. Edit it, or delete it; it is yours.
The same guide in Korean is beside it, in \`GUIDE_ko.md\`.

## The short version

A script here is an ordinary file that a real Node process imports as an ES
module. **Nothing in it is this app's invention** except the six globals in the
table below. So the syntax you look up is:

| For | Read |
|---|---|
| \`page\`, \`context\`, \`browser\` — everything you do to the browser | <https://playwright.dev/docs/api/class-page> |
| The language itself | TypeScript / ES modules |
| The six globals | this file |

**The engine is Firefox.** The workbench browser is Camoufox, a Firefox build,
and the app connects to it with Playwright's \`firefox\`. Anything the Playwright
docs mark Chromium-only does not work here (CDP sessions, \`page.coverage\`, and
a handful of \`route\`/emulation options). Check that label before you copy.

Versions in use: playwright 1.60, camoufox-js 0.12.

## Already in scope — no import needed

| Name | What it is |
|---|---|
| \`page\` | the active tab, a real Playwright \`Page\` |
| \`context\` | the context it belongs to. \`await context.newPage()\` opens another tab |
| \`browser\` | the browser itself, if you want a context of your own |
| \`ctx\` | \`{ url?: string }\` — the address bar as the run saw it |
| \`log(...)\` | same destination as \`console.log\`: the output panel below |
| \`env\` | environment variables of the process running the script |

There is also a \`bus\`, and it is **not wired yet**: \`bus.set(k, v)\` only prints a
line to the output panel, and \`bus.get()\` always returns \`undefined\`. To pass a
value between scripts today, use a file or a return value.

These are declared in \`../hermetra-env.d.ts\`, which is why your editor does not
paint them red. They are typed \`any\`, so there is no autocompletion. If you want
it, open the \`scripts/\` folder in your own editor, \`npm i -D playwright\` there,
and narrow what you need:

\`\`\`ts
const p = page as import('playwright').Page;
\`\`\`

Inside this app's editor it stays \`any\` either way — Monaco has no filesystem
here, so module resolution is switched off.

## Importing

\`\`\`ts
import { clean } from './lib/rows.ts';   // your own file — keep the .ts
import { load } from 'cheerio';          // a package — bare name
\`\`\`

The extension is not optional. Node loads these as ES modules, and an ES module
asks for a file by its real name. It resolves from **the script's own folder**,
so \`./lib/rows.ts\` means the \`lib\` next to this file.

Packages install where the folder is a module root:

\`\`\`
cd <this workspace>/scripts
npm i cheerio
\`\`\`

The app does not install anything for you.

## Running

The Run button runs the file open in the editor, top to bottom.
\`console.log\` lands in the output panel as it happens, not at the end.

Nothing else is called for you, with one exception: if the file's **default
export** is a function, Run calls it with \`(page, ctx)\` and prints what it
returns, with a row count. That is how a script hands back a value.

\`\`\`ts
export default async (page, ctx) => {
  await page.goto(ctx.url);
  return page.$$eval('h1', (els) => els.map((el) => el.textContent));
};
\`\`\`
`;

/** The same guide, in Korean. Kept beside the English one, not generated from it. */
const SEED_GUIDE_KO = `# 브라우저 작업대 — 무엇을 찾아보고, 무엇이 이 앱 고유인가

이 파일은 Hermetra 가 놓아 둔 것입니다. 고쳐도 되고 지워도 됩니다. 당신 파일입니다.
같은 내용의 영어판이 옆에 있습니다: \`GUIDE_en.md\`.

## 짧은 요약

여기 있는 스크립트는 진짜 Node 프로세스가 ES 모듈(= 파일 하나가 곧 모듈인, 자바스크립트
표준 모듈 방식)로 불러오는 평범한 파일입니다. **아래 표의 전역 여섯 개 말고는 이 앱이
지어낸 것이 하나도 없습니다.** 그래서 찾아볼 곳은 이렇습니다:

| 무엇을 | 어디서 |
|---|---|
| \`page\`, \`context\`, \`browser\` — 브라우저에 하는 모든 것 | <https://playwright.dev/docs/api/class-page> |
| 언어 자체 | TypeScript / ES 모듈 |
| 전역 여섯 개 | 이 파일 |

**엔진은 Firefox 입니다.** 작업대의 브라우저는 Firefox 로 만든 Camoufox 이고, 앱은
Playwright 의 \`firefox\` 로 붙습니다. Playwright 문서에서 Chromium 전용이라고 표시된 것은
여기서 동작하지 않습니다(CDP 세션, \`page.coverage\`, \`route\`·에뮬레이션 옵션 몇 가지).
베껴 오기 전에 그 표시를 확인하세요.

쓰는 버전: playwright 1.60, camoufox-js 0.12.

## 이미 스코프에 있는 것 — import 필요 없음

| 이름 | 무엇인가 |
|---|---|
| \`page\` | 지금 보고 있는 탭. 진짜 Playwright \`Page\` |
| \`context\` | 그 탭이 속한 컨텍스트. \`await context.newPage()\` 로 탭을 하나 더 연다 |
| \`browser\` | 브라우저 자체. 컨텍스트를 직접 만들고 싶을 때 |
| \`ctx\` | \`{ url?: string }\` — 실행이 본 그 순간의 주소창 |
| \`log(...)\` | \`console.log\` 와 같은 곳으로 간다: 아래 출력 패널 |
| \`env\` | 스크립트를 돌리는 프로세스의 환경 변수 |

\`bus\` 도 있지만 **아직 안 이어져 있습니다**: \`bus.set(k, v)\` 는 출력 패널에 줄 하나를
찍을 뿐이고, \`bus.get()\` 은 언제나 \`undefined\` 를 돌려줍니다. 지금 스크립트끼리 값을
넘기려면 파일이나 반환값을 쓰세요.

이 이름들은 \`../hermetra-env.d.ts\` 에 선언돼 있고, 그래서 편집기가 빨간 줄을 긋지
않습니다. 타입이 \`any\` 라 자동완성은 없습니다. 자동완성이 필요하면 \`scripts/\` 폴더를
당신이 쓰는 편집기로 열어 \`npm i -D playwright\` 한 뒤, 필요한 것만 좁혀 쓰세요:

\`\`\`ts
const p = page as import('playwright').Page;
\`\`\`

이 앱의 편집기 안에서는 어느 쪽이든 \`any\` 로 남습니다 — 여기 Monaco 는 파일 시스템이 없어
모듈 해석이 꺼져 있습니다.

## import

\`\`\`ts
import { clean } from './lib/rows.ts';   // 당신 파일 — .ts 를 붙인 채로
import { load } from 'cheerio';          // 패키지 — 이름만
\`\`\`

확장자는 선택이 아닙니다. Node 가 이 파일들을 ES 모듈로 불러오고, ES 모듈은 파일을 진짜
이름으로 찾습니다. 기준은 **그 스크립트가 있는 폴더**라, \`./lib/rows.ts\` 는 이 파일 옆의
\`lib\` 을 가리킵니다.

패키지는 폴더가 모듈 뿌리인 자리에 설치합니다:

\`\`\`
cd <이 워크스페이스>/scripts
npm i cheerio
\`\`\`

앱이 대신 설치해 주지는 않습니다.

## 실행

\`실행\` 버튼은 편집기에 열려 있는 파일을 위에서 아래로 돌립니다.
\`console.log\` 는 끝나고 한꺼번에가 아니라, 찍히는 그때 아래 출력 패널로 갑니다.

앱이 대신 불러 주는 것은 하나뿐입니다: 파일의 **기본 내보내기(default export)** 가 함수면
\`실행\` 이 \`(page, ctx)\` 로 부르고, 돌려준 값을 줄 수와 함께 찍습니다. 스크립트가 값을
돌려주는 방법입니다.

\`\`\`ts
export default async (page, ctx) => {
  await page.goto(ctx.url);
  return page.$$eval('h1', (els) => els.map((el) => el.textContent));
};
\`\`\`
`;

/**
 * The studio slot was called `pipeline` until 2026-08-12, when the browser
 * workbench moved out of the Data Pipeline service (`docs/spec/studio/`).
 *
 * A slot is a directory holding files a person wrote, so renaming it in the code
 * alone would not rename anything — it would hide their scripts behind a name
 * nothing reads, and `seedIfEmpty` would then drop a starter file into the empty
 * new folder. That reads as "my scripts are gone".
 *
 * Both folders existing means a half-finished move, or an older build writing
 * again after a newer one migrated. The new one is live and the old one is left
 * alone — merging two folders would have to guess which side of a name clash to
 * keep, and guessing wrong overwrites work.
 */
function migrateLegacySlot(root: string, slot: Slot): void {
  if (slot !== 'studio') return;
  const legacy = path.join(root, 'pipeline');
  const current = path.join(root, slot);
  if (!fs.existsSync(legacy) || fs.existsSync(current)) return;
  fs.renameSync(legacy, current);
}

/**
 * Written once, then left alone. Both files are things a person edits — the
 * dependency list they installed, the ambient types they extended — and
 * rewriting either on every listing would quietly undo their work.
 */
function ensureModuleRoot(root: string): void {
  for (const [name, source] of [
    ['package.json', SEED_PACKAGE_JSON],
    ['hermetra-env.d.ts', SEED_ENV_DTS],
  ] as const) {
    const file = path.join(root, name);
    if (!fs.existsSync(file)) fs.writeFileSync(file, source, 'utf-8');
  }
}

/**
 * Put both guides in the slot if they are not there.
 *
 * Not part of `seedIfEmpty`: that only fires into an **empty** slot, and the
 * person who needs a guide is the one already looking at a folder full of their
 * own files. Written when absent and then left alone, like the module-root
 * files — so an edited copy survives, and a deleted one comes back next listing.
 * That is the trade: this is documentation the app ships, not the person's work,
 * and a guide you can lose for good is worse than one that reappears.
 *
 * A revised guide will need what the seed already has (replace only a copy that
 * is byte-for-byte one the app wrote). There is only one version of each so far,
 * so that machinery is not here yet.
 */
function ensureGuide(slotDir: string): void {
  // The single English guide is gone as a name, not only as a file: left beside
  // the pair it puts three guides in the tree with two of them saying the same
  // thing, and the person cannot tell which one the app maintains. It is removed
  // even when edited — the user chose that on 2026-08-18 over a stale copy that
  // never leaves — which makes this the one place here that can drop somebody's
  // own writing, and the reason `GUIDE.md` is not a name to keep notes under.
  const legacy = path.join(slotDir, LEGACY_GUIDE);
  if (fs.existsSync(legacy)) fs.rmSync(legacy);

  for (const [name, source] of [
    [GUIDE_FILES[0], SEED_GUIDE_KO],
    [GUIDE_FILES[1], SEED_GUIDE_EN],
  ] as const) {
    const file = path.join(slotDir, name);
    if (!fs.existsSync(file)) fs.writeFileSync(file, source, 'utf-8');
  }
}

function dir(slot: Slot): string {
  const root = path.join(workspaceManager().activeDir(), 'scripts');
  // Before the mkdir below: creating the new folder first would make the move
  // look like the both-folders-exist case and strand the old one forever.
  fs.mkdirSync(root, { recursive: true });
  migrateLegacySlot(root, slot);
  // Only the studio slot's files are imported as modules, but the root is
  // shared, so the declaration lands where every slot can see it.
  if (slot === 'studio') ensureModuleRoot(root);

  const d = path.join(root, slot);
  fs.mkdirSync(d, { recursive: true });
  // The workbench is the only slot with a runtime worth explaining; web and
  // mobile scripts are evaluated snippets and have their own screens.
  if (slot === 'studio') ensureGuide(d);
  return d;
}

function safePath(slot: Slot, p: string): string {
  const root = dir(slot);
  const cleaned = p.replace(/\\/g, '/').replace(/^\/+/, '');
  const full = path.normalize(path.join(root, cleaned));
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (full !== root && !full.startsWith(rootWithSep)) throw new Error('Invalid path');
  return full;
}

/** Line endings and a trailing newline are not an edit. Anything else is. */
const sameFile = (a: string, b: string) =>
  a.replace(/\r\n/g, '\n').trimEnd() === b.replace(/\r\n/g, '\n').trimEnd();

/**
 * Bring an untouched starter file up to date.
 *
 * Only the file this app wrote, only while it is still exactly as written. It
 * is never created here — a seed the person deleted stays deleted.
 */
function replaceUntouchedSeed(root: string, name: string, files: [string, string][]): void {
  const file = path.join(root, name);
  if (!fs.existsSync(file)) return;
  const current = fs.readFileSync(file, 'utf-8');
  if (!PAST_STUDIO_SEEDS.some((past) => sameFile(current, past))) return;

  /**
   * The starter is a **set**: the script and the file it imports. They are
   * upgraded together or not at all, because the new example calls
   * `clean(rows)` where the old helper took one row — replace the script alone
   * and the very line meant to teach the import is the line that throws.
   *
   * So a companion the person has edited stops the whole upgrade. A stale
   * example that runs beats a fresh one that cannot, and they still get the
   * guide.
   */
  for (const [to] of files) {
    if (to === name) continue;
    const target = path.join(root, to);
    if (!fs.existsSync(target)) continue;
    const held = fs.readFileSync(target, 'utf-8');
    if (!PAST_STUDIO_LIBS.some((past) => sameFile(held, past))) return;
  }

  for (const [to, source] of files) {
    const target = path.join(root, to);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, source, 'utf-8');
  }
}

function seedIfEmpty() {
  const seeds: [Slot, [string, string][]][] = [
    ['web', [['login.ts', SEED_WEB]]],
    ['mobile', [['verify-otp.ts', SEED_MOBILE]]],
    // The script first, then the file it imports — an example that throws on its
    // own first line teaches the opposite of what it is for.
    ['studio', [['example.ts', SEED_STUDIO], ['lib/rows.ts', SEED_STUDIO_LIB]]],
  ];
  for (const [slot, files] of seeds) {
    const root = dir(slot);
    // "Empty" means the person has nothing here — the guides `dir()` just laid
    // down are the app talking to itself, and counting them would make every slot
    // look occupied and no starter file would ever land.
    const guides: readonly string[] = GUIDE_FILES;
    const mine = fs.readdirSync(root).filter((name) => !guides.includes(name));
    if (mine.length > 0) {
      // Not empty, so nothing is seeded — but a workspace opened a week ago is
      // still holding the starter file of that week, and this one is now wrong
      // about how scripts run.
      if (slot === 'studio') replaceUntouchedSeed(root, 'example.ts', files);
      continue;
    }
    for (const [name, source] of files) {
      const file = path.join(root, name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, source, 'utf-8');
    }
  }
}

function walk(root: string, current: string, out: ScriptFile[]) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    // A run writes its module beside the script it came from, named with a
    // leading dot. It belongs to the run, not to the person's tree.
    if (entry.name.startsWith('.')) continue;
    const abs = path.join(current, entry.name);
    const rel = path.relative(root, abs).split(path.sep).join('/');
    if (entry.isDirectory()) {
      out.push({ path: rel, name: entry.name, type: 'folder' });
      walk(root, abs, out);
    } else if (entry.isFile() && LISTED_EXT.test(entry.name)) {
      out.push({ path: rel, name: entry.name, type: 'file' });
    }
  }
}

export const scriptsService = {
  get() {
    return scriptsService;
  },
  list(slot: Slot): ScriptFile[] {
    seedIfEmpty();
    const root = dir(slot);
    const out: ScriptFile[] = [];
    walk(root, root, out);
    return out.sort((a, b) => {
      // Folders first within the same parent, then alphabetical by path.
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.path.localeCompare(b.path);
    });
  },
  /**
   * Where a script lives, for a run that has to put its module beside it.
   *
   * One directory off and `./lib/login.ts` resolves somewhere else, so this is
   * the same path resolution every other operation uses — escapes included.
   * A buffer nobody has named yet belongs at the slot root: trying something out
   * before naming it is what the workbench is for.
   */
  locate(slot: Slot, p?: string): { dir: string; name: string } {
    const file = safePath(slot, p?.trim() ? p : 'untitled.ts');
    const folder = path.dirname(file);
    fs.mkdirSync(folder, { recursive: true });
    return { dir: folder, name: path.basename(file) };
  },
  read(slot: Slot, p: string): ScriptFileBody {
    const file = safePath(slot, p);
    if (!fs.existsSync(file)) return { path: p, source: '' };
    return { path: p, source: fs.readFileSync(file, 'utf-8') };
  },
  save(slot: Slot, body: ScriptFileBody): ScriptFile[] {
    const file = safePath(slot, body.path);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body.source, 'utf-8');
    return scriptsService.list(slot);
  },
  mkdir(slot: Slot, p: string): ScriptFile[] {
    const folder = safePath(slot, p);
    fs.mkdirSync(folder, { recursive: true });
    return scriptsService.list(slot);
  },
  remove(slot: Slot, p: string): ScriptFile[] {
    const target = safePath(slot, p);
    if (fs.existsSync(target)) {
      const stat = fs.statSync(target);
      if (stat.isDirectory()) {
        fs.rmSync(target, { recursive: true, force: true });
      } else {
        fs.unlinkSync(target);
      }
    }
    return scriptsService.list(slot);
  },
  /**
   * Atomic batch move of files and folders inside one workspace slot.
   *
   * Two-phase: dry-run validates every move (path-escape, self/descendant,
   * destination conflicts); only when the entire batch is valid do we apply
   * the renames. Identity moves (`from === to`) are silently skipped so the
   * UI can fire them without special-casing. Conflicts are surfaced both via
   * a recognizable error message and a `conflicts: string[]` field attached
   * to the thrown error so the renderer can list them.
   */
  move(slot: Slot, moves: ScriptMoveRequest[]): ScriptFile[] {
    // Phase 1 — resolve + classify every requested move.
    interface Resolved {
      from: string;
      to: string;
      fromAbs: string;
      toAbs: string;
    }
    const resolved: Resolved[] = [];
    for (const m of moves) {
      // safePath throws "Invalid path" on traversal — propagate as-is.
      const fromAbs = safePath(slot, m.from);
      const toAbs = safePath(slot, m.to);
      if (fromAbs === toAbs) continue; // identity no-op
      resolved.push({ from: m.from, to: m.to, fromAbs, toAbs });
    }

    // Phase 2 — self / descendant guard. Reject moving a folder into itself
    // or any of its own descendants (covers both the strict descendant case
    // and the "drop folder onto its own path with new child" case).
    for (const r of resolved) {
      if (fs.existsSync(r.fromAbs) && fs.statSync(r.fromAbs).isDirectory()) {
        const fromWithSep = r.fromAbs.endsWith(path.sep) ? r.fromAbs : r.fromAbs + path.sep;
        if (r.toAbs === r.fromAbs || r.toAbs.startsWith(fromWithSep)) {
          throw new Error(`Cannot move folder into itself or its descendants: ${r.from}`);
        }
      }
    }

    // Phase 3 — conflict dry-run. Collect every destination that already
    // exists so the UI can show the full list, not just the first.
    const conflicts: string[] = [];
    for (const r of resolved) {
      if (fs.existsSync(r.toAbs)) conflicts.push(r.to);
    }
    if (conflicts.length > 0) {
      const err = new Error(`Move conflict: ${conflicts.join(', ')} already exists`) as Error & {
        conflicts: string[];
      };
      err.conflicts = conflicts;
      throw err;
    }

    // Phase 4 — apply. Renames are same-fs and atomic; we make parents
    // first so deep destinations like "a/b/c.ts" work without prior mkdir.
    for (const r of resolved) {
      fs.mkdirSync(path.dirname(r.toAbs), { recursive: true });
      fs.renameSync(r.fromAbs, r.toAbs);
    }

    return scriptsService.list(slot);
  },
};
