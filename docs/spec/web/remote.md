# `web.remote` — 브라우저 (원격 브라우저)

라우트 `/web/remote` · 컨테이너 `page-web-remote` · 사이드바 `nav-web-remote`

Playwright Chromium 서버를 켜고, 그 브라우저의 탭을 이 화면에서 조종한다.
자동화 스크립트가 붙는 대상이 바로 이 브라우저다.

## `web.remote.header` — 헤더

제목·설명, 스텔스 뱃지, 실행 상태 뱃지(실행 중 / 대기).

- `AC-web.remote.header-01` 서버가 실행 중이면 상태 뱃지가 실행 중으로, 아니면 대기로
  보인다. 상태는 메인의 브로드캐스트(`EVT_BROWSER_UPDATE`)로 갱신된다.

## `web.remote.driver-warning` — 드라이버 안내

- `AC-web.remote.driver-warning-01` 드라이버를 쓸 수 없으면 경고 카드가 보인다.
  이때도 화면은 정상 렌더된다.

## `web.remote.error` — 오류 배너

- `AC-web.remote.error-01` 서버 시작·조작이 실패하면 그 메시지를 배너로 보인다.
  다음 조작을 시도하면 배너는 지워진다.

## `web.remote.install` — Chromium 설치 패널

브라우저 바이너리 설치 상태와 설치 실행. 설치 상태는 **전역**이다(워크스페이스별 아님).

- `AC-web.remote.install-01` 설치되어 있으면 완료 뱃지, 아니면 없음 뱃지를 보인다.
- `AC-web.remote.install-02` 설치 실행 중에는 버튼이 비활성이고 진행 로그가 누적 표시된다
  (`EVT_BROWSER_INSTALL` 브로드캐스트).
- `AC-web.remote.install-03` 설치가 안 된 상태에서는 서버 시작 버튼이 비활성이다.
- `AC-web.remote.install-04` 예상 설치 경로가 있으면 그 경로를 보인다.

## `web.remote.server` — 서버 패널

포트 입력, 시작/중지 토글, 새로고침, 그리고 열린 탭 목록.

- `AC-web.remote.server-01` 포트 입력은 서버가 실행 중이면 비활성이다. 값이 숫자가
  아니면 `9222` 로 떨어진다.
- `AC-web.remote.server-02` 시작하면 웹소켓 엔드포인트가 표시된다.
- `AC-web.remote.server-03` 실행 중이면 3초 간격으로 탭 목록을 다시 읽는다. 중지하면
  그 폴링도 멈춘다.
- `AC-web.remote.server-04` 주소를 입력하고 엔터를 치면 활성 탭이 그 주소로 이동한다.
- `AC-web.remote.server-05` 새 탭 버튼은 입력값이 있으면 그 주소로, 없으면 빈 탭을 연다.
- `AC-web.remote.server-06` 탭 목록의 라디오를 누르면 그 탭이 활성이 되고, 활성 탭은
  시각적으로 구분된다.
- `AC-web.remote.server-07` 탭의 삭제를 누르면 그 탭이 닫히고 목록이 갱신된다.
- `AC-web.remote.server-08` 탭이 없으면 빈 상태 문구를 보인다.
- `AC-web.remote.server-09` 서버가 멈춰 있으면 주소 입력·새 탭이 비활성이다.

## `web.remote.bookmarks` — 북마크 패널

이름 + 주소로 저장하는 즐겨찾기. 워크스페이스별.

- `AC-web.remote.bookmarks-01` 주소가 비어 있으면 추가 버튼이 비활성이다.
- `AC-web.remote.bookmarks-02` 이름을 비우고 저장하면 주소가 이름으로 쓰인다.
- `AC-web.remote.bookmarks-03` 저장하면 `store.json` 의 `bookmarks[]` 에 남고 앱을 다시
  켜도 유지된다.
- `AC-web.remote.bookmarks-04` 같은 id 로 저장하면 덮어쓰고, 새 id 면 추가된다.
- `AC-web.remote.bookmarks-05` 열기 버튼은 서버가 실행 중일 때만 활성이며 그 주소로
  이동한다.
- `AC-web.remote.bookmarks-06` 삭제하면 목록과 파일에서 사라진다.
- `AC-web.remote.bookmarks-07` 북마크가 없으면 빈 상태 문구를 보인다.

## 데이터·채널

| 무엇 | 채널 |
|---|---|
| 상태·시작·중지 | `WEB_RB_STATUS` · `WEB_RB_START` · `WEB_RB_STOP` |
| 탭 | `WEB_RB_LIST_PAGES` · `WEB_RB_NAVIGATE` · `WEB_RB_NEW_TAB` · `WEB_RB_CLOSE_PAGE` · `WEB_RB_SET_ACTIVE` |
| 북마크 | `WEB_RB_LIST_BOOKMARKS` · `WEB_RB_SAVE_BOOKMARK` · `WEB_RB_REMOVE_BOOKMARK` |
| 설치 | `BROWSER_INSTALL_STATE` · `BROWSER_INSTALL_RUN` · `EVT_BROWSER_INSTALL` |
| 통보 | `EVT_BROWSER_UPDATE` |

## 알려진 한계

- 브라우저 화면을 앱 안에 그리지 않는다. 실제 창은 밖에서 뜨고, 이 화면은 조종석이다.
- 탭 목록은 폴링으로 따라간다 — 사용자가 브라우저에서 직접 탭을 열면 최대 3초 늦게 보인다.
