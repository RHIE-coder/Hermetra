# TestScenario: 워크스페이스와 앱 셸 (`workspace` · `app`)

프로젝트를 갈아 끼우고, 셸이 그 전환을 따라가는 길.
덮는 정본: `docs/spec/workspace/*` · `docs/spec/application.md`

## TestSuite: `workspace` — 워크스페이스 도메인

구현: `tests/schema/storage.test.ts` (7, 워크스페이스 폴더 안 store.json 형태)

| Case | 무엇 | 덮는 노드 | 계층 | 구현 |
|---|---|---|---|---|
| CASE-workspace-001 | store.json 이 없으면 기본값(북마크·예시 시나리오)으로 시작한다 | `app.tenancy` | 스키마 | `tests/schema/storage.test.ts` |
| CASE-workspace-002 | 깨진 store.json 은 기본값으로 떨어진다 | `app.tenancy` | 스키마 | `tests/schema/storage.test.ts` |
| CASE-workspace-003 | 낡은 capability 필드는 읽을 때 무시되고 쓸 때 안 나간다 | `app.tenancy` | 스키마 | `tests/schema/storage.test.ts` |
| CASE-workspace-004 | 없는 시나리오 삭제는 목록을 바꾸지 않는다 | `bridge.scenarios` | 스키마 | `tests/schema/storage.test.ts` |
| CASE-workspace-005 | 워크스페이스가 하나뿐이면 삭제되지 않는다 | `workspace` | API | 미구현 |
| CASE-workspace-006 | 새로 만들면 폴더와 scripts 하위 폴더가 생긴다 | `workspace` | API | 미구현 |
| CASE-workspace-007 | 같은 식별자 저장은 덮어쓰고 새 식별자는 추가된다 | `workspace` | API | 미구현 |
| CASE-workspace-008 | 목록에 없는 식별자를 활성으로 지정하면 무시된다 | `workspace` | API | 미구현 |
| CASE-workspace-009 | 활성을 지우면 남은 첫 번째가 활성이 된다 | `workspace` | API | 미구현 |
| CASE-workspace-010 | 목록 파일이 깨져도 기본 워크스페이스로 뜬다 | `workspace` | API | 미구현 |
| CASE-workspace-011 | 이름이 비면 안전한 슬러그로 대체된다 | `workspace` | API | 미구현 |
| CASE-workspace-012 | 포트가 없으면 9222로 떨어진다 | `workspace` | API | 미구현 |
| CASE-workspace-013 | 전환기의 전환·이름 바꾸기·삭제·만들기가 동작한다 | `workspace.switcher.list` | UI | 미구현 |
| CASE-workspace-014 | 하나뿐일 때 삭제 시 안내를 보인다 | `workspace.switcher.list` | UI | 미구현 |
| CASE-workspace-015 | 전환하면 각 모듈 상태가 그 워크스페이스로 다시 읽힌다 | `workspace.switcher.list` | UI | 미구현 |

## TestSuite: `app.shell` — 앱 셸

구현: `src/renderer/components/layout/sidebar.test.tsx` (3) ·
`src/renderer/components/layout/topbar.test.tsx` (3) ·
`tests/e2e/smoke.spec.ts` (3 — 항목 9개 존재 + 각 항목 이동 포함)

| Case | 무엇 | 덮는 노드 | 계층 | 구현 |
|---|---|---|---|---|
| CASE-app-001 | 사이드바 그룹 3개와 항목 9개가 렌더된다 | `app.shell.sidebar` | UI | `sidebar.test.tsx` |
| CASE-app-002 | 각 항목의 testid 가 정본 표와 일치한다 | `app.shell.sidebar` | E2E | `tests/e2e/smoke.spec.ts` |
| CASE-app-003 | 현재 라우트의 항목이 활성으로 구분된다 | `app.shell.sidebar` | UI | `sidebar.test.tsx` |
| CASE-app-004 | 앱이 뜨고 제목·사이드바가 보인다 | `app.shell` | E2E | `tests/e2e/smoke.spec.ts` |
| CASE-app-005 | 항목 9개를 눌러 각 페이지 컨테이너가 뜬다 | `app.shell.sidebar` | E2E | `tests/e2e/smoke.spec.ts` |
| CASE-app-006 | 버스·이벤트 카운터가 브로드캐스트로 갱신된다 | `app.shell.topbar` | UI | 미구현 |
| CASE-app-007 | 언어 전환이 화면 문자열을 바꾼다 | `app.shell.topbar` | UI | 미구현 |
| CASE-app-008 | 테마 전환(밝음/어두움/시스템)이 반영된다 | `app.shell.topbar` | UI | 미구현 |
| CASE-app-009 | 알 수 없는 라우트가 홈으로 되돌려진다 | `app.shell` | UI | 미구현 |
| CASE-app-010 | 버스·이벤트가 비어 있으면 카운터가 중립이다 | `app.theme` | UI | `topbar.test.tsx` |
| CASE-app-011 | 버스나 이벤트에 값이 생기면 카운터가 틴트를 입는다 | `app.theme` | UI | `topbar.test.tsx` |

## TestSuite: `app.rules` — 전역 규칙 (도구가 검사)

이 Suite 의 케이스는 테스트 파일이 아니라 **검사 스크립트**가 판정한다.
`npm run sweep` 이 다섯 개를 한 번에 돌린다.

| Case | 무엇 | 덮는 노드 | 계층 | 구현 |
|---|---|---|---|---|
| CASE-app-020 | 등록되지 않은 색 클래스가 없다 | `app.theme` | 도구 | `npm run sweep:tokens` |
| CASE-app-021 | 렌더러가 main/·node:* 를 임포트하지 않는다 | `app.ipc` | 도구 | `npm run sweep:imports` |
| CASE-app-022 | 웹·모바일 모듈이 서로를 임포트하지 않는다 | `app.ipc` | 도구 | `npm run sweep:imports` |
| CASE-app-023 | en/ko 메시지 키가 짝을 이룬다 | `app.i18n` | 도구 | `npm run sweep:i18n` |
| CASE-app-024 | 브리지 커버리지 임계(95%)를 지킨다 | `bridge` | 도구 | `npm run sweep:coverage` |
| CASE-app-025 | immunity 원장의 금지 패턴이 코드에 없다 | — | 도구 | `npm run sweep:ledger` |
| CASE-app-026 | 타입 검사와 lint 가 통과한다 | `app.ipc` | 도구 | `npm run typecheck && npm run lint` |

## TestSuite: `app.theme` — 시각 토큰 (부품 단위)

`sweep:tokens` 은 **등록 안 된 색 이름**을 잡지만 **눈금 밖 불투명도**는 못 잡는다.
`bg-danger/12` 는 이름이 맞아 통과하고도 Tailwind 가 아무것도 내보내지 않아 배경이
사라진다. 그 구멍을 이 Suite 가 막는다.

구현: `src/renderer/components/ui/badge.test.tsx` (11) ·
`src/renderer/lib/token-color.test.ts` (14)

| Case | 무엇 | 덮는 노드 | 계층 | 구현 |
|---|---|---|---|---|
| CASE-app-030 | 틴트 배지의 불투명도가 Tailwind 가 실제로 내보내는 눈금 위에 있다 | `app.theme` | UI | `badge.test.tsx` |
| CASE-app-031 | 틴트 배지는 워시·테두리·전강도 글자를 한 벌로 쓴다 | `app.theme` | UI | `badge.test.tsx` |
| CASE-app-032 | 중립 배지에는 틴트가 섞이지 않는다 | `app.theme` | UI | `badge.test.tsx` |
| CASE-app-033 | 토큰 문자열이 hex 로 정확히 변환된다(외부 표면용) | `app.theme` | 단위 | `token-color.test.ts` |
| CASE-app-034 | 없는 토큰은 그럴듯한 색이 아니라 눈에 띄는 회색이 된다 | `app.theme` | 단위 | `token-color.test.ts` |

## TestSuite: `app.surface` — 화면 시각 판정 (도구가 판정)

어댑터가 화면 9개 × 폼팩터 3개 × 테마 2개를 렌더해 정규화 모델을 뽑고, 판정기가 그 모델만
보고 판정한다. 실행: `node .harness/steward/project/impl/surface-verify.mjs`.
판정기의 규칙 자체는 단위 테스트가 지킨다: `tests/unit/surface-checks.test.ts` (25개).

| Case | 무엇 | 덮는 노드 | 계층 | 구현 |
|---|---|---|---|---|
| CASE-app-040 | 본문 텍스트 대비가 4.5:1, 큰 텍스트가 3:1 이상이다 (기준선 대비 새 위반 0) | `app.theme` | 도구 | 어댑터 + 판정기 |
| CASE-app-041 | 상호작용 요소가 서로를 가리지 않는다 (중첩은 겹침이 아니다) | `app.shell` | 도구 | 어댑터 + 판정기 |
| CASE-app-042 | 핵심 내용이 잘려 사라지지 않는다 | `app.shell` | 도구 | 어댑터 + 판정기 |
| CASE-app-043 | 내용이 가로로 판을 넘치지 않는다 (세로 스크롤은 결함이 아니다) | `app.shell` | 도구 | 어댑터 + 판정기 |
| CASE-app-044 | 화면을 그리는 동안 렌더러 콘솔 에러가 없다 | `app.shell` | 도구 | 어댑터 + 판정기 |
| CASE-app-045 | 포인터 표적이 최소 크기(24점) 이상이다 | `app.shell` | 도구 | 어댑터 + 판정기 |
| CASE-app-046 | 대비 계산이 WCAG 2.2 상대휘도 공식과 일치한다 | — | 단위 | `tests/unit/surface-checks.test.ts` |
| CASE-app-047 | 기준선에 있는 findings 는 차단이 아니라 관찰로 내려간다 | — | 단위 | `tests/unit/surface-checks.test.ts` |
| CASE-app-048 | 렌더 실패·빈 기록은 통과가 아니라 cannot-verify 다 | — | 단위 | `tests/unit/surface-checks.test.ts` |
| CASE-app-049 | UI 파일을 건드린 커밋은 최신 검증 기록을 요구한다 | — | 도구 | steward `surface-gate` 훅 |
