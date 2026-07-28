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

## 지금의 정본 상태 (솔직하게)

steward 는 이 프로젝트 중간에 도입됐다. 아래 Surface 목록은 코드(`src/renderer/App.tsx` 라우트,
`tests/e2e/smoke.spec.ts` 의 `NAV_ITEMS`)에서 뽑은 **실재 화면 목록**이고, 기획 정본은 아직
안 쓰였다. 표의 "정본" 칸이 없음이면 그 화면에는 아직 정본 노드가 없다는 뜻이다 —
gate 단계에서 "명세 영향 없음" 으로 눙치지 말고 노드 신설을 제안해야 하는 자리다.

| Service | Surface ID | 라우트 | nav testid | 정본 |
|---|---|---|---|---|
| web | `web.remote` | `/web/remote` | `nav-web-remote` | 없음 |
| web | `web.code` | `/web/code` | `nav-web-code` | 없음 |
| mobile | `mobile.devices` | `/mobile/devices` | `nav-mobile-devices` | 없음 |
| mobile | `mobile.code` | `/mobile/code` | `nav-mobile-code` | 없음 |
| mobile | `mobile.inspector` | `/mobile/inspector` | `nav-mobile-inspector` | 없음 |
| bridge | `bridge.scenarios` | `/bridge/scenarios` | `nav-bridge-scenarios` | 없음 |
| bridge | `bridge.variables` | `/bridge/variables` | `nav-bridge-variables` | 없음 |
| bridge | `bridge.bus` | `/bridge/bus` | `nav-bridge-bus` | 없음 |
| bridge | `bridge.events` | `/bridge/events` | `nav-bridge-events` | 없음 |
| workspace | `workspace.switcher` | 상단바 | — | 없음 |

> `bridge` 는 UI에서 "설정 / Settings" 로 표시된다. 내부 식별자(라우트·IPC 채널·모듈 폴더)는
> 의도적으로 `bridge` 를 유지한다 — `CLAUDE.md` 의 명명 규칙 참고.

빈 칸을 한꺼번에 채우려면 `/steward:handover` 를 쓴다(지금 코드를 기준으로 정본을 채우는 단계).
개별 작업에서 걸리는 노드는 그 작업의 `spec` 단계가 채운다.
