# TestScenario: 스튜디오 (`studio`)

브라우저를 띄워 두고 스크립트를 다듬어 단계를 **만드는** 길. 덮는 정본:
`docs/spec/studio/*`.

> 사이드카의 감독자·어댑터 케이스(`CASE-pipeline-06x`·`08x`)는 아직
> `pipeline.md` 에 있다. 작업대가 `pipeline` 에서 갈라져 나오기 전에 붙인 번호이고, 번호는
> 재사용하지 않는 것이 이 문서의 규칙이라 옮기지 않았다 — 그 Suite 를 다음에 손댈 때 함께
> 옮긴다. 여기 있는 것은 2026-08-13 에 생긴 것들이다.

## TestSuite: `studio.sidecar` 프로토콜 — 한 줄에 JSON 하나

사이드카가 브라우저를 쥐게 되면서 stdout 이 주소 한 줄로는 부족해졌다. 이 Suite 는 그 줄들이
섞이지 않는다는 것만 본다.

구현: `tests/unit/sidecar-protocol.test.ts` (20) · `tests/unit/sidecar-supervisor.test.ts` (3) ·
`tests/api/sidecar.test.ts` (2)

| Case | 무엇 | 덮는 노드 | 계층 | 구현 |
|---|---|---|---|---|
| CASE-studio-001 | 프레임 하나가 한 줄로 인코딩된다 | `studio.sidecar` | 단위 | `sidecar-protocol.test.ts` |
| CASE-studio-002 | 줄 안에 날 개행이 들어가지 않는다 | `studio.sidecar` | 단위 | `sidecar-protocol.test.ts` |
| CASE-studio-003 | 두 청크에 걸친 프레임을 온전해질 때까지 붙든다 | `studio.sidecar` | 단위 | `sidecar-protocol.test.ts` |
| CASE-studio-004 | 한 청크의 두 프레임을 나눈다 | `studio.sidecar` | 단위 | `sidecar-protocol.test.ts` |
| CASE-studio-005 | JSON 이 아닌 줄·모르는 태그를 버린다 | `studio.sidecar` | 단위 | `sidecar-protocol.test.ts` |
| CASE-studio-006 | 아무도 구현 안 한 op 요청을 버린다 | `studio.sidecar` | 단위 | `sidecar-protocol.test.ts` |
| CASE-studio-007 | 감독자는 `ready` 프레임으로 주소를 읽는다 | `studio.sidecar` | 단위 | `sidecar-supervisor.test.ts` |
| CASE-studio-008 | 감독자가 요청을 한 줄로 자식에게 쓴다 | `studio.sidecar` | 단위 | `sidecar-supervisor.test.ts` |
| CASE-studio-009 | 자식이 없으면 보내지 않고 false 를 답한다 | `studio.sidecar` | 단위 | `sidecar-supervisor.test.ts` |
| CASE-studio-010 | reply·log 는 넘기고 ready 만 자기가 쓴다 | `studio.sidecar` | 단위 | `sidecar-supervisor.test.ts` |
| CASE-studio-011 | 어댑터가 stdin 으로 요청을 흘린다 | `studio.sidecar` | API | `tests/api/sidecar.test.ts` |
| CASE-studio-012 | stdin 없는 자식에 써도 던지지 않는다 | `studio.sidecar` | API | `tests/api/sidecar.test.ts` |

## TestSuite: `studio.browser` 실행기 — 파일은 진짜 모듈이다

작업대의 핵심. 문자열 평가가 아니라 Node 가 파일을 import 한다는 것이 여기서 증명된다.

구현: `tests/unit/studio-runner.test.ts` (16) · `tests/unit/studio-host-serve.test.ts` (6)

| Case | 무엇 | 덮는 노드 | 계층 | 구현 |
|---|---|---|---|---|
| CASE-studio-020 | 스니펫이 그대로 돌고 `page`·`log` 가 닿는다 | `studio.browser` | 단위 | `studio-runner.test.ts` |
| CASE-studio-021 | `extract`·`transform` 이라는 이름은 **아무 힘이 없다** — 부르지 않고, 파일만 돈다 | `studio.browser` | 단위 | `studio-runner.test.ts` |
| CASE-studio-024 | `default` export 가 `(page, ctx)` 로 불린다 | `studio.browser` | 단위 | `studio-runner.test.ts` |
| CASE-studio-025 | **타입 주석이 있는 파일이 그대로 돈다** | `studio.browser` | 단위 | `studio-runner.test.ts` |
| CASE-studio-026 | **상대 import 가 스크립트 옆을 가리킨다** | `studio.browser` | 단위 | `studio-runner.test.ts` |
| CASE-studio-027 | 문법 오류가 그 실행의 실패로 보고된다 | `studio.browser` | 단위 | `studio-runner.test.ts` |
| CASE-studio-028 | 트레이스가 임시 모듈이 아니라 스크립트 이름을 단다 | `studio.browser` | 단위 | `studio-runner.test.ts` |
| CASE-studio-029 | 실행기 자신의 프레임은 트레이스에서 빠진다 | `studio.browser` | 단위 | `studio-runner.test.ts` |
| CASE-studio-030 | 성공해도 실패해도 임시 모듈을 지운다 | `studio.browser` | 단위 | `studio-runner.test.ts` |
| CASE-studio-031 | 붙은 브라우저가 없으면 실행 전에 보고한다 | `studio.browser` | 단위 | `studio-runner.test.ts` |
| CASE-studio-032 | 돌려준 값이 행 개수와 함께 찍히고 2000자에서 잘린다 | `studio.browser` | 단위 | `studio-runner.test.ts` |
| CASE-studio-033 | 로그가 판정보다 **먼저** 흐른다 | `studio.browser` | 단위 | `studio-host-serve.test.ts` |
| CASE-studio-034 | 도는 중에 온 두 번째 실행은 거절된다 | `studio.browser` | 단위 | `studio-host-serve.test.ts` |
| CASE-studio-035 | 던진 요청이 실패 응답이 되고 사이드카는 산다 | `studio.browser` | 단위 | `studio-host-serve.test.ts` |
| CASE-studio-036 | **Playwright 문서 코드가 그대로 돈다** (`context.newPage()` → `console.log`) | `studio.browser` | 단위 | `studio-runner.test.ts` |
| CASE-studio-037 | `console.log` 이 프로토콜이 아니라 패널로 간다 | `studio.browser` | 단위 | `studio-runner.test.ts` |
| CASE-studio-038 | `console.warn`·`console.error` 는 에러 줄로 뜬다 | `studio.browser` | 단위 | `studio-runner.test.ts` |
| CASE-studio-039 | 실행이 끝나면 `console` 이 원래대로 돌아온다 | `studio.browser` | 단위 | `studio-runner.test.ts` |
| CASE-studio-092 | `browser` 도 스크립트에 닿는다 | `studio.browser` | 단위 | `studio-runner.test.ts` |
| CASE-studio-093 | 시드는 계약이 아니라 스크립트다 | `studio.browser` | API | `tests/api/scripts.test.ts` |

## TestSuite: `studio.session` — 사이드카가 쥔 탭을 부린다

구현: `tests/unit/studio-browser-host.test.ts` (10) · `tests/unit/studio-session.test.ts` (15) ·
`tests/unit/studio-rpc.test.ts` (6) · `tests/api/studio-session.test.ts` (8)

| Case | 무엇 | 덮는 노드 | 계층 | 구현 |
|---|---|---|---|---|
| CASE-studio-040 | 탭을 번호로 세고 활성 탭을 표시한다 | `studio.session` | 단위 | `studio-browser-host.test.ts` |
| CASE-studio-041 | 탭이 없으면 하나 연다 | `studio.session` | 단위 | `studio-browser-host.test.ts` |
| CASE-studio-042 | 맨 호스트를 https 로 읽는다 | `studio.session` | 단위 | `studio-browser-host.test.ts` |
| CASE-studio-043 | 이동이 실패해도 탭은 남고 이유가 함께 온다 | `studio.session` | 단위 | `studio-browser-host.test.ts` |
| CASE-studio-044 | 새 탭이 활성이 되고, 주소가 있을 때만 이동한다 | `studio.session` | 단위 | `studio-browser-host.test.ts` |
| CASE-studio-045 | 탭을 닫아도 활성 인덱스가 목록 밖으로 안 나간다 | `studio.session` | 단위 | `studio-browser-host.test.ts` |
| CASE-studio-046 | 탭이 아닌 인덱스는 무시한다 | `studio.session` | 단위 | `studio-browser-host.test.ts` |
| CASE-studio-050 | 요청에 번호가 붙고 답하는 것이 그 요청을 푼다 | `studio.session` | 단위 | `studio-rpc.test.ts` |
| CASE-studio-051 | 보낼 곳이 없으면 즉시 실패한다 | `studio.session` | 단위 | `studio-rpc.test.ts` |
| CASE-studio-052 | **자식이 죽으면 기다리던 요청이 전부 풀린다** | `studio.session` | 단위 | `studio-rpc.test.ts` |
| CASE-studio-053 | 아무도 안 기다리는 응답을 무시한다 | `studio.session` | 단위 | `studio-rpc.test.ts` |
| CASE-studio-060 | 주소를 받으면 붙고 열린 탭을 읽어 온다 | `studio.session` | 단위 | `studio-session.test.ts` |
| CASE-studio-061 | 같은 주소로 다시 붙어도 탭을 버리지 않는다 | `studio.session` | 단위 | `studio-session.test.ts` |
| CASE-studio-062 | 다른 주소는 재시작으로 보고 새로 붙는다 | `studio.session` | 단위 | `studio-session.test.ts` |
| CASE-studio-063 | 거절된 접속이 화면 상태가 된다 | `studio.session` | 단위 | `studio-session.test.ts` |
| CASE-studio-064 | 놓은 뒤 늦게 온 답을 채택하지 않는다 | `studio.session` | 단위 | `studio-session.test.ts` |
| CASE-studio-065 | 안 붙어 있으면 사이드카에 아무것도 안 묻는다 | `studio.session` | 단위 | `studio-session.test.ts` |
| CASE-studio-066 | 실행 요청이 파일의 위치와 함께 나간다 | `studio.session` | 단위 | `studio-session.test.ts` |
| CASE-studio-067 | 한 실행의 로그와 판정이 같은 runId 를 단다 | `studio.session` | 단위 | `studio-session.test.ts` |
| CASE-studio-068 | 실행이 실패해도 세션은 attached 로 남는다 | `studio.session` | 단위 | `studio-session.test.ts` |
| CASE-studio-069 | 실행 뒤 탭 목록을 다시 읽는다 | `studio.session` | 단위 | `studio-session.test.ts` |
| CASE-studio-070 | mock 에서도 화면을 붙이고 탭을 몬다 | `studio.session` | API | `tests/api/studio-session.test.ts` |
| CASE-studio-071 | **앱이 싣는 시드가 실제로 돈다** (import 포함) | `studio.browser` | API | `tests/api/studio-session.test.ts` |

## TestSuite: `studio.browser` 슬롯 — 모듈 뿌리

구현: `tests/api/scripts.test.ts` (7)

| Case | 무엇 | 덮는 노드 | 계층 | 구현 |
|---|---|---|---|---|
| CASE-studio-080 | 슬롯 뿌리에 `package.json` 이 깔린다 | `studio.browser` | API | `tests/api/scripts.test.ts` |
| CASE-studio-081 | 주입 전역을 적은 `hermetra-env.d.ts` 가 깔린다 | `studio.browser` | API | `tests/api/scripts.test.ts` |
| CASE-studio-082 | 사람이 고친 `package.json` 을 덮지 않는다 | `studio.browser` | API | `tests/api/scripts.test.ts` |
| CASE-studio-083 | 점으로 시작하는 파일은 목록에 안 뜬다 | `studio.browser` | API | `tests/api/scripts.test.ts` |
| CASE-studio-084 | 스크립트의 디렉터리를 실행에 알려 준다 | `studio.browser` | API | `tests/api/scripts.test.ts` |
| CASE-studio-085 | 이름 없는 버퍼는 슬롯 뿌리에서 돈다 | `studio.browser` | API | `tests/api/scripts.test.ts` |
| CASE-studio-086 | 슬롯을 벗어나는 경로는 거절된다 | `studio.browser` | API | `tests/api/scripts.test.ts` |
| CASE-studio-087 | 손대지 않은 옛 시드가 새 시드로 바뀐다 (`pipeline` 시절 것·CRLF 포함) | `studio.browser` | API | `tests/api/scripts.test.ts` |
| CASE-studio-088 | 한 줄이라도 고친 시드는 그대로 둔다 | `studio.browser` | API | `tests/api/scripts.test.ts` |
| CASE-studio-089 | 지운 시드를 되살리지 않는다 | `studio.browser` | API | `tests/api/scripts.test.ts` |
| CASE-studio-090 | 이미 있는 `lib/rows.ts` 를 덮지 않는다 | `studio.browser` | API | `tests/api/scripts.test.ts` |
| CASE-studio-091 | 현재 시드를 목록마다 다시 쓰지 않는다 | `studio.browser` | API | `tests/api/scripts.test.ts` |
| CASE-studio-094 | 시드가 상대 경로 + 확장자로 자기 파일을 import 하고, 그 이름을 `lib/rows.ts` 가 실제로 export 한다 | `studio.browser` | API | `tests/api/scripts.test.ts` |
| CASE-studio-095 | 시드가 import 하는 `lib/rows.ts` 가 시드와 함께 깔린다 (import 만 없던 시드에서 올라올 때도) | `studio.browser` | API | `tests/api/scripts.test.ts` |
| CASE-studio-096 | 시드를 실제 실행기로 돌리면, 손 안 댄 것과 거친 것이 나란히 찍혀 import 해 온 함수가 한 일이 보인다 | `studio.browser` | API | `tests/api/scripts.test.ts` |
| CASE-studio-103 | 시드와 `lib/rows.ts` 가 **함께** 갱신된다(옛 짝을 쥔 워크스페이스) | `studio.browser` | API | `tests/api/scripts.test.ts` |
| CASE-studio-104 | 짝 중 하나라도 사람이 고쳤으면 **둘 다** 안 건드린다(가이드는 그래도 깔린다) | `studio.browser` | API | `tests/api/scripts.test.ts` |
| CASE-studio-097 | 목록이 `.md` 도 실어 가이드를 편집기에서 열 수 있다 | `studio.browser` | API | `tests/api/scripts.test.ts` |
| CASE-studio-098 | 가이드가 이미 쓰던 워크스페이스에도 깔린다(빈 슬롯이 아니어도) | `studio.browser` | API | `tests/api/scripts.test.ts` |
| CASE-studio-099 | 두 가이드 **각각**이 참고처(playwright.dev)·엔진(Firefox)·전역 6개·기본 내보내기를 답한다 | `studio.browser` | API | `tests/api/scripts.test.ts` |
| CASE-studio-100 | 고쳐 놓은 가이드는 덮지 않는다 — 옛 판에 한 줄 덧붙인 것도 사람 파일이다 | `studio.browser` | API | `tests/api/scripts.test.ts` |
| CASE-studio-101 | 가이드는 시드 판정에서 안 세어, 시작 스크립트가 그대로 깔린다 | `studio.browser` | API | `tests/api/scripts.test.ts` |
| CASE-studio-105 | 목록에 `GUIDE_ko.md` 와 `GUIDE_en.md` 가 **둘 다** 뜬다 | `studio.browser` | API | `tests/api/scripts.test.ts` |
| CASE-studio-106 | 한국어판은 한글로, 영어판은 한글 없이 쓰여 있다 | `studio.browser` | API | `tests/api/scripts.test.ts` |
| CASE-studio-107 | 두 가이드가 서로를 가리킨다(첫머리 한 줄) | `studio.browser` | API | `tests/api/scripts.test.ts` |
| CASE-studio-108 | 예전 단일 `GUIDE.md` 는 사람이 고친 것이라도 지우고 두 파일로 바꾼다 | `studio.browser` | API | `tests/api/scripts.test.ts` |
| CASE-studio-109 | 옛 시드를 쥔 워크스페이스의 `example.ts` 가 지금 있는 가이드 이름을 가리키게 갱신된다 | `studio.browser` | API | `tests/api/scripts.test.ts` |
| CASE-studio-122 | 앱이 쓴 옛 판 가이드는 새 판으로 바뀐다(두 언어 다) | `studio.browser` | API | `tests/api/scripts.test.ts` |
| CASE-studio-123 | 옛 판 기록에 **지금 판은 들어 있지 않다** — 들어 있으면 목록마다 덮어써 사람의 수정이 남지 못한다 | `studio.browser` | API | `tests/api/scripts.test.ts` |
| CASE-studio-124 | 이미 지금 판인 가이드는 다시 쓰지 않는다 | `studio.browser` | API | `tests/api/scripts.test.ts` |
| CASE-studio-102 | `실행` 은 스크립트 확장자와 이름 없는 버퍼에만 열린다(마크다운은 잠긴다) | `studio.browser` | UI | `CodeEditor.test.tsx` |

## TestSuite: 작업대의 자리 — 파일이 화면을 얼마나 쓰는가

2026-08-14 피드백 세 건("코드 영역이 좁다" · "`.md` 전용 뷰" · "탭이 눌리는 것처럼 안
보인다")이 만든 Suite. 편집기 껍데기는 공용이라 앞의 둘은 웹·모바일 스크립트 화면에도
같이 걸린다.

구현: `src/renderer/modules/shared/CodeEditor.test.tsx` (10) ·
`src/renderer/modules/studio/pages/BrowserPage.test.tsx` (5)

| Case | 무엇 | 덮는 노드 | 계층 | 구현 |
|---|---|---|---|---|
| CASE-studio-110 | `.md` 에만 원문/미리보기 토글이 뜬다 | `web.code.editor` | UI | `CodeEditor.test.tsx` |
| CASE-studio-111 | 미리보기가 제목과 **GFM 표**를 문서로 그린다 | `web.code.editor` | UI | `CodeEditor.test.tsx` |
| CASE-studio-112 | 울타리 친 코드가 칩이 아니라 **덩어리**로 그려진다 | `web.code.editor` | UI | `CodeEditor.test.tsx` |
| CASE-studio-113 | 한 번 더 누르면 원문으로 돌아온다 | `web.code.editor` | UI | `CodeEditor.test.tsx` |
| CASE-studio-114 | 미리보기의 링크가 렌더러를 옮기지 않고 앱 밖으로 나간다 | `web.code.editor` | UI | `CodeEditor.test.tsx` |
| CASE-studio-115 | 넓게 보기가 파일 트리와 그리드 위 패널을 접고, `Esc` 로 돌아온다 | `web.code.editor` | UI | `CodeEditor.test.tsx` |
| CASE-studio-116 | 넓게 봐도 **출력 패널은 남는다** | `web.code.editor` | UI | `CodeEditor.test.tsx` |
| CASE-studio-117 | 탭 줄이 고른 것이든 아니든 테두리를 두른다 | `studio.browser` | UI | `BrowserPage.test.tsx` |
| CASE-studio-118 | 브라우저 바를 접으면 주소창·탭이 사라지고 상태 줄은 남는다 | `studio.browser` | UI | `BrowserPage.test.tsx` |
| CASE-studio-119 | 접기가 **넓게 보기를 건너 살아남는다** (그 모드가 바를 통째로 내린다) | `studio.browser` | UI | `BrowserPage.test.tsx` |
| CASE-studio-120 | 접힌 채로도 브라우저가 죽은 이유가 보인다 | `studio.browser` | UI | `BrowserPage.test.tsx` |
| CASE-studio-121 | 편집기 열이 자기 내용보다 작아질 수 있다 (창을 좁혀도 좌우 스크롤 없음) | `web.code.editor` | UI | `CodeEditor.test.tsx` |

> `CASE-studio-121` 은 **선언을 못박지 픽셀을 못박지 않는다** — happy-dom 은 그리드 배치를
> 계산하지 않는다. 실제 폭(1400→1200→1080→1000→960)에서 잰 값은 회차 기록
> `runs/2026-08-17-workbench-narrow-width.md` 에 있다. 맨 `1fr` 한 글자면 결함이 돌아오고,
> 그 한 글자를 이 케이스가 지킨다.

## e2e 로 안 덮는 것

**실제 Camoufox 로 TypeScript 스크립트를 돌리는 것.** e2e 는 mock 드라이버 전용이고
(`plan.md`), 그 모드에서는 스크립트가 Electron 안에서 돌아 `.ts` 를 벗기지 못한다. 대신
손으로 확인하고 회차 기록에 남긴다 — `runs/2026-08-13-studio-script-runtime.md` 가 그
회차다(실제 브라우저 + `./lib/rows.ts` import + 워크스페이스 `node_modules` 패키지).
