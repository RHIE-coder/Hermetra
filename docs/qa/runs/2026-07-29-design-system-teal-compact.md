# 2026-07-29 · design-system-teal-compact

## 회차 1 — 시각 시스템 교체 (유리면 · 밀집 · 청록)

- 기준 커밋: `8239e53` (docs: work on main, no branches)
- 범위: 시각 토큰 전체 + 공용 부품 + 셸(사이드바·상단바·타이틀바) + 코드 편집기 테마.
  화면 배치는 손대지 않았다.
- 목적: 사용자 요청("현대적·시인성·입체감·세련됨")에 맞춰 시각 시스템을 교체한 시점의
  실행 증빙

| 검사 | 명령 | 결과 |
|---|---|---|
| 타입·lint·테스트·빌드 | `npm run check` | PASS (28파일 / 276개 — 신규 28개) |
| E2E (Electron, mock 드라이버) | `npm run test:e2e` | PASS (11개) |
| 드리프트 검사 | `npm run sweep` | PASS (tokens · imports · i18n · ledger · coverage 5/5) |
| 화면 시각 판정 | `node .harness/steward/project/impl/surface-verify.mjs` | 캡처 54건(화면 9 × 폼팩터 3 × 테마 2) · 차단 0 · 관찰 12 |
| 하네스 계약 | `node .harness/steward/core/validate.mjs` | 0 error · 경고 1 (`surface-verify` orphan 바인딩 — 이전 회차와 동일) |

### 시각 위반: 237건 → 12건

기준선에서 **225건이 사라졌고 새로 생긴 것은 0건**이다. 사라진 항목만 목록에서 뺐다
(`.harness/steward/project/surface-baseline.json`). 전체를 다시 생성하지 않았다.

| 무엇이 없앴나 | 없앤 건수 |
|---|---|
| 액센트 색을 대비가 나오는 값으로 재도출 (배지·칩·경고 배너) | 대비 다수 |
| 카운터 알약을 값이 없을 때 중립으로 (1.47:1 짝) | 대비 |
| 타이틀바 제목의 `/70` 불투명도 제거 (2.79:1) | 대비 |
| 코드 편집기를 앱 토큰 기반 테마로 교체 (주석·문자열·괄호·줄번호) | 대비 74 + α |
| 탭 사이 간격 2px — 맞닿은 모서리가 소수점 오차로 겹침 판정 | 겹침 6 |

남은 12건은 코드 편집기(Monaco)가 키 입력을 받으려고 두는 보이지 않는 textarea 가
높이 20px 이라 24px 규칙에 걸리는 것이다. 사용자가 누르는 표적이 아니다 — 배경은
`../coverage-gaps.md` 의 `gap-visual-baseline`.

### 눈으로 확인한 것

기계 판정과 별개로 실제 Electron 앱을 띄워 화면을 봤다(mock 드라이버):
브라우저 · 시나리오 · 디바이스 · 공유 버스 · 웹 스크립트, 밝음·어두움 두 테마.
캡처는 `.harness/steward/artifacts/design-system-teal-compact/shots/` (추적 안 함).

이 과정에서 기계 판정이 못 잡은 결함 하나를 눈으로 잡았다: 틴트 배지의 배경이 통째로
사라져 있었다. `bg-danger/12` 의 `/12` 가 Tailwind 불투명도 눈금에 없어 클래스가 조용히
버려진 것이다. 이름은 맞아서 `sweep:tokens` 도 통과했다. 재발 방지로
`badge.test.tsx` (CASE-app-030) 를 붙였다.

### 서체 내재화

Geist · Geist Mono 를 앱 안으로 넣었다(`src/renderer/assets/fonts/`, 가변 폰트 4개 ·
82KB). `index.html` 의 Google Fonts `<link>` 와 preconnect 를 지웠고, CSP 에서
`fonts.googleapis.com` · `fonts.gstatic.com` 을 뺐다. 실행 중인 앱에서
`document.fonts.check()` 로 두 서체가 번들에서 로드되는 것을 확인했다.

라틴 범위만 넣었다 — 두 서체에 한글이 없어 한국어는 어차피 시스템 서체로 떨어진다.

**남은 오프라인 구멍**: 편집기 엔진(Monaco) 자체는 아직 `cdn.jsdelivr.net` 에서
받아온다. 네트워크가 없으면 스크립트 두 화면의 편집기가 뜨지 않는다. CSP 가 그 호스트를
남겨 둔 이유도 이것뿐이다. 이번 작업 범위 밖이라 고치지 않았다.

### 면역 원장 변경

`design-token-fabrication` 의 정규식에서 맨 `sidebar` 를 뺐다. 이 규칙은 "등록 안 된
shadcn 기본 이름을 쓰지 마라"는 것인데, 이번에 `--sidebar` 를 `global.css` 와
`tailwind.config.ts` 에 실제로 등록했으므로 더 이상 지어낸 이름이 아니다. 하위 이름
(`sidebar-foreground` 등)은 계속 막는다. 우회가 아니라 규칙을 좁힌 것이다.

- 미실행: 실물 드라이버 경로(실제 Chromium·Appium·실기기) — 전제는
  `../coverage-gaps.md` 의 `gap-real-driver`.
- 실패 상세: 없음.
