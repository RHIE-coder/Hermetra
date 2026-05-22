# electron-e2e-smoke

> Playwright + `_electron`을 이용한 Electron E2E smoke 인프라 구축 +
> 8개 사이드바 항목 네비게이션 검증. 사용자 데이터는 tmp 디렉터리에 격리,
> mock 드라이버만 사용, globalSetup으로 build 자동화. CI 통합은 별도 PR.

## Goal

Electron 앱이 정상 부팅되고 8개 주요 페이지(Web Browser / Web Scripts /
Mobile Devices / Mobile Scripts / Bridge Scenarios / Bridge Bus / Bridge
Events / Bridge Variables)로 안정적으로 네비게이션됨을 자동 검증한다.

## Scope

- `playwright.config.ts` 확장: globalSetup, 실패 아티팩트 (screenshot + video + trace)
- `tests/e2e/setup/global-setup.ts` 신설: `npm run build` 실행
- `tests/e2e/fixtures/electron.ts` 신설: tmp userData + mock drivers env 헬퍼
- `tests/e2e/smoke.spec.ts` 신설: 부팅 + 사이드바 + 8개 네비게이션 검증
- `src/renderer/components/layout/sidebar.tsx`에 `data-testid` 8개 추가
  - `nav-web-remote`, `nav-web-code`
  - `nav-mobile-devices`, `nav-mobile-code`
  - `nav-bridge-scenarios`, `nav-bridge-bus`, `nav-bridge-events`, `nav-bridge-variables`
- 페이지 컨테이너 식별을 위해 각 페이지 root에 `data-testid="page-<slug>"` 추가

## Non-scope (explicit)

- GitHub Actions / CI workflow 통합 (별도 PR)
- Linux / Windows runner 동작 검증 (macOS만 1차 타겟)
- 실제 Playwright/Appium 드라이버 사용 (mock 강제)
- 특정 기능 흐름 (script 작성/실행, scenario 실행 등 — 본 PR은 네비게이션만)
- 시각 회귀 (visual regression) 비교
- 다국어 텍스트 검증 (data-testid가 locale-독립이므로 텍스트 매칭 불필요)

## Acceptance criteria

각 항목은 테스트로 검증 가능해야 함.

- [ ] `npm run test:e2e`가 globalSetup으로 `npm run build`를 한 번만 실행한다
- [ ] Electron 앱이 `out/main/index.js`에서 launch되어 main window가 뜬다
- [ ] 사이드바가 보이고 8개 nav 항목이 `data-testid`로 식별된다
- [ ] 각 8개 항목 클릭 시 해당 페이지 컨테이너(`data-testid="page-<slug>"`)가 화면에 표시된다
- [ ] 각 테스트의 userData가 `os.tmpdir()` 아래 고유 디렉터리에 격리된다 (사용자의 `~/Library/Application Support/Hermetra/`는 건드리지 않음)
- [ ] `HERMETRA_DRIVERS=mock`이 launch env에 설정되어 real Playwright/Appium 의존성 없이 동작
- [ ] 테스트 실패 시 screenshot + video + trace가 `test-results/`에 보존된다
- [ ] 모든 테스트 종료 후 tmp userData 디렉터리가 cleanup된다

## Affected layers (CLAUDE.md §3.1)

- Pure logic: 없음
- DB schema: 없음
- IPC handler: 없음
- UI component: 변경 있음 — `sidebar.tsx`에 `data-testid` 8개, 8개 페이지 컨테이너 root에 `data-testid` 1개씩 추가 (시각 변경 0)
- E2E: 신설 — `tests/e2e/smoke.spec.ts` + `setup/global-setup.ts` + `fixtures/electron.ts`

## Data model changes

- 없음

## IPC contract changes

- 없음

## i18n

- 없음

## UI flow

UI 동작 변경 없음. `data-testid` attribute만 추가되므로 사용자에게 보이는 것은 동일.

States to handle:
- Empty: 해당 없음 (네비게이션 자체는 데이터 의존 없음)
- Loading: 페이지 마운트 시 초기 로딩 상태도 `data-testid="page-*"`는 노출되어야 함 (skeleton 또는 페이지 자체)
- Error: globalSetup 실패 시 → playwright가 즉시 fail (재시도 없음)

## Error handling

- `npm run build` 실패: globalSetup이 non-zero exit → playwright가 early fail. 사용자에게는 build 에러 메시지 그대로 표시.
- Electron launch 실패 (out 파일 없음 / timeout): 60s timeout 후 fail, trace 저장
- tmp dir 생성 실패: test 자체 fail, 다른 테스트 영향 없음
- mock driver가 어떤 이유로 disable되어 real driver를 요구하면: 테스트 환경엔 real이 없으므로 graceful skip — 단 본 smoke는 driver를 호출하지 않으므로 해당 없음

## Performance / security notes

- globalSetup의 build는 세션 1회 (테스트 파일별 X). electron-vite 캐시로 incremental.
- screenshot/video는 `only-on-failure`/`retain-on-failure`로 디스크 부담 제어
- tmp userData는 `mkdtempSync(path.join(os.tmpdir(), 'hermetra-e2e-'))` → 권한·격리 OS 보장
- afterAll에서 `fs.rmSync(..., { recursive: true, force: true })`로 정리
- `--user-data-dir` Electron 내장 플래그 사용 → 프로덕션 코드 수정 0

## Workspace / multi-tenancy

각 테스트가 고유한 userData 경로 → 완전 격리. 사용자의 실제 워크스페이스 데이터 영향 0.
`workspaceManager`가 처음 init 시 시드 workspace 1개 자동 생성하므로 테스트는 깨끗한 상태에서 시작.

## Driver compatibility

- Real driver: 본 smoke는 호출 안 함
- Mock driver: `HERMETRA_DRIVERS=mock` 환경변수로 강제. 모든 driver 인스턴스가 mock으로 wire됨.

## Open notes for /sprint

- **testwriter**: smoke.spec.ts를 `test.describe.serial`로 구성 (앱 launch는 한 번, 8개 nav를 순차 검증). 8개 항목은 `[{ id, expectedPageTestId }]` 배열로 돌려서 한 번에 검증하면 spec 라인 수 절약.
- **implementer**:
  - `sidebar.tsx`에 `data-testid` 추가는 attribute만 — 시각 변경 0
  - 페이지 root `data-testid` 추가 위치는 각 page tsx의 최상위 div
  - playwright.config.ts의 `globalSetup` 경로는 ts 파일이라 `ts-node`/`tsx` 필요할 수 있음 — 안 되면 .mjs로 작성
- **auditor**:
  - CLAUDE.md §3.4 "real Electron, real renderer, **mock drivers only**" 준수 확인
  - sidebar 변경이 디자인 토큰 위반 안 만들었는지 (attribute만 추가하니 안전하지만 design-token-guard 훅이 자동 검증)
  - `data-testid` 외 다른 변경이 sneak-in 됐는지 diff 확인
  - 실제로 `npm run test:e2e` 1회 통과 확인 (인프라 PR의 본질)

---

**Status:** active
**Created:** 2026-05-22
**Slug:** electron-e2e-smoke
