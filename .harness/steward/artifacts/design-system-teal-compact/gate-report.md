---
phase: gate
status: ready
inputs: [surface-verify]
---

# gate 리포트 — design-system-teal-compact

기준 커밋 `8239e53` (검사 시점 HEAD) · main · 2026-07-29

유저 요청: "현대적이고 시인성 좋고 입체감에 세련된 디자인". 시안 비교를 거쳐
**유리면 · 밀집 · 청록**(위 광원 그림자 · 높은 밀도 · 청록 신호색)으로 확정하고 구현했다.
회차 기록 정본: `docs/qa/runs/2026-07-29-design-system-teal-compact.md`.

## 전체 검사

| 검사 | 명령 (config 값·능력) | 결과 |
|---|---|---|
| 타입·lint | `typecheck_command` = `npm run typecheck && npm run lint` | PASS |
| 테스트 | `test_command` = `npm run test` | PASS (28파일 / 276개 — 신규 28개) |
| 빌드 | `build_command` = `npm run build` | PASS |
| E2E | `e2e-runner` = `npm run test:e2e` | PASS (11개) |
| 드리프트 검사 | `token-guard` = `npm run sweep` | PASS (tokens · imports · i18n · ledger · coverage 5/5) |
| 화면 시각 판정 | `surface-verify` (= `contrast-check`) | 캡처 54건 · 차단 0 · 관찰 12 |
| 하네스 계약 | `node .harness/steward/core/validate.mjs` | 0 error · 경고 1 (`surface-verify` orphan 바인딩 — 이전 회차와 동일, 이번 변경이 낸 것 아님) |

미바인딩·건너뜀: **없음.**

## 눈으로 한 검증

기계 판정과 별개로 빌드된 Electron 앱을 띄워 실제 화면을 봤다(mock 드라이버):
브라우저 · 시나리오 · 디바이스 · 공유 버스 · 인스펙터 · 웹 스크립트, 밝음·어두움 두 테마.

기계가 못 잡고 눈이 잡은 것 하나: 틴트 배지의 배경이 통째로 사라져 있었다.
`bg-danger/12` 의 `/12` 가 Tailwind 불투명도 눈금에 없어 클래스가 버려졌고, 토큰 이름은
맞아서 `sweep:tokens` 도 통과했다. `badge.test.tsx` (CASE-app-030) 로 못박았다.

## 시각 위반 237건 → 12건

사라진 225건만 기준선에서 뺐다. **새로 추가된 항목은 0건이고 전체를 다시 생성하지
않았다.** 남은 12건은 Monaco 가 키 입력을 받으려고 두는 화면 밖 textarea(높이 20px)다.

## drift 판정

| 변경 | 걸리는 정본 노드 | 처리 |
|---|---|---|
| `global.css` · `tailwind.config.ts` 토큰 전면 교체 | `app.theme` | `AC-app.theme-01`·`02` 보강, `04`~`09` 신설 (방향·그림자 역할·색 배분·의미색 독립·틴트 대비·전역 포커스·서체 내재화) |
| 공용 부품 5개(card·badge·button·input·tabs) 밀도·깊이 교체 | `app.theme` | 같은 노드. 화면 문구·동작 불변 |
| Button 의 web/mobile/bridge 변종 삭제, 호출부 9곳 기본 변종으로 | `app.theme` | `AC-app.theme-05` 로 규칙화. 버튼의 **색만** 바뀌고 동작·문구는 그대로 |
| 페이지 배경 `gradient-*` 제거 · 여백 축소 (화면 8개) | `app.theme` | 같은 노드. 배치는 안 바꿨다 |
| 상단 카운터가 비었을 때 중립 배지 | `app.shell.topbar` · `app.theme` | CASE-app-010·011 신설 (`topbar.test.tsx`) |
| `lib/token-color.ts` · `lib/editor-theme.ts` 신설, Monaco 테마 교체 | `app.theme` | `AC-app.theme-01` 에 "외부 표면은 토큰을 읽어 변환" 명시. CASE-app-033·034 |
| 배지 틴트 규약(`/15` 워시 + `/25` 테두리 + 전강도 글자) | `app.theme` | `app.theme` Suite 신설 (CASE-app-030~032) |
| 서체 4개 번들 + Google Fonts `<link>`·CSP 호스트 제거 | `app.theme` | `AC-app.theme-09` 신설. 알려진 한계에 "편집기 엔진은 아직 CDN" 추가 |
| `surface-baseline.json` 237 → 12 | `app.theme` 알려진 한계 | `gap-visual-baseline` 을 12건으로 갱신하고 이력을 적음 |
| `.claude/immunity/ledger.md` 정규식에서 맨 `sidebar` 제거 | — | 규칙의 의도(등록 안 된 이름 금지)는 유지. 하위 이름은 계속 차단. 사유를 원장 항목 안에 적었다 |

**명시**: 사용자에게 보이는 **문구는 한 글자도 바뀌지 않았다**(i18n 검사 PASS).
동작이 바뀐 곳은 상단 카운터 배지의 색 하나뿐이고, 그것은 정본에 케이스로 올렸다.
화면 배치(카드 구성·아래쪽 빈 공간)는 손대지 않았다 — 밀집형이 지금 구조를 유지하는
안이기 때문이며, 그것을 푸는 "판형" 안은 유저가 고르지 않았다.

## 판정

통과. 실패·건너뜀·미바인딩은 없다.
