# `studio.browser` — 브라우저 작업대

라우트 `/studio/browser` · 컨테이너 `page-studio-browser` · 사이드바 `nav-studio-browser`

## 왜 파이프라인 밖인가

파이프라인의 여섯 화면 중 다섯은 **재료 창고**다 — 소스 하나, 추출 규칙 하나, 변환 하나, 저장
대상 하나. 그런데 그것들을 실제로 만드는 일은 **브라우저를 열고 · 로그인하고 · 목록을 긁고 ·
숫자를 정리하는** 한 줄기이고, 그 한 줄기는 네 단계에 동시에 걸친다. 네 화면으로 쪼개 놓으면
하나를 만들려고 화면 넷을 오가게 된다.

그래서 만드는 일은 한자리에 있다. **이 화면의 어떤 것도 단계가 아니다.** 단계를 만드는 자리다.

이 화면은 2026-08-12 까지 `/pipeline/jobs` 에 살았다. 자리가 없어서였다 — 당시 스펙은 "브라우저는
파이프라인의 일곱 번째 단계가 아니고, 레일에는 자리도 없다"고 적으면서도 파이프라인 서랍 안에
두었다. 그 타협이 레일로 하여금 **작업대를 단계 중 하나라고 말하게** 만들었고, `작업` 이라는
이름은 정작 파이프라인에 필요한 실행 이력을 약속해 놓고 작업대에게 내주고 있었다.

지금은 갈라져 있다. 작업대는 스튜디오 서랍에서 "이걸 어떻게 만들까"에 답하고, `작업`
(`pipeline.jobs`) 은 파이프라인 안에 남아 "무엇이 언제 돌았나"를 약속한다.
`AC-app.shell.sidebar-06` 의 여섯 순서는 그대로다 — 나간 것은 작업대이지 `작업` 이 아니다.

## Section 셋

| Section | 무엇 |
|---|---|
| 브라우저 바 (`studio-browser-bar`) | 사이드카·세션 상태, 켜기/끄기, 창 보임 여부, 주소창, 탭 목록 |
| 스크립트 (`CodeEditor`, `accent="pipeline"`) | `pipeline` 슬롯의 파일 트리 + 편집기 + 실행 |
| 로그 | 실행 중인 스텝의 출력이 **줄 단위로 흐른다** |

## `studio.session` — 사이드카가 띄운 브라우저를 잡는다

사이드카는 주소(`WS ws://…`)를 뱉고 거기서 멈춘다 (`README.md` `pipeline.sidecar`). 그 주소에
붙어서 브라우저를 쥐고 있는 것이 세션이다.

```
SidecarSupervisor ──status: ready + endpoint──> PipelineSession.attach()
                  ──status: 그 외 ───────────> PipelineSession.detach()
```

배선은 `ipc/register.ts` 가 한다. 화면이 순서를 잡지 않는다 — 화면은 사이드카에게 켜라고만
하고, 붙는 것은 감독자의 보고를 따라 저절로 일어난다.

**세션은 실행보다 오래 산다.** 실행이 자기 브라우저를 열고 닫으면 스텝 사이에 로그인·쿠키·보고
있던 페이지가 전부 날아간다. 그것을 없애려고 있는 화면이다.

`services/pipelineSession.ts` 는 순수하다(브라우저를 주입받는다). 실제 접속은
`pipelineSession.connect.ts` 하나로 격리된다 — `playwright` 의 **firefox** 클라이언트다
(Camoufox 는 패치된 Firefox 이고, Chromium 클라이언트는 말이 통하지 않는다). Playwright
클라이언트는 순수 JS 라 Electron 에서 돈다; 못 도는 `better-sqlite3` 는 사이드카 자식에 갇혀
있고 여기서 임포트하지 않는다.

### 인수조건

- `AC-studio.browser-01` 화면을 열어도 브라우저는 **저절로 켜지지 않는다**
  (`AC-pipeline.sidecar-08` 의 화면 쪽 짝).
- `AC-studio.browser-02` 기본은 **창 보임**이다. 이 화면은 브라우저가 일하는 것을 보려고 있다.
  창 없이 돌리려는 사람은 그렇다고 말해야 한다.
- `AC-studio.browser-03` 창 보임 여부는 **켜져 있는 동안 못 바꾼다.** 돌고 있는 브라우저가 하지
  않는 것을 화면이 말하게 두지 않는다.
- `AC-studio.browser-04` 붙어 있지 않으면 주소창·탭 조작이 죽어 있다. 누를 수 있는데 아무 일도
  안 일어나는 컨트롤을 두지 않는다.
- `AC-studio.browser-05` 스텝의 출력은 **줄이 나오는 대로** 온다(`EVT_STUDIO_LOG`). 끝나고
  한 덩어리로 오면 30초짜리 스텝은 30초 동안 빈 화면이다.
- `AC-studio.browser-06` 한 실행의 모든 줄은 같은 `runId` 를 단다. 두 실행이 한 이야기로 섞이지
  않는다.
- `AC-studio.browser-07` 스텝이 던져도 **세션은 살아 있다.** 실패는 그 실행의 사실이지 브라우저에
  대한 사실이 아니다.
- `AC-studio.browser-08` 브라우저가 죽으면 **왜 죽었는지**가 화면에 남는다. 꺼졌다는 사실만으로는
  고칠 수가 없다.
- `AC-studio.browser-09` 첫 실행은 브라우저를 받느라 오래 걸린다는 것을 `starting` 동안 말한다.
  아무 말 없이 멈춰 있으면 고장으로 읽힌다.
- `AC-studio.browser-10` 사이드카가 재시작하면 주소가 바뀌고 탭이 전부 없어진다. 세션은 **새
  주소로 다시 붙고** 옛 탭 목록을 남기지 않는다.
- `AC-studio.browser-11` 접속 도중 세션이 떨어지면, 늦게 도착한 브라우저는 **채택하지 않고
  닫는다.** 아무도 안 쥔 살아 있는 브라우저가 남으면 안 된다.
- `AC-studio.browser-12` 로그는 마지막 500줄만 쥔다. 도는 스크립트가 렌더러 메모리를 먹게 두지
  않는다.

구현: `tests/unit/pipeline-session.test.ts`, `tests/api/pipeline-session.test.ts`,
`src/renderer/modules/pipeline/pages/JobsPage.test.tsx`.

## 스크립트 — 슬롯 하나, 역할은 export 이름으로

`web` · `mobile` 옆에 `pipeline` 슬롯이 선다
(`<워크스페이스>/scripts/pipeline/`). 단계별로 폴더를 쪼개지 **않는다** — 쪼개면 로그인 함수를
양쪽에 복사하게 된다.

파일은 한 곳이고, 어느 단계의 것인지는 **무엇을 export 하는가**가 말한다.

| export | 쓰는 단계 |
|---|---|
| `extract(page, ctx)` | 수집 |
| `transform(raw)` | 처리 |
| (아무것도 안 함 — `lib/` 아래 부품) | 어느 목록에도 안 뜬다 |

재사용은 평범한 ES 모듈 import 다. 새 개념을 만들지 않는다.

> 시드 문자열 안에 `import … from '…'` 문장을 **쓰지 않는다.** electron-vite 의 CommonJS shim 이
> 그것을 진짜 import 로 읽고 `__dirname` 선언을 그 뒤 — 즉 템플릿 문자열 안 — 에 넣는다. 그러면
> 메인 프로세스가 창도 못 띄우고 죽는다. 2026-08-11 에 한 번 밟았다.

- `AC-studio.browser-13` `pipeline` 슬롯의 파일은 `web`·`mobile` 목록에 뜨지 않는다.
- `AC-studio.browser-14` 시드는 **함수**를 export 한다. 최상위 문장만 있는 파일은 단계가 가리킬
  것이 없다.

구현: `tests/api/scripts.test.ts`.

### 실행은 두 모양을 다 받는다

작업대에서 도는 것은 두 종류이고 모양이 다르다.

| 모양 | 예 | 어떻게 도는가 |
|---|---|---|
| 스니펫 | `await page.goto(…)` | 본문 그대로 |
| 단계 스크립트 | `export async function extract(page, ctx)` | `export` 를 떼고 본문을 돌린 뒤, 선언된 것을 **부른다** |

모듈을 문장 본문으로 감싸면 한 줄도 돌기 전에 `Unexpected token 'export'` 가 난다. 그래서
**모든 워크스페이스가 열자마자 보는 시드가, 유일하게 못 돌리는 스크립트였다**(2026-08-11).

- `extract` 를 export 하면 본문 뒤에 `extract(page, ctx)` 로 불린다. `ctx.url` 은 주소창 값이다.
- `transform` 은 `extract` 뒤에서만 붙는다. 혼자 있으면 입력이 없고, `undefined` 로 부르면
  멀쩡한 스크립트를 저자가 쓰지도 않은 크래시로 만든다.
- 돌려준 값은 패널에 찍힌다 — 확인하려던 게 그거니까. 배열이면 개수도 같이 적고, 2000자에서
  자른다.

- `AC-studio.browser-15` `export` 를 쓰는 스크립트가 돈다. `extract` 는 `(page, ctx)` 로 불리고
  `transform` 은 그 결과에 이어 붙는다.
- `AC-studio.browser-16` export 가 없는 평범한 스니펫은 그대로 본문으로 돈다.
- `AC-studio.browser-17` **앱이 싣는 시드가 실제로 돈다.** 실행기와 시드가 다른 파일에 있어서,
  둘을 가로지르는 테스트만 이 어긋남을 잡는다 (`tests/api/pipeline-session.test.ts`).
- `AC-studio.browser-18` mock 브라우저는 그 시드를 돌릴 만큼은 된다. 앱이 싣는 스크립트를 못
  돌리는 mock 은 이 화면을 검증하지 못하는 mock 이다.

## 알려진 한계

- 단계가 스크립트를 **참조**하는 자리(수집·처리 화면)는 아직 없다. 지금은 작업대에서 스텝을
  직접 돌린다. 창고 화면이 생기면 그 연결이 붙는다.
- 실행 플로우(소스+수집+처리+저장소를 엮어 예약 실행)는 아직 없다. 이 화면의 이름이 "작업"인
  것은 그 자리를 비워 둔 것이다.
- 주소창 입력칸의 히트 영역이 288x20 으로 24px 기준 아래다. 공용 `Input` 컴포넌트가 모든
  화면에서 갖는 성질이고 기준선에 이미 있다 — 이 화면이 새로 낸 것이 아니다.
