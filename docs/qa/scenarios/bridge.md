# TestScenario: 브리지 (`bridge`)

웹과 모바일이 값과 사건을 주고받고, 한 시나리오가 양쪽을 몰고 가는 길.
덮는 정본: `docs/spec/bridge/*`

## TestSuite: `bridge.bus` — 공유 버스

구현: `tests/unit/varBus.test.ts` (9) ·
`src/renderer/modules/bridge/pages/VariableBusPage.test.tsx` (3)

| Case | 무엇 | 덮는 노드 | 계층 | 구현 |
|---|---|---|---|---|
| CASE-bridge-001 | 값을 쓰면 갱신 시각·주체가 함께 기록된다 | `bridge.bus` | 단위 | `tests/unit/varBus.test.ts` |
| CASE-bridge-002 | 같은 키에 다시 쓰면 항목이 하나로 유지된다 | `bridge.bus` | 단위 | `tests/unit/varBus.test.ts` |
| CASE-bridge-003 | 목록이 키 알파벳 순으로 정렬된다 | `bridge.bus` | 단위 | `tests/unit/varBus.test.ts` |
| CASE-bridge-004 | 없는 키를 읽으면 없음이 온다 | `bridge.bus` | 단위 | `tests/unit/varBus.test.ts` |
| CASE-bridge-005 | 없는 키 삭제는 목록을 바꾸지 않는다 | `bridge.bus` | 단위 | `tests/unit/varBus.test.ts` |
| CASE-bridge-006 | 비우기가 목록을 빈 상태로 만든다 | `bridge.bus` | 단위 | `tests/unit/varBus.test.ts` |
| CASE-bridge-007 | 쓰기·삭제·비우기가 각각 통보된다 | `bridge.bus` | 단위 | `tests/unit/varBus.test.ts` |
| CASE-bridge-008 | 화면에서 키·값을 저장하면 표에 나타난다 | `bridge.bus.write` | UI | `VariableBusPage.test.tsx` |
| CASE-bridge-009 | 표가 비어 있으면 빈 상태 문구를 보인다 | `bridge.bus.snapshot` | UI | `VariableBusPage.test.tsx` |
| CASE-bridge-010 | 항목 삭제·전체 비우기가 표에 반영된다 | `bridge.bus.snapshot` | UI | `VariableBusPage.test.tsx` |
| CASE-bridge-011 | 다른 쪽이 쓴 값이 브로드캐스트로 표에 들어온다 | `bridge.bus.snapshot` | UI | 미구현 |

## TestSuite: `bridge.events` — 이벤트

구현: `tests/unit/eventBus.test.ts` (9) ·
`src/renderer/modules/bridge/pages/EventStreamPage.test.tsx` (4)

| Case | 무엇 | 덮는 노드 | 계층 | 구현 |
|---|---|---|---|---|
| CASE-bridge-020 | 발행하면 식별자·시각이 붙어 이력에 쌓인다 | `bridge.events` | 단위 | `tests/unit/eventBus.test.ts` |
| CASE-bridge-021 | 이력 상한 200건을 넘기면 오래된 것이 밀려난다 | `bridge.events` | 단위 | `tests/unit/eventBus.test.ts` |
| CASE-bridge-022 | 채널 구독자는 그 채널 사건만 받는다 | `bridge.events` | 단위 | `tests/unit/eventBus.test.ts` |
| CASE-bridge-023 | 대기 중 사건이 오면 즉시 풀린다 | `bridge.events` | 단위 | `tests/unit/eventBus.test.ts` |
| CASE-bridge-024 | 사건이 안 오면 시간 초과로 실패한다 | `bridge.events` | 단위 | `tests/unit/eventBus.test.ts` |
| CASE-bridge-025 | 없는 식별자 삭제는 이력을 바꾸지 않는다 | `bridge.events` | 단위 | `tests/unit/eventBus.test.ts` |
| CASE-bridge-026 | 비우기가 이력을 빈 상태로 만든다 | `bridge.events` | 단위 | `tests/unit/eventBus.test.ts` |
| CASE-bridge-027 | 화면에서 채널을 발행하면 타임라인에 나타난다 | `bridge.events.emit` | UI | `EventStreamPage.test.tsx` |
| CASE-bridge-028 | 타임라인이 비어 있으면 빈 상태 문구를 보인다 | `bridge.events.timeline` | UI | `EventStreamPage.test.tsx` |
| CASE-bridge-029 | 항목 삭제·전체 비우기가 타임라인에 반영된다 | `bridge.events.timeline` | UI | `EventStreamPage.test.tsx` |

## TestSuite: `bridge.scenarios` — 시나리오

구현: `tests/unit/orchestrator.test.ts` (8) ·
`src/renderer/modules/bridge/pages/ScenariosPage.test.tsx` (2)

| Case | 무엇 | 덮는 노드 | 계층 | 구현 |
|---|---|---|---|---|
| CASE-bridge-040 | 단계가 정의 순서대로 실행되고 상태가 흐른다 | `bridge.scenarios` | 단위 | `tests/unit/orchestrator.test.ts` |
| CASE-bridge-041 | 실패한 단계 뒤는 실행되지 않는다 | `bridge.scenarios` | 단위 | `tests/unit/orchestrator.test.ts` |
| CASE-bridge-042 | 예외가 아닌 값을 던져도 메시지가 문자열로 남는다 | `bridge.scenarios` | 단위 | `tests/unit/orchestrator.test.ts` |
| CASE-bridge-043 | 발행할 사건이 단계 완료 후 나간다 | `bridge.scenarios` | 단위 | `tests/unit/orchestrator.test.ts` |
| CASE-bridge-044 | both 단계가 양쪽 드라이버를 각각 한 번 부른다 | `bridge.scenarios` | 단위 | `tests/unit/orchestrator.test.ts` |
| CASE-bridge-045 | 중지 후 남은 단계가 건너뜀으로 기록된다 | `bridge.scenarios` | 단위 | `tests/unit/orchestrator.test.ts` |
| CASE-bridge-046 | 두 번째 중지는 아무 일도 하지 않는다 | `bridge.scenarios` | 단위 | `tests/unit/orchestrator.test.ts` |
| CASE-bridge-047 | 알 수 없는 실행 쪽은 드라이버 없이 완료된다 | `bridge.scenarios` | 단위 | `tests/unit/orchestrator.test.ts` |
| CASE-bridge-048 | 목록·단계 패널이 렌더되고 선택이 동작한다 | `bridge.scenarios.list` | UI | `ScenariosPage.test.tsx` |
| CASE-bridge-049 | 실행 상태가 단계별 표시에 반영된다 | `bridge.scenarios.steps` | UI | `ScenariosPage.test.tsx` |
| CASE-bridge-050 | 없는 시나리오 실행이 오류가 된다 | `bridge.scenarios` | API | 미구현 |
| CASE-bridge-051 | 삭제가 확인을 거쳐 목록에서 제거한다 | `bridge.scenarios.list` | UI | 미구현 |

## TestSuite: `bridge.variables` — 변수

구현: `tests/schema/variables.test.ts` (3)

| Case | 무엇 | 덮는 노드 | 계층 | 구현 |
|---|---|---|---|---|
| CASE-bridge-060 | 공유 파일에 개인 변수의 값이 들어가지 않는다 | `bridge.variables` | 스키마 | `tests/schema/variables.test.ts` |
| CASE-bridge-061 | 저장 후 다시 읽으면 개인 값이 복원된다 | `bridge.variables` | 스키마 | `tests/schema/variables.test.ts` |
| CASE-bridge-062 | 공유 파일이 없으면 씨앗 프로파일로 시작한다 | `bridge.variables` | 스키마 | `tests/schema/variables.test.ts` |
| CASE-bridge-063 | 개인 파일이 깨져도 로드가 성공하고 키가 남는다 | `bridge.variables` | 스키마 | 미구현 |
| CASE-bridge-064 | 프로파일을 고르면 두 표가 그 프로파일로 바뀐다 | `bridge.variables.profiles` | UI | 미구현 |
| CASE-bridge-065 | 이름이 비면 프로파일이 추가되지 않는다 | `bridge.variables.profiles` | UI | 미구현 |
| CASE-bridge-066 | 개인 변수 값이 가려져 보인다 | `bridge.variables.private` | UI | 미구현 |
| CASE-bridge-067 | 복사가 값을 클립보드로 넣고 복사됨을 표시한다 | `bridge.variables.private` | UI | 미구현 |
