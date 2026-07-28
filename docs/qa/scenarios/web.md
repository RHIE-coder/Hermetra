# TestScenario: 웹 자동화 (`web`)

사람이 브라우저를 켜고, 탭을 몰고, 스크립트를 돌리는 길.
덮는 정본: `docs/spec/web/*`

## TestSuite: `web.remote` — 브라우저 화면

| Case | 무엇 | 덮는 노드 | 계층 | 구현 |
|---|---|---|---|---|
| CASE-web-001 | 서버가 멈춘 상태에서 상태 뱃지가 대기로 보인다 | `web.remote.header` | UI | 미구현 |
| CASE-web-002 | 시작하면 상태 뱃지·엔드포인트가 실행 중으로 바뀐다 | `web.remote.server` | UI | 미구현 |
| CASE-web-003 | 브라우저가 설치 안 됐으면 서버 시작이 비활성이다 | `web.remote.install` | UI | 미구현 |
| CASE-web-004 | 설치 진행 로그가 브로드캐스트로 누적된다 | `web.remote.install` | UI | 미구현 |
| CASE-web-005 | 포트 입력이 숫자가 아니면 9222로 시작한다 | `web.remote.server` | UI | 미구현 |
| CASE-web-006 | 실행 중일 때만 주소 입력·새 탭이 활성이다 | `web.remote.server` | UI | 미구현 |
| CASE-web-007 | 탭 라디오를 누르면 그 탭이 활성이 된다 | `web.remote.server` | UI | 미구현 |
| CASE-web-008 | 탭 삭제가 목록에서 사라지게 한다 | `web.remote.server` | UI | 미구현 |
| CASE-web-009 | 주소만 넣고 저장하면 주소가 북마크 이름이 된다 | `web.remote.bookmarks` | UI | 미구현 |
| CASE-web-010 | 북마크 저장·삭제가 store.json 에 반영된다 | `web.remote.bookmarks` | API | 미구현 |
| CASE-web-011 | 같은 id 로 북마크를 저장하면 덮어쓴다 | `web.remote.bookmarks` | API | 미구현 |
| CASE-web-012 | 서버가 멈춰 있으면 북마크 열기가 비활성이다 | `web.remote.bookmarks` | UI | 미구현 |

> 이 Suite 는 통째로 미구현이다 — `coverage-gaps.md` 의 `gap-web-remote` 를 본다.

## TestSuite: `web.code` — 스크립트 화면

편집기 껍데기는 모바일과 공유하므로 이 Suite 가 양쪽을 대표한다
(`src/renderer/modules/shared/CodeEditor.test.tsx`, 13개).

| Case | 무엇 | 덮는 노드 | 계층 | 구현 |
|---|---|---|---|---|
| CASE-web-020 | 트리가 폴더 먼저·경로 순으로 정렬된다 | `web.code.tree` | API | `tests/api/scripts.test.ts` |
| CASE-web-021 | 빈 폴더에 씨앗 파일이 생긴다 | `web.code.tree` | API | `tests/api/scripts.test.ts` |
| CASE-web-022 | 스크립트 확장자만 파일로 취급한다 | `web.code.tree` | API | `tests/api/scripts.test.ts` |
| CASE-web-023 | 없는 경로를 읽으면 빈 내용이 온다 | `web.code.tree` | API | `tests/api/scripts.test.ts` |
| CASE-web-024 | 폴더 삭제는 하위까지 지운다 | `web.code.tree` | API | `tests/api/scripts.test.ts` |
| CASE-web-025 | 워크스페이스 밖 경로는 거부된다 | `web.code.tree` | API | `tests/api/script-move.test.ts` |
| CASE-web-026 | 파일을 폴더로 옮긴다 | `web.code.tree.dnd` | API | `tests/api/script-move.test.ts` |
| CASE-web-027 | 폴더를 루트로 옮긴다 | `web.code.tree.dnd` | API | `tests/api/script-move.test.ts` |
| CASE-web-028 | 여러 개를 한 배치로 옮긴다 | `web.code.tree.dnd` | API | `tests/api/script-move.test.ts` |
| CASE-web-029 | 충돌이 하나라도 있으면 배치 전체를 취소한다 | `web.code.tree.dnd` | API | `tests/api/script-move.test.ts` |
| CASE-web-030 | 폴더를 자기 자손으로 옮기는 것은 막힌다 | `web.code.tree.dnd` | API | `tests/api/script-move.test.ts` |
| CASE-web-031 | 같은 자리로 옮기는 것은 무시된다 | `web.code.tree.dnd` | API | `tests/api/script-move.test.ts` |
| CASE-web-032 | 새로 만들기 메뉴가 같은 버튼에서 토글된다 | `web.code.tree` | UI | `src/renderer/modules/shared/CodeEditor.test.tsx` |
| CASE-web-033 | 다른 버튼을 누르면 메뉴가 그 위치로 옮겨간다 | `web.code.tree` | UI | `src/renderer/modules/shared/CodeEditor.test.tsx` |
| CASE-web-034 | 메뉴 밖 누르면 닫히고, 안의 항목 클릭은 밖으로 안 친다 | `web.code.tree` | UI | `src/renderer/modules/shared/CodeEditor.test.tsx` |
| CASE-web-035 | 끌어 옮기기의 시각 상태(흐림·자동 펼침)가 동작한다 | `web.code.tree.dnd` | UI | `src/renderer/modules/shared/CodeEditor.test.tsx` |
| CASE-web-036 | 충돌 오류가 화면에 목록으로 보인다 | `web.code.tree.dnd` | UI | `src/renderer/modules/shared/CodeEditor.test.tsx` |
| CASE-web-037 | 저장하지 않은 변경이 표시된다 | `web.code.editor` | UI | `src/renderer/modules/shared/CodeEditor.test.tsx` |
| CASE-web-038 | 실행 중 실행 버튼이 비활성이고 출력이 쌓인다 | `web.code.run` | UI | `src/renderer/modules/shared/CodeEditor.test.tsx` |
| CASE-web-039 | 브라우저 준비 여부가 준비/대기로 표시된다 | `web.code.run` | UI | `src/renderer/modules/shared/CodeEditor.test.tsx` |
