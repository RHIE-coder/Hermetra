# docs/qa — 살아있는 테스트 정의

여기는 **무엇을 검증해야 하는가**(정의)를 담는다. 테스트 코드가 아니고, 실행 결과도 아니다.
코드는 `tests/` 와 `src/**/*.test.tsx` 에, 실행 회차 기록은 `docs/qa/runs/` 에 있다.

steward 의 `spec` 단계가 이 정의를 고치고, `gate` 단계가 (1) 새/변경 동작을 덮는 정의가 있는지
(2) 회차 기록을 남겼는지 본다. 설정: `.harness/steward/config.yaml` 의 `qa_dir: "docs/qa"`.

## 위계

```
TestPlan      제품 전체의 검증 전략 (plan.md)
└─ TestScenario  사용자 흐름 하나            → scenarios/<id>.md
   └─ TestSuite     한 화면·한 모듈 묶음
      └─ TestCase      단일 검증 항목 (안정 ID)
```

## 안정 ID

- TestCase: `CASE-<service>-NNN` — 예 `CASE-mobile-001`, `CASE-bridge-014`.
- 한 번 붙인 번호는 재사용하지 않는다. 케이스를 지워도 번호는 비워 둔다(기록이 가리킨다).
- 각 TestCase 는 **덮는 정본 노드 ID**(`docs/spec/` 의 `<service>.<surface>.<section>`)를 적고,
  구현된 테스트가 있으면 파일 경로까지 적는다. 이 세 줄이 기계 대조의 근거다:

```
### CASE-mobile-003 — 인스펙터가 스크린샷 없는 기기에서 빈 상태를 보인다
- 덮는 노드: mobile.inspector.tree
- 계층: API (IPC)
- 구현: tests/api/inspector.test.ts
- 인수조건: 스크린샷 응답이 비면 요소 트리 영역에 빈 상태 문구가 뜨고, 에러 토스트는 안 뜬다
```

## 계층 (Hermetra 의 5층 — CLAUDE.md §3.1)

| 계층 | 위치 | 러너 |
|---|---|---|
| 도메인 로직 단위 | `tests/unit/**` | Vitest (node) |
| 스키마 | `tests/schema/**` | Vitest (node) |
| API (IPC 핸들러) | `tests/api/**` | Vitest (node) |
| UI 컴포넌트 | `src/renderer/**/*.test.tsx` | Vitest + RTL + happy-dom |
| E2E | `tests/e2e/**` | Playwright (Electron, mock 드라이버) |

TestCase 마다 이 중 어느 계층에서 검증하는지 적는다. 전 계층을 다 요구하지 않는다 —
변경 영향 범위로 고른다.

## 커버리지 구멍

의도적으로 안 덮는 항목은 `coverage-gaps.md` 에 **전제와 함께** 적는다
("Appium 실기기 연결은 CI에 기기가 없어 e2e로 안 덮는다" 처럼).
gate 단계가 그 전제가 아직 유효한지 되본다 — 전제가 해소됐는데 구멍이 남아 있으면 지적한다.

## 지금의 정본 상태 (솔직하게)

테스트 **코드**는 이미 5계층에 걸쳐 있다(`tests/unit`, `tests/schema`, `tests/api`,
컴포넌트 테스트, `tests/e2e/smoke.spec.ts`). 테스트 **정의**(이 폴더)는 아직 안 쓰였다.
빈 칸을 한꺼번에 채우려면 `/steward:handover`, 개별 작업에서 걸리는 부분은 그 작업의
`spec` 단계가 채운다.
