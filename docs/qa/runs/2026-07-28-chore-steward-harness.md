# 2026-07-28 · chore-steward-harness

## 회차 1 — handover 전체 회귀

- 기준 커밋: `125eb47` (chore(harness): adopt steward as the canonical harness)
- 범위: 전체 (자동화 전부 + 도구 검사 전부)
- 목적: 정본(`docs/spec`·`docs/qa`)을 채운 시점의 실행 증빙

| 검사 | 명령 | 결과 |
|---|---|---|
| 타입 검사 | `npm run typecheck` | PASS |
| lint | `npm run lint` | PASS (0 error · 0 warning) |
| 단위·스키마·API·컴포넌트 | `npm run test` | PASS (24파일 / 223개) |
| 빌드 | `npm run build` | PASS (main · preload · renderer) |
| E2E (Electron, mock 드라이버) | `npm run test:e2e` | PASS (11개) |
| 드리프트 검사 | `npm run sweep` | PASS (tokens · imports · i18n · ledger · coverage 5/5) |
| 하네스 계약 | `node .harness/steward/core/validate.mjs` | PASS (0 error · 경고 1: surface-verify 미바인딩) |
| 커버리지 임계 | `npm run test:coverage` | PASS (`src/main/bridge/**` 라인·브랜치·함수·구문 100%) |

- 미실행·미바인딩:
  - `contrast-check` · `surface-verify` — 미바인딩(Electron 표면 어댑터 없음). UI 시각
    판정은 이번 회차에서 기계로 하지 않았다.
  - 실물 드라이버 경로(실제 Chromium·Appium·실기기) — 미실행. 전제는
    `../coverage-gaps.md` 의 `gap-real-driver`.
  - 정의만 있고 구현이 없는 케이스 38개 — 미실행. 목록은 `../coverage-gaps.md`.
- 실패 상세: 없음.

## 회차 1 참고 — 이 회차 직전에 고친 것

같은 브랜치의 앞선 두 커밋이 검사 도구 자체의 결함을 고쳤다. 그 전 결과와 비교할 때
주의할 것:

- `npm run lint` 는 이 브랜치 전까지 **항상 실패**했다(eslint 미설치). 그래서
  `npm run check` 도 lint 를 빼고 돌고 있었다.
- `npm run sweep` 의 coverage 검사는 glob 변환 버그로 `src/main/bridge/**/*.ts` 를
  한 번도 매칭하지 못해 **언제나 OK** 를 찍었다. 고친 뒤 실제 미달(라인 94.73% ·
  브랜치 80%)이 드러나 테스트 4개를 추가해 100% 로 올렸다.
