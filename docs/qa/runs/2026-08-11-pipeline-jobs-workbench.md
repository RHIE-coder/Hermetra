# 2026-08-11 — 작업 화면 작업대 (`pipeline-jobs-workbench`)

사이드카가 띄운 Camoufox 를 **켜 둔 채로** 조작하고, 스크립트를 돌려 가며 결과를 실시간으로
보는 자리를 작업 화면에 만들었다. 정본: `docs/spec/pipeline/jobs.md`.

## 무엇이 붙었나

| 조각 | 어디 |
|---|---|
| 사이드카 headed 모드 | `SidecarStatus.headless`, `PIPELINE_SIDECAR_START { headless }`, `sidecarEnv()` |
| 세션(네비게이션 서비스) | `services/pipelineSession.ts` (순수) + `pipelineSession.connect.ts` (firefox.connect / mock) |
| IPC | `pipeline:session:*` 6개, `pipeline:scripts:*` 6개, `evt:pipeline:session`, `evt:pipeline:log` |
| 스크립트 슬롯 | `scripts.ts` 의 `pipeline` — export 이름이 단계를 정한다 |
| 화면 | `JobsPage` + `modules/pipeline/store.ts`, `CodeEditor` 에 `accent="pipeline"` / `beforeGrid` |

## 게이트

| 검사 | 결과 |
|---|---|
| `npm run typecheck` (tsc node+web) | PASS |
| `npm run lint` | PASS |
| `npm run test` | PASS — 42 파일 / 568 케이스 (신규 52) |
| `npm run build` | PASS |
| `npm run test:e2e` | PASS — 19/19 |
| `npm run sweep` | PASS 5/5 (tokens · imports · i18n · ledger · coverage) |
| `surface-verify --nav=nav-pipeline-jobs` | 차단 0 · 관찰 6 (캡처 6건 = 3 폼팩터 x 2 테마) |

관찰 6건은 전부 `hit-target|…|input:` — 288x20 으로 24px 기준 아래다. 공용 `Input` 이 모든
화면에서 갖는 성질이고 기준선에 이미 12건 있다. 이 화면이 새로 낸 것이 아니라, 이 화면이 그
컴포넌트를 쓰기 때문에 다시 보인 것이다. 고치려면 `Input` 자체를 손대야 하고 그건 모든 화면을
건드리는 별개 변경이다.

## 빌드를 한 번 깨뜨린 것 — 시드 문자열 안의 import 문

`scripts.ts` 의 `pipeline` 시드에 사용법 주석으로 `//   import { login } from './lib/auth';`
한 줄을 넣었더니, **메인 프로세스가 창도 못 띄우고 죽었다.**

```
ReferenceError: __dirname is not defined
    at registerIpc (out/main/index.js:2968)
```

electron-vite 의 CommonJS shim 은 산출 청크에서 import 문을 찾아 그 뒤에 `const __dirname =
import.meta.dirname` 을 넣는다. 주석이든 템플릿 문자열 안이든 상관하지 않는다. 그래서 선언이
시드 **문자열 안으로** 들어갔고 진짜 `__dirname` 은 영영 선언되지 않았다.

증상이 e2e 의 `firstWindow: Timeout 30000ms` 하나뿐이라 원인이 안 보였다. 빌드된 앱을 손으로
띄워 stderr 를 읽고 나서야 나왔다. 유닛·API 테스트는 전부 초록이었다 — 번들러가 낸 고장이라
번들을 도는 검사만 볼 수 있었다.

시드 문안을 바꿔 해결했고, 같은 것을 다시 밟지 않도록 `scripts.ts` 와 `jobs.md` 양쪽에 이유를
적었다.

## 회차 2 — Camoufox 를 앱에 싣는다

"첫 실행에 받는다" 로 두었던 계획이 **실측에서 없는 경로로 드러났다.** 사용자 캐시를 치우고
패키징된 사이드카를 돌리면 받아 주지 않고 그냥 던진다:

```
[sidecar] failed: FileNotFoundError: Version information not found at
          ~/Library/Caches/camoufox/version.json. Please run `camoufox fetch` to install.
```

설치한 사람이 "브라우저 켜기" 를 누르면 그대로 실패한다는 뜻이다. 그래서 실었다.

| 조각 | 어디 |
|---|---|
| 스테이징 | `scripts/bundle-camoufox.mjs` — `camoufox-js fetch` 를 `CAMOUFOX_INSTALL_DIR` 돌려서 부른다 |
| 패키징 | `electron-builder.yml` `extraResources: resources/camoufox → camoufox`, `prepack` 에 `bundle:camoufox` |
| 런타임 해석 | `resolveCamoufoxDir()` — 명시 override → 번들 → null. `version.json` 이 있어야 인정한다 |
| 자식에게 전달 | `sidecarEnv()` 가 찾았을 때만 `CAMOUFOX_INSTALL_DIR` 를 건다 |

### 검증 (2026-08-11, darwin-arm64)

사용자 캐시(`~/Library/Caches/camoufox`)를 **치워 둔 상태**로:

| 조건 | 결과 |
|---|---|
| `CAMOUFOX_INSTALL_DIR` 없음 | FAIL — 위 `FileNotFoundError`. 자동 내려받기는 일어나지 않는다 |
| 번들을 가리킴 | **PASS** — 패키징된 node 가 패키징된 launcher 를 돌려 기동, `WS ws://…` 출력, SIGTERM 정상 종료 |

앱 크기 463MB → **1.2GB**. Camoufox 만 717MB 이고 그중 폰트가 362MB 인데, 폰트는 지문의
일부라 덜어내면 이 브라우저를 쓸 이유가 없어진다.

게이트 재실행: typecheck · lint · test(575) · build PASS, sweep 5/5 PASS.

## 회차 3 — 시드가 안 돌던 것 (사용자 보고)

작업 화면에서 시드를 실행하면 출력이 `! Unexpected token 'export'` 하나뿐이었다.

내가 만든 모순이다. 시드를 **모듈**로 정해 놓고(단계가 함수를 참조해야 하니까), 실행기는
소스를 **문장 본문**으로 감쌌다. 둘이 양립하지 않는다 — 그래서 모든 워크스페이스가 열자마자
보는 스크립트가 유일하게 못 돌리는 스크립트였다.

`prepareStep()` 이 `export` 를 떼고 선언된 이름을 기억한다. 본문이 돈 다음
`extract(page, ctx)` 가 불리고, `transform` 은 그 결과에 이어 붙는다. `ctx.url` 은 주소창
값이라 `PIPELINE_SESSION_RUN` 이 `{ source, url }` 을 받는다.

곁가지로 mock 페이지가 `$$eval` 을 몰라 시드가 mock 에서도 못 돌았다. **앱이 싣는 스크립트를
못 돌리는 mock 은 이 화면을 검증하지 못하는 mock** 이라, 시드가 쓰는 만큼 넓혔다.

회귀 테스트를 `tests/api/pipeline-session.test.ts` 에 뒀다 — 시드를 `scriptsService` 로 읽어
그대로 `runStep` 한다. 실행기와 시드가 다른 파일에 살아서, 둘을 가로지르는 테스트만 이걸 잡는다.

게이트 재실행: test 583 PASS, e2e 19/19 PASS, sweep 5/5 PASS.

## 아직 확인 못 한 것

| 무엇 | 왜 |
|---|---|
| 화면에서 켜기 → 주소 이동 → 스텝 실행 | 사이드카 기동은 손으로 확인했으나, 앱 UI 를 통한 왕복은 아직 안 돌려 봤다 |
| 사이드카 재시작 후 재부착 | 순수 로직은 테스트에 있으나(`AC-pipeline.jobs-10`), 진짜 크래시로는 안 돌려 봤다 |
| win32 · linux 스테이징 | 페처가 호스트 OS 릴리스만 고른다. mac 에서 Windows 용을 만들 수 없다 |
