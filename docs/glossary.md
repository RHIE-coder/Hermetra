# 용어사전

이 프로젝트에서 합의된 말을 쌓는 곳이다. steward 의 `intake` 단계가 새 용어를 여기 붙인다
(`.harness/steward/config.yaml` 의 `glossary_path`). 규칙:

- 지어낸 조어를 만들지 않는다 — 그 분야 사람이 실제로 쓰는 말만 쓴다.
- 한 용어에 한 뜻. 같은 것을 두 이름으로 부르고 있으면 그 사실을 적고 하나로 모은다.
- 코드 식별자와 UI 표시명이 다르면 **둘 다** 적는다.

## 제품

| 용어 | 뜻 | 코드 식별자 |
|---|---|---|
| 브리지 (Bridge) | 웹·모바일 자동화 세션을 잇는 계층. Hermetra 의 차별점 | `bridge` (라우트·IPC·모듈 폴더) |
| 설정 / Settings | **브리지 모듈의 UI 표시명.** 내부 식별자는 의도적으로 `bridge` 를 유지한다 | 표시명만 다름 |
| 공유 버스 (Variable Bus) | 웹·모바일 스크립트가 실시간으로 값을 주고받는 변수 버스. 메모리에만 있고 앱을 끄면 비워진다 | `VarBus` |
| 이벤트 버스 (Event Bus) | 한쪽에서 발행한 사건을 반대쪽이 받는 pub/sub 채널. 채널 이름은 `web.*`·`mobile.*`·`bridge.*` 로 구분한다 | `BridgeEventBus` |
| 시나리오 (Scenario) | 웹·모바일을 넘나드는 순서 있는 단계 목록. 각 단계는 `{platform, scriptPath, waitFor?}` | `Orchestrator` |
| 워크스페이스 (Workspace) | 데이터 격리 단위. 모든 저장 파일이 활성 워크스페이스 폴더 아래에 든다 | `workspaceManager().activeDir()` |
| 드라이버 (Driver) | 자동화 실행 주체. 웹=Playwright, 모바일=Appium. 기본은 mock 이고 `HERMETRA_DRIVERS=real` 로 실물로 바꾼다 | `WebDriver` · `MobileDriver` |
| 연결 설정 (Connection) | 워크스페이스마다 두는 기기·서버 접속 설정. 옛 이름 "Capability" 를 대체했다 | `Connection` |
| 인스펙터 (Inspector) | 모바일 화면 스크린샷과 요소 트리를 함께 보는 화면 | `mobile/inspector` |
| 변수 프로필 (Variable profile) | 공유(Shared)/개인(Private)으로 갈라 저장하는 변수 묶음. 개인 값은 저장소에 올리지 않는다 | `variables/*.json` |
| IPC 계약 | 렌더러↔메인 호출의 유일한 정본. 채널 문자열과 입출력 타입을 한곳에 선언한다 | `src/shared/ipc/channels.ts` |

## 하네스 (steward)

| 용어 | 뜻 |
|---|---|
| 정본 (canonical) | "지금 제품이 어떠해야 하는가"를 담은 살아있는 문서 — `docs/spec/`(기획), `docs/qa/`(테스트 정의). 작업 기록이 아니다 |
| 바통 (artifact) | 단계 사이에 넘기는 작업 산출물. `.harness/steward/artifacts/<작업폴더>/` 에 모인다 |
| 작업폴더 | 바통이 모이는 폴더 이름. config 의 `feature:` 가 정한다. 이 프로젝트는 브랜치를 쓰지 않으므로(main 단독) `feature:` 를 비우면 전부 한 폴더에 섞인다 |
| 드리프트 (drift) | 코드와 정본이 어긋난 상태. `gate` 단계가 변경분과 정본을 대조해 잡는다 |
| 경로 판정 | 요청 크기에 따라 어느 단계를 타는지 정하는 것 — `consult`·`direct`·`hotfix`·`small`·`feature`·`greenfield` |
| 빈자리 (values / bindings) | steward 가 선언하고 이 프로젝트가 채우는 자리. 값=명령·경로 리터럴, 능력=이 프로젝트의 구현 |
| 표면 (surface) | 화면이 그려지는 매체 — 브라우저·데스크탑 앱·모바일·TUI. Hermetra 는 Electron 데스크탑 표면이다 |
| 면역 원장 (immunity ledger) | 같은 실수를 반복하지 않도록 굳혀 둔 규칙 모음 — `.claude/immunity/ledger.md`. 일부는 훅이 강제한다 |
