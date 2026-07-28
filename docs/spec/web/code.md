# `web.code` — 스크립트 (웹)

라우트 `/web/code` · 컨테이너 `page-web-code` · 사이드바 `nav-web-code`

Monaco 편집기로 웹 자동화 스크립트를 쓰고 그 자리에서 돌린다.
편집기 껍데기는 모바일 스크립트 화면과 **같은 부품**(`modules/shared/CodeEditor`)이고,
다루는 폴더와 실행 드라이버만 다르다. 그래서 이 문서의 Section 정의는
`mobile.code` 와 공유된다 — 차이는 각 문서의 "차이" 절에만 적는다.

## `web.code.tree` — 스크립트 트리

`<workspaceDir>/scripts/web/**` 의 파일·폴더를 계층으로 보인다. 확장자
`.ts`/`.js`/`.tsx`/`.jsx` 만 파일로 취급한다. 같은 부모 안에서 폴더가 먼저, 그다음
경로 알파벳 순으로 정렬한다.

- `AC-web.code.tree-01` 워크스페이스의 스크립트 폴더가 비어 있으면 씨앗 파일 하나를
  만들어 준다(웹은 `login.ts`).
- `AC-web.code.tree-02` 파일을 고르면 편집기에 그 내용이 열린다. 없는 경로를 고르면
  빈 내용으로 연다.
- `AC-web.code.tree-03` 새로 만들기 메뉴는 파일·폴더 두 항목을 준다. 이름을 입력받아
  만들고, 만든 뒤 트리가 갱신된다.
- `AC-web.code.tree-04` 새로 만들기 버튼을 다시 누르면 메뉴가 닫힌다(토글).
  다른 위치의 버튼을 누르면 그 위치의 메뉴로 옮겨간다.
- `AC-web.code.tree-05` 메뉴 밖을 누르면 닫힌다. 메뉴 안의 항목을 누르는 것은 밖으로
  치지 않는다.
- `AC-web.code.tree-06` 삭제는 파일이면 파일만, 폴더면 그 하위까지 지운다.
- `AC-web.code.tree-07` 트리가 비어 있으면 빈 상태 문구를 보인다.

### `web.code.tree.dnd` — 끌어다 옮기기

- `AC-web.code.tree.dnd-01` 파일을 폴더에 떨어뜨리면 그 폴더 아래로 옮겨진다.
- `AC-web.code.tree.dnd-02` 폴더를 루트에 떨어뜨리면 루트로 옮겨진다.
- `AC-web.code.tree.dnd-03` 여러 개를 고른 뒤(수식키 클릭 / 범위 클릭) 옮기면 고른 것이
  모두 옮겨진다.
- `AC-web.code.tree.dnd-04` 대상에 같은 이름이 이미 있으면 **그 배치 전체를 취소**하고
  충돌 목록을 오류로 보인다. 원본은 그대로다.
- `AC-web.code.tree.dnd-05` 폴더를 자기 자신이나 자기 자손에 떨어뜨리는 것은 막힌다.
- `AC-web.code.tree.dnd-06` 닫힌 폴더 위에 약 0.6초 머무르면 그 폴더가 펼쳐진다.
- `AC-web.code.tree.dnd-07` 끌고 있는 항목은 흐리게 보인다.
- `AC-web.code.tree.dnd-08` 옮기려는 위치가 원본과 같으면 아무 일도 하지 않는다.
- `AC-web.code.tree.dnd-09` 워크스페이스 스크립트 폴더 밖을 가리키는 경로는 거부된다.

## `web.code.editor` — 편집기

- `AC-web.code.editor-01` 저장하지 않은 변경이 있으면 그 사실을 표시한다.
- `AC-web.code.editor-02` 저장하면 파일에 쓰이고 트리가 갱신된다.
- `AC-web.code.editor-03` 새 파일을 만들면 기본 씨앗 코드가 들어 있다.

## `web.code.run` — 실행

- `AC-web.code.run-01` 브라우저 서버가 실행 중이면 준비 상태로, 아니면 대기 상태로
  표시한다.
- `AC-web.code.run-02` 실행하는 동안 실행 버튼은 비활성이다.
- `AC-web.code.run-03` 실행 결과와 `log()` 출력이 출력 패널에 순서대로 쌓인다.
- `AC-web.code.run-04` 출력이 없으면 빈 상태 문구를 보인다.

## 차이 (모바일 스크립트 화면과 비교)

| 항목 | 웹 |
|---|---|
| 폴더 | `scripts/web/**` |
| 씨앗 파일 | `login.ts` |
| 준비 조건 | 원격 브라우저 서버 실행 중 |
| 스크립트에 주어지는 것 | `page` · `env` · `bus` · `log()` |
| 실행 채널 | `WEB_RUN_SCRIPT` |

## 데이터·채널

`WEB_SCRIPTS_LIST` · `WEB_SCRIPTS_READ` · `WEB_SCRIPTS_SAVE` · `WEB_SCRIPTS_DELETE` ·
`WEB_SCRIPTS_MKDIR` · `WEB_SCRIPTS_MOVE` · `WEB_RUN_SCRIPT`

## 알려진 한계

- 편집기에 자동 완성·타입 검사가 붙어 있지 않다. Monaco 기본 문법 강조까지다.
- 실행은 스크립트 원문을 드라이버로 넘기는 방식이다. 파일 임포트는 지원하지 않는다.
