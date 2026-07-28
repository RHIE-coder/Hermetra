# `bridge.variables` — 변수

라우트 `/bridge/variables` · 컨테이너 `page-bridge-variables` ·
사이드바 `nav-bridge-variables`

스크립트가 `env` 로 읽는 값을 프로파일 단위로 관리한다. 웹과 모바일이 **같은 문서**를
쓰기 때문에 한 프로파일이 양쪽 실행을 모두 몰 수 있다.

## 데이터 규칙 (도메인)

문서 하나는 `{ 프로파일[], 공유 변수(프로파일별), 개인 변수(프로파일별) }` 이다.

**저장 위치를 두 파일로 가르는 것이 이 화면의 핵심 정책이다.**

| 파일 | 들어가는 것 |
|---|---|
| `<workspaceDir>/variables.json` | 프로파일 목록 · 공유 변수의 키와 값 · **개인 변수의 키만** |
| `<workspaceDir>/variables.private.json` | 개인 변수의 **값만** (`{ 프로파일: { 키: 값 } }`) |

이유: 공유 변수는 팀이 저장소에 올려 함께 쓰고, 토큰처럼 올라가면 안 되는 값은 개인
파일에만 남긴다. 공유 파일만 커밋하면 팀원은 "무슨 키가 필요한지"는 알고 "그 값"은
모르는 상태로 시작한다.

- 공유 파일이 없으면 씨앗 문서로 시작한다: 프로파일 `default`·`staging`, 공유 변수
  `BASE_URL`·`ORDER_ID`, 개인 변수 키 `AUTH_TOKEN`.
- 공유 파일이 깨져 있으면 씨앗으로 떨어진다. 개인 파일이 깨져 있으면 그 파일만 무시하고
  키는 유지한다(앱은 죽지 않는다).
- 읽을 때 개인 파일의 값을 개인 변수 항목에 채워 넣는다. 값이 없는 키는 값 없이 남는다.

인수조건:

- `AC-bridge.variables-01` 저장하면 공유 파일에는 개인 변수의 값이 들어가지 않는다.
- `AC-bridge.variables-02` 저장 후 다시 읽으면 개인 변수의 값이 복원된다.
- `AC-bridge.variables-03` 개인 파일이 깨져 있어도 로드가 성공하고 키가 보인다.
- `AC-bridge.variables-04` 공유 파일이 없으면 씨앗 프로파일 두 개로 시작한다.

## `bridge.variables.profiles` — 프로파일

- `AC-bridge.variables.profiles-01` 프로파일을 고르면 아래 두 표가 그 프로파일의 값으로
  바뀐다.
- `AC-bridge.variables.profiles-02` 이름을 넣고 추가하면 프로파일이 늘고 빈 변수 표로
  시작한다. 이름이 비어 있으면 추가하지 않는다.
- `AC-bridge.variables.profiles-03` 각 프로파일은 공유·개인 변수 개수를 함께 보인다.

## `bridge.variables.shared` — 공유 변수

키-값 표. 추가·삭제·수정.

- `AC-bridge.variables.shared-01` 추가하면 표에 행이 생기고 저장 시 공유 파일에 값까지
  들어간다.
- `AC-bridge.variables.shared-02` 비어 있으면 빈 상태 문구를 보인다.

## `bridge.variables.private` — 개인 변수

키-값 표이되 값은 가려 보인다.

- `AC-bridge.variables.private-01` 값은 기본적으로 가려진 상태로 표시된다.
- `AC-bridge.variables.private-02` 복사를 누르면 값이 클립보드로 가고 복사됨 표시가 뜬다.
- `AC-bridge.variables.private-03` 저장하면 값은 개인 파일에만 쓰인다.

## 데이터·채널

`VARS_LOAD` · `VARS_SAVE`

## 알려진 한계

- 프로파일 삭제·이름 변경 UI 가 없다.
- 개인 변수 값은 평문 파일이다. 암호화하지 않는다 — 저장소에 올리지 않는 것이 방어선이다.
- 어느 프로파일이 실행에 쓰이는지 고르는 곳이 이 화면에는 없다.
