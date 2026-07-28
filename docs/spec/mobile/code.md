# `mobile.code` — 스크립트 (모바일)

라우트 `/mobile/code` · 컨테이너 `page-mobile-code` · 사이드바 `nav-mobile-code`

편집기 껍데기는 `web.code` 와 **같은 부품**이다. Section 정의(트리·끌어다 옮기기·편집기·
실행)는 `../web/code.md` 를 정본으로 쓰고, 여기서는 모바일만의 차이와 인수조건을 적는다.
`web.code.*` 의 각 인수조건은 이 화면에도 그대로 적용된다(폴더와 실행 드라이버만 바뀐다).

## 차이

| 항목 | 모바일 |
|---|---|
| 폴더 | `scripts/mobile/**` |
| 씨앗 파일 | `verify-otp.ts` |
| 준비 조건 | 사용할 연결 구성이 있고 세션을 쓸 수 있는 상태 |
| 스크립트에 주어지는 것 | `driver`(WebdriverIO) · `env` · `bus` · `log()` |
| 실행 채널 | `MOBILE_RUN_SCRIPT` (`source` + 구성 식별자) |

## `mobile.code.readiness` — 준비 상태 표시

- `AC-mobile.code.readiness-01` 사용중 구성이 없으면 그 사실을 표시하고 준비되지 않은
  상태로 보인다.
- `AC-mobile.code.readiness-02` 사용중 구성이 있으면 그 이름을 표시한다.

## 데이터·채널

`MOBILE_SCRIPTS_LIST` · `MOBILE_SCRIPTS_READ` · `MOBILE_SCRIPTS_SAVE` ·
`MOBILE_SCRIPTS_DELETE` · `MOBILE_SCRIPTS_MKDIR` · `MOBILE_SCRIPTS_MOVE` ·
`MOBILE_RUN_SCRIPT`

## 알려진 한계

- 실물 드라이버 모드에서는 세션이 없으면 실행이 실패한다. 그 세션을 만드는 경로가 아직
  없다 — `mobile/README.md` 의 `connection-to-session-gap` 을 본다.
