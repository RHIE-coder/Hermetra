# TestScenario: 데이터 파이프라인 (`pipeline`)

소스에서 데이터를 꺼내 처리하고 쌓고 읽어내는 길. 덮는 정본: `docs/spec/pipeline/*`

**지금 이 흐름은 흐름이 아니다.** 화면 여섯이 전부 껍데기라, 여기서 검증할 수 있는 것은
"모양이 제자리에 있는가" — 라우트·내비게이션·순서·이름 — 뿐이다. 동작이 붙을 때마다 그
화면의 Suite 를 여기에 붙인다.

## TestSuite: `pipeline` 셸 — 여섯 화면의 자리

구현: `src/renderer/modules/pipeline/pages/pipeline-pages.test.tsx` (19) ·
`src/renderer/components/layout/sidebar.test.tsx` (6) · `tests/e2e/smoke.spec.ts` (8)

| Case | 무엇 | 덮는 노드 | 계층 | 구현 |
|---|---|---|---|---|
| CASE-pipeline-001 | 여섯 화면이 각자의 `page-pipeline-*` 컨테이너를 렌더한다 | `pipeline` | UI | `pipeline-pages.test.tsx` |
| CASE-pipeline-002 | 각 화면이 자기 제목을 머리에 건다 | `pipeline` | UI | `pipeline-pages.test.tsx` |
| CASE-pipeline-003 | 각 화면이 아직 만들어지지 않았음을 문구로 말한다 | `pipeline` | UI | `pipeline-pages.test.tsx` |
| CASE-pipeline-004 | 여섯 컨테이너 ID 가 서로 겹치지 않는다 | `pipeline` | UI | `pipeline-pages.test.tsx` |
| CASE-pipeline-005 | 사이드바에 여섯 항목이 각자의 라우트로 있다 | `app.shell.sidebar` | UI | `sidebar.test.tsx` |
| CASE-pipeline-006 | 여섯 항목이 파이프라인 순서로 놓인다 | `app.shell.sidebar` | UI | `sidebar.test.tsx` |
| CASE-pipeline-007 | 파이프라인 서랍이 레거시 서랍 위에 있다 | `app.shell.sidebar` | UI | `sidebar.test.tsx` |
| CASE-pipeline-008 | 항목을 누르면 그 화면이 뜬다 (여섯 전부) | `app.shell.sidebar` | E2E | `smoke.spec.ts` |

## TestSuite: `app.shell.sidebar` — 서랍 둘

파이프라인이 들어오며 레일이 서랍 하나에서 둘이 됐다. 두 서랍이 서로의 상태를 건드리지
않는다는 것이 이 Suite 의 전부다.

구현: `src/renderer/components/layout/sidebar.test.tsx` (7) · `tests/e2e/smoke.spec.ts` (2)

| Case | 무엇 | 덮는 노드 | 계층 | 구현 |
|---|---|---|---|---|
| CASE-pipeline-020 | 첫 실행에 파이프라인은 열리고 레거시는 접혀 있다 | `app.shell.sidebar` | UI · E2E | `sidebar.test.tsx` · `smoke.spec.ts` |
| CASE-pipeline-021 | 한 서랍을 접어도 다른 서랍은 열린 채다 | `app.shell.sidebar` | UI · E2E | `sidebar.test.tsx` · `smoke.spec.ts` |
| CASE-pipeline-022 | 각 서랍이 자기 열림 상태를 따로 기억한다 | `app.shell.sidebar` | UI | `sidebar.test.tsx` |
| CASE-pipeline-023 | 접힌 서랍의 항목은 DOM 에 없다 | `app.shell.sidebar` | UI | `sidebar.test.tsx` |
| CASE-pipeline-024 | 마지막에 편 대로 다시 뜬다 (두 서랍 각각) | `app.shell.sidebar` | UI | `sidebar.test.tsx` |
| CASE-pipeline-025 | 파이프라인 행에도 영역 액센트가 없다 | `app.theme` | UI | `sidebar.test.tsx` |
| CASE-pipeline-026 | 현재 파이프라인 라우트의 행이 눌려 들어간다 | `app.theme` | UI | `sidebar.test.tsx` |

## TestSuite: 표면 판정기 — 스크롤로 닿는 잘림

레일이 15행이 되며 좁은 창에서 마지막 행이 접힌 선 아래로 내려간다. 판정기가 그것을
"7px 짜리 못 누를 표적" 으로 읽던 것을 고쳤다 — 어댑터가 `offscreen` 을 내보내고 판정기는
그 플래그만 읽는다(DOM 어휘는 어댑터에 남는다).

구현: `tests/unit/surface-checks.test.ts` (2)

| Case | 무엇 | 덮는 노드 | 계층 | 구현 |
|---|---|---|---|---|
| CASE-pipeline-040 | `offscreen` 요소는 표적 크기 판정에서 빠진다 | `app.theme` | 단위 | `tests/unit/surface-checks.test.ts` |
| CASE-pipeline-041 | 진짜로 작은 표적은 그대로 걸린다 | `app.theme` | 단위 | `tests/unit/surface-checks.test.ts` |

## 아직 없는 것

동작이 없으니 단위·스키마·API 계층 케이스가 하나도 없다. 이것은 구멍이 아니라 **아직 없는
코드**다 — 화면에 로직이 붙는 순간 그 계층부터(테스트 먼저) 시작한다. `coverage-gaps.md`
에 적지 않는 이유도 그것이다.
