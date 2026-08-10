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

## TestSuite: `pipeline.sidecar` — 감시와 재시작

순수 감독자(상태기계 + 재시작 정책)와 어댑터(자식 → 핸들, 런타임 탐색)를 가른다. 감독자에는
가짜 프로세스와 가짜 타이머를 넣어 spawn 없이 전 분기를 돈다.

구현: `tests/unit/sidecar-supervisor.test.ts` (13) · `tests/api/sidecar.test.ts` (12)

| Case | 무엇 | 덮는 노드 | 계층 | 구현 |
|---|---|---|---|---|
| CASE-pipeline-060 | start 하면 starting, 주소를 받으면 ready | `pipeline.sidecar` | 단위 | `sidecar-supervisor.test.ts` |
| CASE-pipeline-061 | 주소가 아닌 출력은 무시한다 | `pipeline.sidecar` | 단위 | `sidecar-supervisor.test.ts` |
| CASE-pipeline-062 | 이미 도는데 start 해도 자식이 둘이 되지 않는다 | `pipeline.sidecar` | 단위 | `sidecar-supervisor.test.ts` |
| CASE-pipeline-063 | 스스로 죽으면 crashed 이고 이유가 남는다 | `pipeline.sidecar` | 단위 | `sidecar-supervisor.test.ts` |
| CASE-pipeline-064 | 재시작이 백오프로 예약된다 | `pipeline.sidecar` | 단위 | `sidecar-supervisor.test.ts` |
| CASE-pipeline-065 | ready 에 닿으면 재시작 횟수가 0으로 돌아간다 | `pipeline.sidecar` | 단위 | `sidecar-supervisor.test.ts` |
| CASE-pipeline-066 | maxRestarts 를 넘기면 포기한다 | `pipeline.sidecar` | 단위 | `sidecar-supervisor.test.ts` |
| CASE-pipeline-067 | 사람이 멈춘 것은 crashed 가 아니고 재시작도 없다 | `pipeline.sidecar` | 단위 | `sidecar-supervisor.test.ts` |
| CASE-pipeline-080 | 두 청크에 걸친 주소를 한 줄로 잇는다 | `pipeline.sidecar` | API | `tests/api/sidecar.test.ts` |
| CASE-pipeline-081 | 한 청크의 두 줄을 나눈다 | `pipeline.sidecar` | API | `tests/api/sidecar.test.ts` |
| CASE-pipeline-082 | spawn 실패도 죽음으로 보고된다 | `pipeline.sidecar` | API | `tests/api/sidecar.test.ts` |
| CASE-pipeline-083 | 런타임이 없으면 null 이고 throw 하지 않는다 | `pipeline.sidecar` | API | `tests/api/sidecar.test.ts` |
| CASE-pipeline-084 | 채널 문자열이 유일하다 | `app.ipc` | API | `tests/api/sidecar.test.ts` |

## TestSuite: `pipeline.automatch` — 재배치

순수 채점·판정(`automatch.ts`)과 지문 뜨기(`snapshot.ts`)를 가른다. 지문 쪽은 손으로 만든
객체가 아니라 **실제 DOM**(happy-dom)에 대고 돈다 — 마크업에서 도는 게 목적인데 손으로 만든
스냅샷은 코드가 하는 대로 조용히 동의해 준다.

구현: `tests/unit/automatch.test.ts` (20) · `tests/unit/snapshot.test.ts` (11)

| Case | 무엇 | 덮는 노드 | 계층 | 구현 |
|---|---|---|---|---|
| CASE-pipeline-100 | 같은 스냅샷은 정확히 1점이다 | `pipeline.automatch` | 단위 | `automatch.test.ts` |
| CASE-pipeline-101 | 점수가 대칭이다 | `pipeline.automatch` | 단위 | `automatch.test.ts` |
| CASE-pipeline-102 | 점수가 0..1 을 벗어나지 않는다 | `pipeline.automatch` | 단위 | `automatch.test.ts` |
| CASE-pipeline-103 | 클래스가 갈려도 id·텍스트가 남으면 살아남는다 | `pipeline.automatch` | 단위 | `automatch.test.ts` |
| CASE-pipeline-104 | 트리에서 더 깊어져도 살아남는다 | `pipeline.automatch` | 단위 | `automatch.test.ts` |
| CASE-pipeline-105 | id 가 클래스보다 무겁다 | `pipeline.automatch` | 단위 | `automatch.test.ts` |
| CASE-pipeline-106 | 강한 신호 하나가 나머지 전부를 이기지 못한다 | `pipeline.automatch` | 단위 | `automatch.test.ts` |
| CASE-pipeline-107 | 모양만 같은 다른 행을 같은 요소로 보지 않는다 | `pipeline.automatch` | 단위 | `automatch.test.ts` |
| CASE-pipeline-108 | 셀렉터가 아직 맞으면 exact, 재배치 없음 | `pipeline.automatch` | 단위 | `automatch.test.ts` |
| CASE-pipeline-109 | 확실한 1등이면 재배치하고 점수를 보고한다 | `pipeline.automatch` | 단위 | `automatch.test.ts` |
| CASE-pipeline-110 | 2위와 구분이 안 되면 고르지 않는다 | `pipeline.automatch` | 단위 | `automatch.test.ts` |
| CASE-pipeline-111 | 기준 미달이면 사람에게 넘긴다 | `pipeline.automatch` | 단위 | `automatch.test.ts` |
| CASE-pipeline-112 | 후보가 없어도 던지지 않고 lost 로 보고한다 | `pipeline.automatch` | 단위 | `automatch.test.ts` |
| CASE-pipeline-113 | 가중치 합이 1이다 | `pipeline.automatch` | 단위 | `automatch.test.ts` |
| CASE-pipeline-120 | 태그·속성·자기 텍스트·조상을 기록한다 | `pipeline.automatch` | 단위 | `snapshot.test.ts` |
| CASE-pipeline-121 | 자손의 텍스트를 자기 것으로 신고하지 않는다 | `pipeline.automatch` | 단위 | `snapshot.test.ts` |
| CASE-pipeline-122 | 같은 태그 형제 중에서만 순번을 센다 | `pipeline.automatch` | 단위 | `snapshot.test.ts` |
| CASE-pipeline-123 | style·프레임워크 부기 속성을 버린다 | `pipeline.automatch` | 단위 | `snapshot.test.ts` |
| CASE-pipeline-124 | 생성된 클래스 토큰만 버리고 쓴 것은 남긴다 | `pipeline.automatch` | 단위 | `snapshot.test.ts` |
| CASE-pipeline-125 | 해시·중첩이 바뀐 배포 뒤에도 요소를 되찾는다 | `pipeline.automatch` | 단위 | `snapshot.test.ts` |
| CASE-pipeline-126 | 똑같은 행이 둘이면 추측하지 않는다 | `pipeline.automatch` | 단위 | `snapshot.test.ts` |

## 아직 없는 것

**화면 여섯에는 여전히 동작이 없다.** 사이드카가 생기며 단위·API 계층이 채워졌지만 그것은
프로세스 감시이지 수집이 아니다. 소스·수집·처리·저장소의 로직은 아직 코드가 없고, 그래서
케이스도 없다 — 구멍이 아니라 **아직 없는 코드**이므로 `coverage-gaps.md` 에 적지 않는다.
화면에 로직이 붙는 순간 그 계층부터(테스트 먼저) 시작한다.

사이드카에서 **e2e 로 안 덮는 것**이 하나 있다: 실제 Camoufox 기동. e2e 는 mock 드라이버
전용이고(`plan.md`), 150MB 브라우저를 받아야 도는 테스트는 스모크에 넣지 않는다. 실제 기동은
`scratchpad/camoufox-spike/` 에서 손으로 확인했다 — Electron 안에서 Imperva 통과 9.2초.
