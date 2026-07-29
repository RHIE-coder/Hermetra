# `app` — Application 계층 (앱 셸과 전역 규칙)

모든 Service 위에 걸리는 정본이다. 개별 화면은 각 Service 폴더에 있다.

## `app.shell` — 앱 셸

창은 좌측 사이드바 + 상단바 + 본문 한 장으로 고정이다. 라우팅은
`react-router-dom` 의 해시 없는 경로이며, 알 수 없는 경로는 `/` 로 되돌린다.

### `app.shell.sidebar` — 사이드바

폭 고정. 브랜드 마크 + 태그라인, 그룹 3개, 하단 푸터.

| 그룹 | 액센트 | 항목 (라우트 / testid) |
|---|---|---|
| 웹 | `web` | 브라우저 `/web/remote` `nav-web-remote` · 스크립트 `/web/code` `nav-web-code` |
| 모바일 | `mobile` | 디바이스 `/mobile/devices` `nav-mobile-devices` · 스크립트 `/mobile/code` `nav-mobile-code` · 인스펙터 `/mobile/inspector` `nav-mobile-inspector` |
| 설정 | `bridge` | 시나리오 `/bridge/scenarios` · 변수 `/bridge/variables` · 공유 버스 `/bridge/bus` · 이벤트 `/bridge/events` |

인수조건:

- `AC-app.shell.sidebar-01` 항목 9개가 항상 렌더된다. 각 항목의 `data-testid` 는 위 표와
  일치한다(e2e 가 이 ID로 화면을 찾는다).
- `AC-app.shell.sidebar-02` 항목을 누르면 그 라우트로 이동하고 해당 페이지의
  `page-*` 컨테이너가 보인다.
- `AC-app.shell.sidebar-03` 현재 라우트의 항목은 활성 상태로 구분된다.

### `app.shell.topbar` — 상단바

좌측에 워크스페이스 전환기(→ `workspace.switcher`), 우측에 상태 표시와 전환 컨트롤.

| 부품 | 내용 |
|---|---|
| 웹 상태 뱃지 | 원격 브라우저 실행 여부 |
| 모바일 상태 뱃지 | Appium/세션 실행 여부 |
| 버스·이벤트 카운터 | 공유 버스 항목 수 · 이벤트 이력 수 |
| 언어 전환 | EN / KO |
| 테마 전환 | 밝음 / 어두움 / 시스템 |

인수조건:

- `AC-app.shell.topbar-01` 공유 버스에 값을 쓰면 카운터가 증가한다(브로드캐스트
  `EVT_BUS_UPDATE` 로 즉시).
- `AC-app.shell.topbar-02` 언어를 바꾸면 화면의 모든 문자열이 그 언어로 바뀌고,
  다시 열어도 유지된다.
- `AC-app.shell.topbar-03` 테마를 바꾸면 즉시 반영되고, 시스템을 고르면 OS 설정을 따른다.

## 전역 규칙 (모든 Service 가 지킨다)

### `app.i18n` — 언어

- 지원 언어는 `en`·`ko` 둘뿐이다. 사용자에게 보이는 문자열은 예외 없이
  `src/renderer/lib/messages.ts` 의 두 언어 키로 존재한다.
- `AC-app.i18n-01` 한쪽 언어에만 있는 키는 타입 검사에서 실패한다.
- `AC-app.i18n-02` 컴포넌트에 한국어·영어 문자열 리터럴을 직접 쓰지 않는다.

### `app.theme` — 시각 토큰

**방향: 유리면 · 밀집 (glass edge, compact).** 광원은 항상 위 하나다. 떠 있는 면은
위쪽 안쪽 1px 하이라이트와 아래로 번지는 그림자를 함께 갖는다. 바탕은 흰색이 아니다 —
바탕이 면보다 어두워야 흰 면이 떠 보인다. 밀도는 높은 쪽으로 잡는다(컨트롤 32px,
카드 여백 16px, 모서리 10px).

- `AC-app.theme-01` 색·반경·그림자는 CSS 변수 토큰만 쓴다. 컴포넌트에 raw hex/rgb 가
  없다. 토큰을 못 받는 외부 표면(코드 편집기)은 `lib/token-color.ts` 로 토큰을 읽어
  변환해 넘긴다 — 값을 복사해 두지 않는다.
- `AC-app.theme-02` `tailwind.config.ts` 에 등록되지 않은 색 클래스를 쓰지 않는다
  (등록 안 된 클래스는 조용히 사라져 투명하게 렌더된다). 불투명도도 같다 —
  Tailwind 눈금(5의 배수)에 없는 `bg-x/12` 같은 값은 배경이 통째로 사라진다.
- `AC-app.theme-03` 화면을 고친 뒤에는 기계 판정(`surface-verify`)에서 **기준선 대비 새
  위반이 0** 이다 — 대비·겹침·잘림·가로 넘침·렌더 에러·표적 크기. 판정은 밝음·어두움 두
  테마와 좁음·중간·넓음 세 폼팩터 전부에서 돈다.
- `AC-app.theme-04` 그림자는 크기가 아니라 **역할**이다: `shadow-sm` 컨트롤이 면 위에,
  `shadow` 면이 바탕 위에, `shadow-md` 화면당 하나뿐인 주 패널, `shadow-lg` 실제로 떠
  있는 것(메뉴·대화상자), `shadow-inner` 면에 파인 자리(입력칸·목록).
- `AC-app.theme-05` 색은 세 곳에만 쓴다 — 주 행동 버튼, 상태 신호(위험·성공·대기),
  사이드바의 영역 표시. **카드에는 액센트 색을 입히지 않는다.** 버튼에 영역별
  액센트 변종을 두지 않는다(주 행동이 화면마다 하나여야 하므로).
- `AC-app.theme-06` 의미색(위험·성공·경고)은 팔레트를 따라가지 않는다. 팔레트마다
  경고색이 달라지면 그것은 더 이상 신호가 아니다.
- `AC-app.theme-07` 영역 표시색(`web`·`mobile`·`bridge`)과 의미색은 **자기 15% 틴트
  위에서** 4.5:1 을 넘는다. 기준 배경은 흰 카드가 아니라 바탕(field)이다 — 배지는 카드
  밖에도 놓인다.
- `AC-app.theme-08` 키보드 포커스는 `:focus-visible` 로 전역에 한 번만 정의한다.
  컴포넌트마다 포커스 링을 다시 선언하지 않는다.
- `AC-app.theme-09` 서체는 앱에 들어 있다. 화면을 그리려고 바깥 호스트에 붙지 않는다 —
  네트워크가 없어도 의도한 서체로 뜬다. 파일과 출처는
  `src/renderer/assets/fonts/README.md`.

### `app.tenancy` — 워크스페이스 격리

- `AC-app.tenancy-01` 워크스페이스 데이터를 읽고 쓰는 모든 경로는
  `workspaceManager().activeDir()` 아래다.
- `AC-app.tenancy-02` 전역 데이터는 브라우저 설치 상태와 내 디바이스뿐이다.
- `AC-app.tenancy-03` 워크스페이스를 전환하면 스크립트·변수·연결 구성·북마크·시나리오가
  그 워크스페이스의 것으로 갈린다.

### `app.drivers` — 드라이버 모드

- `AC-app.drivers-01` 환경변수가 없으면 mock 드라이버로 뜨고, 앱의 모든 화면이 도구
  설치 없이 동작한다.
- `AC-app.drivers-02` `HERMETRA_DRIVERS=real` 일 때만 Playwright·Appium 실물을 쓴다.
- `AC-app.drivers-03` 실물 드라이버가 없으면 해당 화면이 안내를 보이고, 죽지 않는다.

### `app.ipc` — IPC 계약

- `AC-app.ipc-01` 렌더러는 `node:*` 또는 `main/` 을 임포트하지 않는다.
- `AC-app.ipc-02` 채널 문자열은 `src/shared/ipc/channels.ts` 에만 존재한다.
- `AC-app.ipc-03` 모든 채널은 입력·출력 타입이 계약에 박혀 있다.

## 알려진 한계

- 창 크기·위치 기억, 자동 업데이트, 다중 창은 없다.
- 사용자 인증·권한 개념이 없다. 앱은 단일 로컬 사용자를 가정한다.
- **코드 편집기 엔진은 실행할 때 CDN(`cdn.jsdelivr.net`)에서 받아온다.** 네트워크가
  없으면 웹 스크립트·모바일 스크립트 두 화면의 편집기가 뜨지 않는다. 서체는 2026-07-29 에
  앱 안으로 넣었지만 편집기는 아직이다. CSP 가 그 호스트를 열어 두는 이유도 이것뿐이다.
- **시각 위반 1종(폼팩터·테마 조합 12건)이 기준선에 얹혀 있다** — 코드 편집기가 입력을
  받으려고 두는 보이지 않는 textarea 가 20px 라 표적 크기 규칙에 걸린다. 사용자가 누르는
  표적이 아니지만 어댑터는 DOM 만 보므로 걸러지지 않는다. 새 위반은 커밋이 막히지만 이
  항목은 통과된다. 배경은 `../qa/coverage-gaps.md` 의 `gap-visual-baseline`.
- 기계 판정은 그 폼팩터에서 **실제로 보이는 것**만 본다. 접힌 선 아래 내용과 내부
  스크롤러(편집기) 안쪽은 이 검증에 안 들어온다.
