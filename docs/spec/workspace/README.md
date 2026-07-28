# `workspace` — 워크스페이스 Service

프로젝트별 데이터 격리 단위. 화면은 상단바의 전환기 하나뿐이지만, 이 Service 의 규칙이
다른 모든 Service 의 저장 위치를 정한다.

| Surface | ID | 위치 | 정본 |
|---|---|---|---|
| 워크스페이스 전환기 | `workspace.switcher` | 상단바 | `switcher.md` |

## 데이터 규칙 (도메인)

워크스페이스 하나는 `{ 식별자, 이름, 포트, 설명?, 만든 시각, 마지막 사용 시각? }` 이다.
목록은 **전역** 파일 `<userData>/workspaces.json` 에 `{ activeId, workspaces[] }` 로 남는다.

- 워크스페이스마다 폴더가 하나 있고, 만들 때 `scripts/web` · `scripts/mobile` 을 함께 만든다.
- 포트 기본값은 `9222` 다. 값이 없거나 0 이면 기본값으로 떨어진다.
- 이름은 공백을 제거하고, 비어 있으면 안전한 슬러그로 대체한다(최대 24자, 그마저 비면
  `workspace`).
- 목록 파일이 없거나 깨져 있으면 `default` 워크스페이스 하나를 만들어 시작한다.
- 활성 식별자가 목록에 없으면 첫 번째를 활성으로 본다.
- **마지막 하나는 삭제되지 않는다.** 삭제하면 그 폴더까지 지우고, 지운 것이 활성이었다면
  남은 첫 번째가 활성이 된다.
- 활성을 바꾸면 그 워크스페이스의 마지막 사용 시각이 갱신된다.
- 목록·활성이 바뀌면 렌더러에 통보한다(`EVT_WORKSPACE_UPDATE`).

인수조건:

- `AC-workspace-01` 워크스페이스가 하나뿐일 때 삭제하면 아무 일도 일어나지 않는다.
- `AC-workspace-02` 새로 만들면 폴더와 스크립트 하위 폴더가 생긴다.
- `AC-workspace-03` 같은 식별자로 저장하면 덮어쓰고, 새 식별자면 추가된다.
- `AC-workspace-04` 목록에 없는 식별자를 활성으로 지정하면 상태가 바뀌지 않는다.
- `AC-workspace-05` 활성을 지우면 남은 첫 번째가 활성이 된다.
- `AC-workspace-06` 목록 파일이 깨져 있어도 앱이 뜨고 기본 워크스페이스가 생긴다.

## 데이터·채널

`WORKSPACE_LIST` · `WORKSPACE_SAVE` · `WORKSPACE_DELETE` · `WORKSPACE_SET_ACTIVE` ·
통보 `EVT_WORKSPACE_UPDATE`

## 폴더 구조

```
<userData>/
  workspaces.json          목록 + 활성 식별자
  devices.json             내 디바이스 (전역)
  workspaces/<id>/
    store.json             북마크 · 시나리오 · 연결 구성 · 사용중 구성
    variables.json         프로파일 · 공유 변수 · 개인 변수의 키
    variables.private.json 개인 변수의 값
    scripts/web/**         웹 스크립트
    scripts/mobile/**      모바일 스크립트
```
