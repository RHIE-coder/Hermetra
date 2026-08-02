# 2026-08-02 · dev-feedback-tool

## 회차 1 — Rhaumos 의 개발용 화면 피드백 도구 이식

- 기준 커밋: `52fd60e` (feat(ui): fold web / mobile / bridge into one collapsible Legacy card)
- 범위: 공유 순수 로직 1 · 메인 서비스 1 · IPC 채널 1 · 렌더러 컴포넌트 6 · 문구 키 33건(en/ko) ·
  테스트 3파일(단위 30 · 그리기 17 · API 6 · UI 8) · 정본 2곳 · 작업 규약 2곳.
- 계기: 유저 요청 — 이웃 프로젝트(`~/Workspace/Rhaumos`)에 있는 개발용 피드백 기능을
  "그대로 활용"할 수 있게 붙인다.

### 그대로 가져온 것

몸짓 규칙(탭=핀 · 끌기=표시 · 배지 탭=메모 다시 열기, 6px 로 가름), 그리기 5종과
폴리라인 한 벌 표현, 자국 단위 지우개, 스케치판, 산출물 네 가지(`note.md` · `shot.png` ·
`note.json` · `sketch-N.png`), 초 단위 폴더 이름, 라우트 슬러그의 경로 탈출 차단.

### 이식하며 바꾼 것 (셋)

1. **캡처를 `webContents.capturePage()` 로 바꿨다.** 원본의 `html-to-image` 는 브라우저가
   자기 자신을 못 찍어서 쓰는 우회로이고, Electron 에는 그 제약이 없다. 우회로의 대가
   (복제본이 스크롤·sticky 를 안 물려받아 어긋남 · 12초 타임아웃과 저화질 재시도)가 통째로
   사라지고, "화면에서 본 것 == 저장된 것"이 구현이 아니라 정의가 된다. 대신 오버레이가
   **찍히기 전에 자기 도구막대를 걷고 다시 그려질 때까지 기다린다**(`afterPaint`) —
   실제 창을 찍으므로 DOM 에서 치우는 것만으로는 부족하다. `html-to-image` 의존성은
   추가하지 않았다.
2. **HTTP 라우트를 IPC 채널로 바꿨다** (`dev:feedback:save`). 저장은 메인의
   `services/devFeedback.ts` 가 하고, 패키징된 앱에서는 핸들러가 **등록되지 않는다**
   (원본의 프로덕션 404 와 같은 취지).
3. **페이로드에서 `scroll` 과 `userAgent` 를 빼고 `theme` 을 넣었다.** 창이 하나이고
   앱 셸이 스크롤되지 않아 앞의 둘은 늘 같은 값이다. 반대로 이 앱의 대비 문제는 테마별로
   갈리므로, 테마 없는 스크린샷은 읽는 사람을 `global.css` 의 반대쪽 절반으로 보낸다.

문구는 하드코딩하지 않고 `messages.ts` 의 en/ko 키로 옮겼다(`devFeedback.*` 33건).
공용 UI 부품(`components/ui`)은 원본의 규칙 그대로 쓰지 않는다 — 화면이 깨졌을 때 필요한
도구가 그 화면의 부품 위에 서 있으면 같이 죽는다. 그리기 색만 raw hex 다(SVG·PNG 에 그대로
구워지는 값이고 테마가 깨져도 살아야 한다). 정본에 근거를 적었다.

### 검사

| 검사 | 명령 | 결과 |
|---|---|---|
| 타입·lint | `npm run typecheck && npm run lint` | PASS |
| 테스트 | `npm run test` | PASS (32파일 / 348개 — 61개 추가) |
| 빌드 | `npm run build` | PASS |
| E2E | `npm run test:e2e` | PASS (12개, 추가 없음) |
| 드리프트 검사 | `npm run sweep` | PASS 5/5 |
| 화면 시각 판정 | `surface-verify` | **미실행 — 대상 아님** |

`surface-verify` 를 안 돌린 이유: 이 도구는 개발 빌드에만 존재한다. 표면 어댑터는 빌드된
(프로덕션) 앱을 띄우므로 오버레이가 아예 렌더되지 않아 판정할 화면이 없다. 프로덕션 번들에
`feedback-overlay` 청크가 없고 `dev-feedback` / `FeedbackOverlay` / `hermetra-feedback`
문자열이 하나도 안 남는 것으로 확인했다(남는 것은 `CHANNELS` 레지스트리의 채널 이름 하나뿐).

### 눈으로 확인한 것 (실제 앱 조작)

개발 모드로 강제 빌드(`renderer.define: import.meta.env.DEV=true`, 검증 후 되돌림)한 뒤
Playwright 로 실제 Electron 창을 몰았다. 시나리오 화면(1320×880 · 밝음 · 한국어):

- 오른쪽 가장자리 손잡이를 누르면 오버레이가 열린다.
- 사이드바 `공유 버스` 행을 탭 → 핀 ① 이 서고 메모창이 열린다. `note.md` 가 잡아낸 것:
  `<a>` · `nav-bridge-bus` · 보이던 글자 "공유 버스" · 컴포넌트 `Link ‹ NavLink ‹ Sidebar ‹
  AppShell ‹ App`.
- 본문 위를 끌어 자국 ② → `Badge ‹ CardContent ‹ Card ‹ ScenariosPage` 를 잡는다.
- ② 에 스케치를 그려 붙이면 배지 어깨에 초록 점이 서고 `sketch-2.png` 로 저장된다.
- 보내기 → `.harness/feedback/20260802-222906-bridge-scenarios/` 에
  `note.md` · `note.json` · `shot.png` · `sketch-2.png`. **`shot.png` 에 표시는 있고
  도구막대·메모창은 없다.** 렌더러 콘솔 에러 0건.

확인에 쓴 폴더는 지웠다. 첫 조작 결과를 보고 요소 사슬의 꼬리에 붙던 react-router 내부
이름 `Location` 을 잡음 목록에 더했다.
