# `workspace.switcher` — 워크스페이스 전환기

상단바 좌측. 지금 어느 워크스페이스에서 일하는지 보이고, 만들고, 이름을 바꾸고,
지우고, 옮겨 다닌다. 도메인 규칙은 `README.md` 가 정본이고, 여기서는 화면 동작을 적는다.

## `workspace.switcher.trigger` — 현재 워크스페이스

- `AC-workspace.switcher.trigger-01` 활성 워크스페이스의 이름을 보인다.
- `AC-workspace.switcher.trigger-02` 누르면 목록이 펼쳐지고, 밖을 누르면 닫힌다.

## `workspace.switcher.list` — 목록

각 항목: 이름, 전환, 이름 바꾸기, 삭제.

- `AC-workspace.switcher.list-01` 항목을 누르면 그 워크스페이스로 전환되고 목록이 닫힌다.
- `AC-workspace.switcher.list-02` 전환하면 스크립트·변수·연결 구성·북마크·시나리오가 그
  워크스페이스의 것으로 다시 읽힌다. **스크립트 화면 셋(웹 코드·모바일 코드·브라우저
  작업대)이 모두 대상이다** — 하나만 빠져도 화면은 고장 나 보이지 않고 "전환이 아무 일도
  안 했다"로 보인다.
- `AC-workspace.switcher.list-02a` 편집기에 열려 있던 파일도 같이 놓는다. 파일 트리만
  다시 읽으면 떠난 워크스페이스의 파일이 새 워크스페이스의 트리 위에 열린 채 남는데,
  거기서 저장하면 남의 워크스페이스에 그 파일이 생긴다.
- `AC-workspace.switcher.list-03` 이름 바꾸기는 입력 상태로 바뀌고, 저장하면 반영되며
  취소하면 되돌아간다.
- `AC-workspace.switcher.list-04` 삭제는 확인을 받은 뒤 지운다.
- `AC-workspace.switcher.list-05` 워크스페이스가 하나뿐이면 삭제할 수 없다는 안내를 보인다.
- `AC-workspace.switcher.list-06` 목록이 비어 보일 상황이면 빈 상태 문구를 보인다
  (정상 상태에서는 최소 하나가 항상 있다).

## `workspace.switcher.create` — 새로 만들기

- `AC-workspace.switcher.create-01` 이름을 입력받아 만들고, 만든 뒤 목록에 나타난다.
- `AC-workspace.switcher.create-02` 만든 워크스페이스의 폴더와 스크립트 하위 폴더가 생긴다.

## 알려진 한계

- 확인 대화상자가 브라우저 기본 `confirm` 이다. 앱 안의 대화상자로 통일되어 있지 않다.
- 워크스페이스 복제·내보내기·가져오기가 없다.
- 삭제는 폴더째 지운다. 되돌릴 수 없고 휴지통으로도 가지 않는다.
