---
phase: gate
status: ready
inputs: [handover-inventory, handover-report]
---

# gate 리포트 — chore-steward-harness

기준 커밋 `125eb47` (검사 시점 HEAD) · 브랜치 `chore/steward-harness` · 2026-07-28

handover 단계가 전체 회귀를 돌렸고, 그 결과를 이 관문 리포트로 정리한다.
회차 기록 정본: `docs/qa/runs/2026-07-28-chore-steward-harness.md`.

## 전체 검사

| 검사 | 명령 (config 값·능력) | 결과 |
|---|---|---|
| 타입·lint | `typecheck_command` = `npm run typecheck && npm run lint` | PASS |
| 테스트 | `test_command` = `npm run test` | PASS (24파일 / 223개) |
| 빌드 | `build_command` = `npm run build` | PASS |
| E2E | `e2e-runner` = `npm run test:e2e` | PASS (11개) |
| 드리프트 검사 | `token-guard` = `npm run sweep` | PASS (5/5) |
| 하네스 계약 | `node .harness/steward/core/validate.mjs` | PASS (0 error) |

미바인딩(건너뜀을 명시):

- `contrast-check` — Electron 렌더러용 대비 추출 어댑터 없음.
- `surface-verify` — Electron(browser 프로파일) 표면 어댑터 없음. UI 시각 판정을
  기계로 하지 않았다. `cannot-verify` 이며 통과로 승격하지 않는다.

`ui-shot` 은 바인딩되어 있고 이번 작업에서 실제로 두 화면(`bridge.bus` ·
`mobile.inspector`)을 캡처해 동작을 확인했다. 캡처물은 gitignore 대상(로컬 증거)이다.

## drift 판정

이번 변경이 건드린 코드와 정본을 대조했다.

| 변경 | 걸리는 정본 노드 | 처리 |
|---|---|---|
| `tests/unit/orchestrator.test.ts` (+4 케이스) | `bridge.scenarios` | 정본에 인수조건으로 반영 (AC-bridge.scenarios-05·06·07 + CASE-bridge-044~047) |
| `src/main/drivers/mobile/inspector-parser.ts` (죽은 초기 대입 제거) | `mobile.inspector.tree` | 동작 변화 없음. 좌표 파싱 규칙은 정본에 기술됨 |
| `src/renderer/modules/bridge/pages/ScenariosPage.tsx` (memo) | `bridge.scenarios.steps` | 동작 변화 없음 |
| `src/renderer/modules/mobile/store.ts` 등 (`useConnection` → `setConnectionInUse`) | `mobile.devices.connection.in-use` | 내부 식별자 개명. IPC 채널(`mobile.conn.use`)·UI 문구 불변이므로 정본 표현 변화 없음 |
| `src/main/drivers/mobile/index.ts` (`cause` 부착) | 없음 | 명세 영향 없음 |
| `eslint.config.js` · `package.json` · `.claude/**` · `.harness/**` | `app.ipc`(정적 검사) | 정본 §4 NPM 스크립트·`app.rules` Suite 에 반영 |
| `docs/spec/**` · `docs/qa/**` | 전 노드 | 이번 작업의 산출물 자체 |

**명시**: 위 코드 변경 중 사용자에게 보이는 동작을 바꾼 것은 없다. 새로 생긴 요구도 없다.
정본에 새로 적힌 것은 "이미 그렇게 동작하던 것" 이다.

미커버 영역에 대한 침묵 금지 항목: `connection-to-session-gap` 은 명세감 있는 동작인데
구현이 없다. 노드를 신설해 **미구현으로 명시**했고 유저 결정을 기다린다
(`handover-report.md` 참고).

## 판정

통과. 실패·건너뜀·미바인딩을 위에 전부 적었다.

---

# 추가 검사 — surface-verify 어댑터 도입 (기준 커밋 `eaf7540`)

같은 작업의 이어지는 증분. 위에서 "미바인딩" 으로 적었던 두 능력이 이제 바인딩됐다.

| 검사 | 명령 | 결과 |
|---|---|---|
| 타입·lint·테스트·빌드 | `npm run check` | PASS (25파일 / 248개) |
| E2E | `npm run test:e2e` | PASS (11개) |
| 드리프트 검사 | `npm run sweep` | PASS (5/5) |
| 화면 시각 판정 | `surface-verify` (= `contrast-check`) | 캡처 54건 · 차단 0 · 관찰 237 |
| UI 관문 훅 | steward `surface-gate` | 양방향 확인 (낡은 기록 차단 · 최신 기록 통과) |
| 하네스 계약 | `validate.mjs` | PASS (0 error) |

미바인딩: **없음.**

## drift 판정 (증분)

| 변경 | 걸리는 정본 노드 | 처리 |
|---|---|---|
| `impl/surface-checks.mjs` · `impl/surface-verify.mjs` 신설 | `app.theme` · `app.shell` | `AC-app.theme-03` 신설, `app.rules` 옆에 `app.surface` Suite(케이스 10개) 신설 |
| `tests/unit/surface-checks.test.ts` (25개) | — | 판정기 규칙을 못박는 단위 테스트. `app.surface` Suite 에 대응 |
| `config.yaml` 바인딩 2개 + `ui_globs` | — | CLAUDE.md §7 값·능력 표와 UI 게이트 절에 반영 |
| `surface-baseline.json` (237건) | `app.theme` 알려진 한계 | `gap-visual-baseline` 으로 등록, 우선순위까지 적음 |
| `.gitignore` (기록·캡처 제외) | — | 명세 영향 없음 |

**명시**: 이 증분은 제품 동작을 바꾸지 않았다. 화면 코드는 한 줄도 고치지 않았고,
기존 시각 위반은 고치지 않고 **기준선으로 드러냈다** — 고치는 것은 디자인 결정이라
유저에게 남긴다.

판정: 통과.
