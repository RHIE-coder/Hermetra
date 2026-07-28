# docs/spec — 살아있는 기획 정본

이 폴더는 **지금 제품이 어떠해야 하는가**를 담는다. 작업 단위 기록이 아니다.
작업 단위 산출물(intake·build-report·gate-report 등)은 `.harness/steward/artifacts/<작업폴더>/`
에, 과거 스프린트 스펙은 `.specs/done/` 에 있다. 여기 있는 문서는 **현재형으로만** 쓴다.

steward 의 `spec` 단계가 이 트리를 고치고, `gate` 단계가 코드와의 어긋남(drift)을 대조한다.
설정: `.harness/steward/config.yaml` 의 `spec_dir: "docs/spec"`.

## 위계와 파일 배치

```
Application  제품 전체 (이 README + application.md)
└─ Service   web · mobile · bridge · workspace      → <service>/README.md
   └─ Surface   화면 하나                            → <service>/<surface>.md
      └─ Section  화면 안의 영역
         └─ Component  영역 안의 부품
```

Surface 이하는 한 파일 안에서 제목 깊이로 나눈다(`##` Section, `###` Component).
파일을 더 쪼개지 말 것 — 화면 하나를 한 눈에 읽을 수 있어야 한다.

## 안정 ID

노드마다 `<service>.<surface>.<section>` 형태의 안정 ID를 붙인다. 코드·테스트와 기계 대조가
목적이므로 **한 번 붙인 ID는 바꾸지 않는다** (화면 이름이 바뀌어도 ID는 유지, 표시명만 고친다).

```
mobile.inspector             Surface
mobile.inspector.tree        Section
bridge.bus.publish-form      Section
```

UI 라벨은 ID가 아니다 — 라벨은 `src/renderer/lib/messages.ts` 의 en/ko 키가 정본이다.

## 인수조건

새/변경 동작마다 인수조건을 최소 1개 적는다. **검증 가능한 문장**으로 — "무엇이 되면 끝인가".
디자인 문서에만 적힌 상호작용 요구도 인수조건으로 올린다(안 올리면 아무 단계도 검증하지 않는다).
인수조건은 `docs/qa/` 의 TestCase 와 짝지어야 한다.

## 트리

| 문서 | 담는 것 |
|---|---|
| `architecture.md` | 프로세스 3개 · 데이터 흐름 · 저장소 · 기술 선택의 "왜" |
| `application.md` | 앱 셸(사이드바·상단바)과 전역 규칙(i18n · 토큰 · 워크스페이스 격리 · 드라이버 모드 · IPC) |

| Service | Surface ID | 라우트 | nav testid | 정본 |
|---|---|---|---|---|
| web | `web.remote` | `/web/remote` | `nav-web-remote` | `web/remote.md` |
| web | `web.code` | `/web/code` | `nav-web-code` | `web/code.md` |
| mobile | `mobile.devices` | `/mobile/devices` | `nav-mobile-devices` | `mobile/devices.md` |
| mobile | `mobile.code` | `/mobile/code` | `nav-mobile-code` | `mobile/code.md` |
| mobile | `mobile.inspector` | `/mobile/inspector` | `nav-mobile-inspector` | `mobile/inspector.md` |
| bridge | `bridge.scenarios` | `/bridge/scenarios` | `nav-bridge-scenarios` | `bridge/scenarios.md` |
| bridge | `bridge.variables` | `/bridge/variables` | `nav-bridge-variables` | `bridge/variables.md` |
| bridge | `bridge.bus` | `/bridge/bus` | `nav-bridge-bus` | `bridge/bus.md` |
| bridge | `bridge.events` | `/bridge/events` | `nav-bridge-events` | `bridge/events.md` |
| workspace | `workspace.switcher` | 상단바 | — | `workspace/switcher.md` |

Service 규칙(그 서비스 전체에 걸리는 정책·상태 소유)은 각 폴더의 `README.md` 에 있다.

> `bridge` 는 UI에서 "설정 / Settings" 로 표시된다. 내부 식별자(라우트·IPC 채널·모듈 폴더)는
> 의도적으로 `bridge` 를 유지한다 — `CLAUDE.md` 의 명명 규칙 참고.

## 상태 (2026-07-28 handover 기준)

steward 는 이 프로젝트 중간에 도입됐고, 위 정본은 그 시점의 **코드를 역설계해** 채운
것이다. 화면 10개 · 전역 규칙 5개 · Service 정책 4개에 빈 칸은 없다.
단, 정본이 "지금 이렇게 동작한다"를 적은 것이지 "이렇게 동작해야 한다"를 새로 정한 것은
아니다 — 각 문서 끝의 "알려진 한계" 가 그 경계다.

미구현으로 명시된 것 하나가 결정을 기다린다: `mobile/README.md` 의
`connection-to-session-gap`.

이후 개별 작업에서 걸리는 노드는 그 작업의 `spec` 단계가 갱신한다. 과거 작업 단위 스펙은
`.specs/done/` 에 그대로 있다(역사 기록이며 정본이 아니다).
