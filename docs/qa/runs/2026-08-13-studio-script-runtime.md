# 게이트 기록 — 2026-08-13 · studio-script-runtime

작업대의 스크립트를 **문자열 평가에서 진짜 모듈로** 옮긴다. 유저 요청에서 시작했다:
"레거시의 스크립트는 TypeScript 와 라이브러리 문법을 쓸 수 있게 정말 스크립트로 돌아가게
해놨는데 이건 뭐하는 거냐."

| 슬롯 | 값 |
|---|---|
| 스펙 | `docs/spec/studio/browser.md`, `docs/spec/studio/README.md` |
| 테스트 정의 | `docs/qa/scenarios/studio.md` (신규, CASE-studio-001..086) |
| 인수조건 | `AC-studio.browser-15..18` 갱신, `-19..25` 신규 · `AC-studio.sidecar-01` 갱신 |

## 무엇이 사실이었나

지적은 절반만 맞았고, 그 절반이 더 나빴다. 웹·모바일·작업대의 실행기는 **같은 코드**였다 —
셋 다 `new Function(source)` 다. 실측:

| 쓰려던 것 | 레거시 `웹 > 스크립트` | 작업대 |
|---|---|---|
| `await page.goto(…)` | 돈다 | 돈다 |
| `function extract(page: Page): Promise<Row[]>` | `SyntaxError: Unexpected token ':'` | 같음 |
| `import { login } from './lib/login.ts'` | `SyntaxError: Cannot use import statement outside a module` | 같음 |
| `await import('./lib/login.ts')` | 기준 경로가 앱의 CWD — 못 쓴다 | 같음 |

즉 레거시가 더 낫지 않았다. 다만 작업대만 **못 지킬 약속**을 적어 두고 있었다: 시드와
`browser.md` 가 "재사용은 평범한 ES 모듈 import" 라고 말하는데 실행기가 `import` 를 거절했다.
모듈처럼 생긴 껍데기(`export extract/transform` + 정규식으로 `export` 떼기)가 그 위에 얹혀
있었고, 그것이 "스크립트인 척하는데 스크립트가 아니다" 로 읽힌 것이다.

## 실행 자리는 실측이 정했다

유저가 사이드카 실행을 골랐다. 그 선택의 크기는 처음 말한 것보다 컸고, 이유는 이 실측이다:

```
A: contexts = 1 pages = 1     ← 탭을 만든 클라이언트
B: contexts = 0               ← 같은 wsEndpoint 에 붙은 두 번째 클라이언트
```

Playwright `connect()` 는 클라이언트마다 컨텍스트가 격리된다. "메인이 탭을 쥐고 스크립트만
사이드카에서" 가 불가능하다는 뜻이고, 그래서 **브라우저 소유권이 사이드카로 넘어갔다.**
Electron 메인에서 Playwright 가 빠졌다.

## 무엇이 움직였나

| | 전 | 후 |
|---|---|---|
| 실행 | `new Function(source)` (Electron) | 파일을 `import()` (사이드카, 진짜 Node) |
| TypeScript | 문법 오류 | 런타임이 타입만 벗긴다 |
| import | 문법 오류 | 상대·패키지 둘 다 스크립트 위치 기준 |
| 브라우저 | 메인의 `firefox.connect` | 사이드카가 쥔다 |
| stdout | `WS ws://…` 한 줄 | 한 줄에 JSON 프레임 하나 (`ready`·`reply`·`log`) |
| stdin | 안 씀 | 요청 한 줄 |
| 세션 | 주입된 브라우저 위의 상태 기계 | 주입된 `StudioRpc` 위의 상태 기계 |
| 슬롯 뿌리 | 스크립트 파일뿐 | `package.json` + `hermetra-env.d.ts` (모듈 뿌리) |
| 시드 | export 하는 JS 한 장 | TypeScript 두 장 — `example.ts` 와 그것이 import 하는 `lib/rows.ts` |
| 번들 Node | `v22.14.0` | `v24.19.0` (타입 스트리핑이 기본인 런타임이어야 한다) |
| 실행 채널 입력 | `{ source, url }` | `{ source, path, url }` |

## 걸린 것 셋

**1. 파라미터 프로퍼티.** `constructor(private context: HostContext)` 는 지울 수 있는 문법이
아니라 스트리핑 전용 런타임이 거절한다 — 첫 실제 기동에서 `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`
로 죽었다. 단위 테스트는 esbuild 가 온전히 컴파일해서 못 잡았다. 그래서 고치는 김에
`erasableSyntaxOnly: true` 를 켰고(`tsconfig.node.json`), 같은 문법을 쓰던
`bridge/orchestrator.ts` 도 따라 바뀌었다. 이제 타입체크가 이 실수를 미리 잡는다.

**2. CommonJS shim 이 시드를 잘랐다.** 시드에 진짜 `import` 를 넣자 electron-vite 의 shim 이
그것을 마지막 import 로 읽고 `__dirname` 선언을 **템플릿 문자열 한복판에** 넣었다. 2026-08-11
에 밟았던 그 함정이고, 그때는 "시드에 import 를 쓰지 말 것" 으로 피했다. 이번에는 원인을
없앴다 — main 의 맨 `__dirname` 을 전부 `import.meta.dirname` 으로 바꾸니 **shim 자체가 주입되지
않는다.** 빌드 산출물에서 확인: `CommonJS Shims` 문자열 없음, 시드 온전함.

**3. 편집기가 자기 시드를 빨갛게 칠했다.** Monaco 는 `.ts` 확장자 import 를 거절하고 주입
전역을 모른다. 컴파일러 옵션과 앰비언트 선언을 넣어 맞췄다(`@shared/studio/ambient.ts` 하나를
메인과 렌더러가 같이 읽는다 — 두 벌이면 갈라지고, 갈라짐의 증상이 바로 이것이다).

## 이미 열어 본 워크스페이스 (2회차)

첫 회차를 유저가 자기 워크스페이스에서 열어 보고 잡았다: **화면에 옛 시드가 그대로 있었다.**
시드는 빈 슬롯에만 깔리므로, 한 번이라도 연 워크스페이스는 그날 실린 파일을 계속 쥔다 — 그리고
그 파일은 이제 없는 런타임을 가르친다(`new Function` 시절의 JS, 못 도는 import 안내).

**앱이 쓴 그대로인 파일만** 새 시드로 바꾼다. 판정은 지금까지 실제로 디스크에 쓴 바이트와의
일치다(`PAST_STUDIO_SEEDS` — 템플릿이 아니라 기록이므로 새 시드에 맞춰 고치지 않는다). 줄바꿈과
끝 공백만 눈감고, 한 줄이라도 다르면 사람의 파일이라 건드리지 않는다. 지운 시드는 되살리지
않고, 이미 있는 `lib/rows.ts` 도 덮지 않는다.

유저의 실제 파일(`~/Library/Application Support/hermetra/workspaces/…/scripts/studio/example.ts`)
로 대조 확인 — 기록된 시드와 일치하므로 다음 실행에서 바뀐다. 파일은 읽기만 했다.

## 스크립트답게 (3회차)

2회차까지도 유저가 보는 화면은 여전히 프레임워크였다. 지적은 정확했다 — "타입스크립트 코딩하는
것처럼 그대로 스크립트로 하고 싶다", 그리고 Playwright 문서의 코드를 들이밀었다:

```ts
const page = await context.newPage();
await page.goto('http://example.com');
await page.locator('#search').fill('query');
console.log(page.url());
```

**런타임은 1회차에 옳아졌는데 얼굴이 안 바뀌었다.** 그 상태에서 이 코드를 붙이면 두 군데서
깨졌고, 둘 다 실측으로 확인했다:

```
panel lines: []                                    ← console.log 이 아무 데도 안 나온다
context available: false  ReferenceError: context is not defined
```

- **`console.log` 이 사라졌다.** 사이드카에서 stdout 은 프로토콜 그 자체라, 스크립트가 거기
  찍은 줄은 메시지가 아니라 깨진 프레임이고 잡음으로 버려진다. 특별한 `log()` 를 가르치는 대신
  평범한 쪽이 동작하게 만들었다 — 실행 동안 `console` 을 패널로 돌리고 끝나면 되돌린다.
  `warn`·`error` 는 에러 줄이다.
- **`context`·`browser` 가 없었다.** `context.newPage()` 는 배우지 않고도 손이 가는 것이라,
  없으면 문서를 그대로 옮긴 코드가 죽는다. 둘 다 스코프에 넣었다.
- **시드가 `export extract/transform` 로 열렸다.** 그래서 화면이 "빈칸을 채우는 프레임워크"로
  읽혔다. 시드는 이제 위에서 아래로 도는 스크립트이고, 단계 계약은 주석 세 줄로 남는다.
  옛 시드 목록에 어제자 시드도 추가해, 그것을 받은 워크스페이스도 따라온다.
- **편집기가 최상위 `await` 를 빨갛게 칠했다.** Monaco 가 import/export 없는 파일을 모듈이
  아니라 스크립트로 본다. `moduleDetection: Force` 로 런타임과 맞췄다 — Node 쪽은
  `scripts/package.json` 의 `type: module` 이 이미 그렇게 정하고 있다.

확인(실제 앱 + 실제 Camoufox): 위 문서 코드를 편집기에 그대로 넣고 실행 →

```
heading: Example Domain
url: http://example.com/
```

빨간 줄 0, 콘솔 에러 0, 새로 연 탭이 탭 목록에 붙었다.

## 게이트

| 항목 | 결과 |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run test` | PASS — 48 파일 656 케이스 |
| `npm run build` | PASS |
| `npm run test:e2e` | PASS — 20 |
| `npm run sweep` | PASS 5/5 (tokens · imports · i18n · ledger · coverage) |
| `surface-verify` | 차단 0 · 관찰 18 (hit-target, 전부 기준선의 공용 `Input`) |

## 손으로 확인한 것 (e2e 가 못 덮는 자리)

**사이드카 직접 구동** — 빌드된 `out/main/host/launcher.ts` 를 진짜 Node 로 띄우고 JSON 라인을
주고받았다. 실제 Camoufox 기동, `pages`, 그리고 임시 워크스페이스의 스크립트 실행:

```
[log] title: Example Domain
[log] → (1 rows) [{"title":"Example Domain","slug":"example-domain"}]
{"ok":true,"error":"","durationMs":330}
```

그 스크립트가 쓴 것: 타입 주석 · `interface` · `extends` · `import { clean, type Row } from
'./lib/rows.ts'` · `import { slug } from 'slugify-lite'`(워크스페이스 `scripts/node_modules`).
실행 뒤 슬롯에 남은 것은 `lib` 뿐 — 임시 모듈은 지워졌다. 던지는 스크립트도 확인:

```
Error: on purpose
    at extract (…/scripts/studio/example.ts:1:35)
```

한 줄이다. 실행기 자신의 프레임은 잘려 나가고, 이름은 임시 모듈이 아니라 `example.ts` 다.
그 뒤 `pages` 가 정상 응답 — 세션이 살아 있다.

**앱 구동** (`HERMETRA_DRIVERS=real`) — 작업대 열기 → 브라우저 켜기 → 편집기에 TypeScript
스크립트 입력 → 실행. 출력 패널:

```
title: Example Domain
→ (1 rows) [{"title":"Example Domain","at":"https://example.com/"}]
```

렌더러 콘솔 에러 0. 새 워크스페이스가 여는 시드 화면도 확인 — `import` 를 포함한 시드가
빨간 줄 없이 뜬다.

## 남긴 것

- mock 모드의 실행은 Electron 런타임이라 `.ts` 를 못 벗긴다. 화면용 모드이고, 실행기는 진짜
  Node 로 도는 단위·API 가 덮는다 (`browser.md` 알려진 한계).
- 편집기는 워크스페이스의 다른 파일을 못 읽어 import 해석 진단(2307)을 끈 채다. 슬롯 파일을
  extraLib 로 넣어 주면 풀린다.
- 레거시 `웹 > 스크립트` · `모바일 > 스크립트` 는 아직 `new Function` 이다. 같은 대접을 받을
  자리이지만 이번 범위가 아니다.
- 사이드카 케이스 번호는 아직 `CASE-pipeline-06x`·`08x` 에 있다 (`scenarios/studio.md` 머리말).
