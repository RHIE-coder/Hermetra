/**
 * Every workbench guide this app has written.
 *
 * The guide is documentation the app ships, so a copy still byte-for-byte one of
 * ours is ours to replace when a newer one exists; one changed line makes it the
 * person's and we leave it alone. Same rule as `PAST_STUDIO_SEEDS`, and the same
 * warning: **this is a record of what was written to disk, not a template.** Do
 * not edit these strings to match a new guide — add the retired one instead.
 *
 * It lives in its own file because a guide is a hundred lines and the service is
 * not a place to keep two of them per language.
 */
export const PAST_GUIDES: Record<'ko' | 'en', readonly string[]> = {
  // 2026-08-18, the first version, replaced the same day: it still carried the
  // `export extract` / `export transform` section, and that convention left the
  // runner hours later. A guide describing a feature the app does not have is
  // worse than no guide — the person reads it, writes it, and nothing happens.
  ko: [
    `# 브라우저 작업대 — 무엇을 찾아보고, 무엇이 이 앱 고유인가

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

## \`export extract\` / \`export transform\` — 쓰기 전에 읽으세요

**이건 어떤 라이브러리의 문법이 아닙니다. 이 앱이 만든 약속이고, 지금은 이것을 쓰는 데가
거의 없습니다.**

지금 하는 일: 파일이 \`extract\` 라는 이름의 함수를 export 하면, \`실행\` 은 파일을 그냥
불러오는 대신 \`extract(page, ctx)\` 를 부릅니다. \`transform\` 도 export 돼 있으면 \`extract\`
가 돌려준 값을 넣어 부릅니다. 마지막 값은 줄 수와 함께 출력 패널에 찍힙니다.

하지 않는 일: 이런 식으로 스크립트를 고르기로 돼 있던 수집·처리 화면이 **아직 없습니다** —
빈 껍데기이고, 그 스펙에도 데이터 모양이 아직 안 정해졌다고 적혀 있습니다. 그래서 저 이름
둘은 평범한 스크립트가 이미 주는 것 이상을 주지 않고, 글자 그대로 맞춰 보므로 \`extrct\` 처럼
오타가 나면 아무 말 없이 아무 일도 일어나지 않습니다.

**평범한 스크립트를 쓰세요.** 이 절은 물려받은 파일이 \`export async function extract\` 로
시작할 때 그게 무엇인지 알아볼 수 있으라고 있습니다.
`,
  ],
  en: [
    `# Browser workbench — what to read, and what is this app's own

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

## \`export extract\` / \`export transform\` — read this before you use it

**This is not a library's syntax. It is a convention this app made up, and right
now almost nothing uses it.**

What it does today: if your file exports a function named \`extract\`, Run calls
\`extract(page, ctx)\` instead of merely importing the file. If \`transform\` is also
exported, it is called with whatever \`extract\` returned. The final value is
printed to the output panel with a row count.

What it does not do: the Ingestion and Processing screens that were supposed to
pick a script this way **are not built** — they are empty placeholders, and their
own spec says the data shape is not decided yet. So the two names buy you nothing
a plain script does not already give you, and they are matched literally: a typo
like \`extrct\` fails silently.

**Write a plain script.** This section is here so that a file you inherit which
opens with \`export async function extract\` is not a mystery.
`,
  ],
};
