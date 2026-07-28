---
provides: ui-preview
---
# ui-preview — Hermetra 화면을 실제로 띄워 조작해 보는 절차

Hermetra 는 Electron 데스크탑 앱이다. 웹 주소로 열 수 없으니, 실제 앱을 띄워야 화면을 본다.
**정지 화면만 보고 통과시키지 않는다** — 바뀐 동작은 직접 눌러 보고, 그 결과를 본다.

## A. 에이전트가 볼 때 (기본)

1. 캡처 한 장이면 `ui-shot` 능력으로 끝낸다:
   ```bash
   node .harness/steward/project/impl/ui-shot.mjs --nav=<nav-testid> --size=1280x800
   ```
   `nav-testid` 는 사이드바 항목의 `data-testid` 다 (예: `nav-mobile-devices`,
   `nav-bridge-bus`). 목록은 `tests/e2e/smoke.spec.ts` 의 `NAV_ITEMS` 가 정본이다.
   저장 경로와 렌더러 콘솔 에러 건수가 출력된다. 종료코드 `2` 는 **cannot-verify** —
   통과로 승격 금지.

2. 조작(클릭·입력·상태 변화)까지 확인해야 하면, 임시 Playwright 스크립트를 짜서 돌린다.
   앱 실행 배선은 이미 있다 — `tests/e2e/fixtures/electron.ts` 의
   `launchHermetra()` / `closeHermetra()` 를 쓰고, 스크립트는 스크래치패드에 둔다
   (`tests/e2e/` 에 검증용 임시 스펙을 남기지 않는다).
   - 드라이버는 항상 `HERMETRA_DRIVERS=mock` — 실제 브라우저·기기 세션을 열지 않는다.
   - 유저 데이터는 `os.tmpdir()` 아래 임시 디렉터리 — 유저의 실제 워크스페이스를 건드리지 않는다.
   - 확인이 끝나 재발 방지가 필요한 흐름이면, 임시 스크립트를 버리지 말고
     `tests/e2e/*.spec.ts` 회귀 테스트로 승격한다.

3. 앱 코드를 고쳤으면 캡처 전에 `npm run build` 가 필요하다 (`ui-shot.mjs` 는 산출물이
   없거나 불완전하면 자동으로 빌드한다 — 이미 빌드돼 있으면 **다시 안 한다**. 방금 고친
   코드를 보려면 직접 `npm run build` 를 돌린 뒤 캡처하라).

## B. 유저가 직접 볼 때

```bash
npm run dev
```
개발 서버 + Electron 창이 뜬다(HMR). 실제 드라이버로 확인해야 하면
`HERMETRA_DRIVERS=real npm run dev` — Playwright 브라우저·Appium 서버가 필요하다.

## 한계 (침묵 금지)

- 테마(밝음·어두움) 전환은 이 절차가 자동으로 못 한다. 앱 내 테마 토글을 눌러 캡처를
  두 번 찍어라.
- 대비·겹침·잘림 같은 기계 판정은 아직 없다 (`contrast-check`·`surface-verify` 미바인딩).
  육안 확인에 의존하고 있다는 사실을 리뷰 산출물에 적는다.
