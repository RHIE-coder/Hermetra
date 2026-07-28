# `web` — 웹 자동화 Service

Playwright 로 Chromium 을 띄우고, 탭을 다루고, 스크립트를 돌린다.
사이드바 그룹 "웹", 액센트 토큰 `web`.

| Surface | ID | 라우트 | 정본 |
|---|---|---|---|
| 브라우저 | `web.remote` | `/web/remote` | `remote.md` |
| 스크립트 | `web.code` | `/web/code` | `code.md` |

## Service 규칙

- 브라우저 프로세스는 **한 개**다. 원격 브라우저 서버를 띄우면 그 인스턴스를 탭 조작과
  스크립트 실행이 함께 쓴다.
- 기본 포트는 `9222`. 워크스페이스마다 기본 포트를 따로 들 수 있다.
- 스크립트 파일은 `<workspaceDir>/scripts/web/**` 에만 있다. 모바일 스크립트와 폴더가
  갈려 있고 서로를 보지 못한다.
- 실행 스크립트에 주어지는 것: `page`(활성 페이지) · `env` · `bus`(공유 버스) · `log()`.
- `modules/web` 은 `modules/mobile` 을 임포트하지 않는다. 양쪽이 만나는 곳은 브리지다.

## 상태 소유

| 무엇 | 어디 |
|---|---|
| 서버 실행 여부·엔드포인트·포트 | 메인 (드라이버). 렌더러는 투영일 뿐 |
| 열린 탭 목록 | 메인 (드라이버). 실행 중이면 3초마다 재조회 |
| 북마크 | `<workspaceDir>/store.json` 의 `bookmarks[]` |
| 스크립트 파일 | `<workspaceDir>/scripts/web/**` |
