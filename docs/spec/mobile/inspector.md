# `mobile.inspector` — 인스펙터

라우트 `/mobile/inspector` · 컨테이너 `page-mobile-inspector` ·
사이드바 `nav-mobile-inspector`

기기 화면을 캡처해 놓고, 그 화면의 요소 트리를 나란히 보며 선택자를 찾는 화면.
스크립트를 쓰기 전에 "무엇을 어떻게 집을지"를 정하는 자리다.

## `mobile.inspector.actions` — 액션 줄

| 버튼 | testid |
|---|---|
| 세션 시작 / 중지 | `inspector-btn-start-session` · `inspector-btn-stop-session` |
| 스크린샷 | `inspector-btn-screenshot` |
| 녹화 시작 / 중지 | `inspector-btn-start-record` · `inspector-btn-stop-record` |
| 요소 추출 | `inspector-btn-extract` |

- `AC-mobile.inspector.actions-01` 사용중 연결 구성이 없으면 세션 시작이 비활성이고
  경고 배너(`inspector-warning-banner`)가 보인다.
- `AC-mobile.inspector.actions-02` 사용중 구성이 있고 Appium 이 실행 중이면 세션 시작이
  활성이다.
- `AC-mobile.inspector.actions-03` 세션을 시작하면 상태 뱃지(`inspector-status-badge`)가
  연결됨으로 바뀐다. 실패하면 그 이유를 보이고 뱃지는 그대로다.
- `AC-mobile.inspector.actions-04` 세션이 없는 동안 스크린샷·녹화·추출은 비활성이다.
- `AC-mobile.inspector.actions-05` 녹화를 시작하면 버튼이 중지로 바뀌고, 중지하면 녹화
  결과를 보인다.
- `AC-mobile.inspector.actions-06` 화면을 벗어나면 열려 있던 세션을 자동으로 중지한다.

## `mobile.inspector.screenshot` — 화면 패널

`inspector-screenshot-canvas` · 빈 상태 `inspector-screenshot-empty` ·
강조 `inspector-overlay-highlight`

- `AC-mobile.inspector.screenshot-01` 스크린샷을 찍으면 이미지가 패널에 표시된다.
  아직 없으면 빈 상태 문구를 보인다.
- `AC-mobile.inspector.screenshot-02` 이미지 위에 마우스를 올리면 그 좌표에 해당하는
  요소의 외곽선이 강조된다.
- `AC-mobile.inspector.screenshot-03` 이미지를 클릭하면 그 요소가 선택되고 상세에 속성이
  덤프된다.

## `mobile.inspector.tree` — 요소 트리

`inspector-tree` · 탭 `inspector-tab-native` / `inspector-tab-webview` ·
웹뷰 빈 상태 `inspector-webview-empty`

- `AC-mobile.inspector.tree-01` 요소 추출을 누르면 네이티브와 웹뷰 트리를 함께 읽고
  각 탭의 개수를 갱신한다.
- `AC-mobile.inspector.tree-02` 웹뷰 컨텍스트가 없으면 웹뷰 탭은 빈 상태를 보인다
  (네이티브는 그대로 나온다).
- `AC-mobile.inspector.tree-03` 트리에서 노드를 고르면 화면 패널의 강조가 같은 요소로
  동기화된다.
- `AC-mobile.inspector.tree-04` 웹뷰를 읽은 뒤에는 컨텍스트를 네이티브로 되돌린다
  (이어지는 스크립트 실행이 네이티브를 기본으로 보게 하기 위해).

## `mobile.inspector.detail` — 요소 상세

`inspector-detail-content` · 빈 상태 `inspector-detail-empty`

- `AC-mobile.inspector.detail-01` 선택된 요소의 속성을 전부 보인다. 선택이 없으면 빈 상태
  문구를 보인다.

## 좌표·요소 모델

- 네이티브 트리는 Appium page source(XML)를 파싱한다. 위치는 Android 의 `bounds`
  속성을, 없으면 iOS 의 좌표 속성 묶음을 읽는다. 둘 다 없으면 위치는 없음으로 둔다.
- 웹뷰 트리는 웹뷰 컨텍스트의 HTML 을 파싱한다.
- 요소 식별자는 `<접두사>:<트리 위치 경로>` 형태로 안정적으로 붙는다.

## 데이터·채널

`INSPECTOR_START_SESSION` · `INSPECTOR_STOP_SESSION` · `INSPECTOR_SCREENSHOT` ·
`INSPECTOR_START_RECORD` · `INSPECTOR_STOP_RECORD` · `INSPECTOR_GET_ELEMENTS` ·
`INSPECTOR_SET_CONTEXT` · 통보 `EVT_SESSION_UPDATE`

## mock 드라이버 동작

- 화면은 더미 PNG, 트리는 작은 고정 XML/HTML 을 돌려준다. 그래서 기기 없이도 이 화면의
  모든 흐름(세션→스크린샷→추출→선택)을 끝까지 확인할 수 있다.

## 알려진 한계

- 실물 모드의 세션 시작은 이미 열린 세션을 재사용하는 no-op 이다. 사용중 연결 구성으로
  세션을 자동 시작하지 않는다 — `README.md` 의 `connection-to-session-gap` 을 본다.
- 화면 캡처는 정지 이미지다. 실시간 미러링은 없다.
- 트리 검색·필터가 없다.
