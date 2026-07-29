---
phase: handover
status: ready
inputs: [handover-inventory]
---

# handover 보고 — 정본 백필

기준 커밋 `125eb47` · main · 2026-07-28

## 커버리지 표 (기준표 대비)

| 기준표 항목 | 개수 | 정본 채움 | 빈 칸 |
|---|---|---|---|
| 화면 (Surface) | 10 | 10 | 0 |
| 셸 부품 (사이드바 그룹 3 · 상단바 5) | 8 | 8 | 0 |
| 정책 (P1~P20) | 20 | 20 | 0 |
| IPC 채널 묶음 | 13 | 13 | 0 |
| Service 정책 문서 | 4 | 4 | 0 |
| 아키텍처 문서 | 1 | 1 | 0 |
| **정본 합계** | **56** | **56** | **0** |

| 테스트 정의 | 개수 |
|---|---|
| TestScenario | 5 |
| TestSuite | 12 |
| TestCase (정의) | 166 |
| TestCase (구현됨) | 128 |
| TestCase (미구현 → 구멍 문서에 등록) | 38 |

## 채운 것

- `docs/spec/architecture.md` — 프로세스 3개, 두 방향 데이터 흐름, 저장소 표,
  워크스페이스 격리, 드라이버 전략, UI 토큰, 이름 규칙. 각 절에 "왜" 를 붙였다.
- `docs/spec/application.md` — 앱 셸(사이드바 9항목 · 상단바 5부품)과 전역 규칙 5개
  (i18n · 토큰 · 워크스페이스 격리 · 드라이버 모드 · IPC 계약).
- `docs/spec/{web,mobile,bridge,workspace}/README.md` — Service 규칙과 상태 소유.
- Surface 문서 10개 — Section/Component 단위 인수조건. 화면마다 "알려진 한계" 절.
- `docs/qa/plan.md` — 검증 전략 두 축, 5계층, 임계값, 규율.
- `docs/qa/scenarios/*.md` 5개 — Suite 12개, Case 166개. 각 케이스에 덮는 노드 ID ·
  계층 · 구현 파일(또는 미구현)을 적었다.
- `docs/qa/coverage-gaps.md` — 구멍 7개를 전제와 함께. 의도된 것 1개(`gap-real-driver`),
  의도되지 않은 것 6개.
- `docs/qa/runs/2026-07-28-steward-harness-setup.md` — 이번 전체 회귀 증빙.
- `docs/glossary.md` — 제품 용어 11 · 하네스 용어 8 (setup 단계에서 씨앗, 이번에 유지).

## 코드에 맞춰 고친 노드

없음. 이번 handover 이전에 정본이 존재하지 않았으므로 "코드와 어긋난 기존 노드" 가 없었다.
정본은 전부 코드를 역설계해 새로 썼다.

## 미구현이라 결정을 받아야 하는 것

### `connection-to-session-gap` (결정 대기)

연결 구성(Connection)을 실제 Appium 세션으로 바꾸는 경로가 없다.

- `MOBILE_SESSION_START` 는 `memoryStore.capabilities` 에서 프로파일을 찾는다.
- 그 getter 는 P4(devices-connection-config) 이후 **항상 `[]`** 를 돌려준다(setter 는 no-op).
- 따라서 실물 드라이버 모드에서 세션 시작은 항상 "프로파일을 찾을 수 없습니다" 로 실패한다.
- 같은 이유로 `MOBILE_LIST_CAPABILITIES` · `MOBILE_SAVE_CAPABILITY` ·
  `MOBILE_REMOVE_CAPABILITY` · `MOBILE_TEST_CAPABILITY` 는 결과를 낼 수 없다.
- 인스펙터의 `startInspector()` 는 "이미 열린 세션을 재사용" 하는 no-op 이라 같은 벽에 막힌다.
- mock 모드는 영향이 없다 — 그래서 테스트 223개와 e2e 11개가 전부 초록인데도 이 구멍이
  드러나지 않았다.

선택지:
1. 세션 시작을 **사용중 연결 구성** 기준으로 다시 배선하고 옛 Capability 채널 5개를
   은퇴시킨다. (기능이 완성되는 방향)
2. 옛 채널을 유지하고 Capability 저장을 되살린다. (P4 결정을 되돌리는 방향)
3. 지금 상태를 의도된 한계로 굳히고 문서에만 남긴다. (실물 모드는 당분간 쓰지 않는다는 뜻)

정본에는 미구현으로 명시해 두었다(`docs/spec/mobile/README.md` ·
`docs/spec/mobile/devices.md` · `docs/spec/mobile/code.md` ·
`docs/spec/mobile/inspector.md` · `docs/qa/coverage-gaps.md`). 요구가 조용히 사라지지
않도록 지우지 않았다.

## 의도 미상으로 남긴 것

코드 주석·git 이력·`.specs/done/` 에서 근거를 찾을 수 있어 이번에는 없다.
다만 아래 두 가지는 **근거가 코드에만 있고 의도가 기록되지 않았다** — 다음에 이 부분을
만질 사람이 물어볼 만한 자리로 표시해 둔다:

- 기기 폴링 간격 5초 · 이벤트 이력 상한 200 · 이벤트 대기 30초 — 값의 근거가 없다.
  경험값으로 보이며 설정으로 빼지 않았다.
- 시나리오 단계의 `scriptPath` 가 아직 실행에 쓰이지 않는 것 — 코드 주석은 "자리표시자"
  라고만 말한다. 파일을 읽어 넘기는 것이 원래 계획이었는지, 다른 방식(경로를 드라이버가
  직접 읽기)을 의도했는지는 기록이 없다.

## 제외 승인받은 것

없음. 이번 handover 에서 유저에게 제외 승인을 요청한 항목이 없다.

## 다음에 하면 값이 가장 큰 것

`docs/qa/coverage-gaps.md` 의 `gap-golden-path` — 웹→모바일 인계를 mock 드라이버로 끝까지
지나는 e2e 2개. 도구 설치가 필요 없고, 이 제품의 존재 이유를 지키는 회귀다.
