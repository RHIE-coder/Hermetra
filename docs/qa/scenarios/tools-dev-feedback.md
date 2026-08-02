# TestScenario: 화면 피드백 도구 (`tools.dev-feedback`)

유저가 화면을 보다 이상한 곳을 가리켜 남기고, 에이전트가 그것만 읽고 어느 코드를 고칠지
아는 길. 덮는 정본: `docs/spec/tools/dev-feedback.md`

이 도구가 지켜야 할 단 하나: **유저가 남긴 것이 온전히 남아서 에이전트가 읽을 수 있는가.**
그래서 검증의 무게가 "화면에서 본 것 == 저장된 것"에 쏠려 있다 — 이 어긋남은 유저가 보내고
나서야, 그것도 대개 며칠 뒤에나 드러난다.

## TestSuite: 순수 로직 — 폴더·검증·note.md

구현: `tests/unit/dev-feedback.test.ts` (30)

| Case | 무엇 | 덮는 노드 | 계층 | 구현 |
|---|---|---|---|---|
| CASE-tools-001 | 라우트가 폴더 이름 조각이 되고 경로 구분자·상위 이동이 지워진다 | `tools.dev-feedback.note` | 단위 | `tests/unit/dev-feedback.test.ts` |
| CASE-tools-002 | 같은 분에 남긴 두 피드백이 서로 덮어쓰지 않는다(초까지 넣는다) | `tools.dev-feedback.note` | 단위 | 같은 파일 |
| CASE-tools-003 | 배지는 표시 영역 좌상단에 앉고, 조금 빗나간 탭도 집는다 | `tools.dev-feedback.mark` | 단위 | 같은 파일 |
| CASE-tools-004 | 배지가 겹치면 나중에 그린(위에 보이는) 것이 잡힌다 | `tools.dev-feedback.mark` | 단위 | 같은 파일 |
| CASE-tools-005 | 메모가 비거나 요소를 못 찾아도 표시를 버리지 않는다 | `tools.dev-feedback.note` | 단위 | 같은 파일 |
| CASE-tools-006 | 망가진 본문(객체 아님·라우트 없음·좌표 NaN·표시 0개/21개)을 거절한다 | `tools.dev-feedback.note` | 단위 | 같은 파일 |
| CASE-tools-007 | 형식이 틀린 그림은 조용히 버리지 않고 거절한다 | `tools.dev-feedback.sketch` | 단위 | 같은 파일 |
| CASE-tools-008 | `note.json` 에 그림 바이트가 아니라 파일 이름만 남는다 | `tools.dev-feedback.note` | 단위 | 같은 파일 |
| CASE-tools-009 | `note.md` 가 메모·컴포넌트 사슬·클래스·테마를 싣는다 | `tools.dev-feedback.note` | 단위 | 같은 파일 |
| CASE-tools-010 | `note.md` 가 핀을 "한 점"으로, 표시를 "영역"으로 구분해 적는다 | `tools.dev-feedback.mark` | 단위 | 같은 파일 |

## TestSuite: 그리기 기하 — 화면과 저장물이 같은 함수를 읽는다

구현: `src/renderer/components/dev-feedback/draw.test.ts` (17)

| Case | 무엇 | 덮는 노드 | 계층 | 구현 |
|---|---|---|---|---|
| CASE-tools-020 | 도형은 폴리라인 한 벌로만 정해진다(펜·직선·상자) | `tools.dev-feedback.draw` | UI | `draw.test.ts` |
| CASE-tools-021 | 화살표는 몸통과 촉이 끊긴 두 줄이고, 촉이 굵기를 따라 커진다 | `tools.dev-feedback.draw` | UI | 같은 파일 |
| CASE-tools-022 | 배지 자리는 화살촉까지 감싸고, 점이 없으면 0 크기다 | `tools.dev-feedback.draw` | UI | 같은 파일 |
| CASE-tools-023 | 지우개는 겹쳐도 더 가까운 자국을 집고, 선분 너머는 안 집는다 | `tools.dev-feedback.draw` | UI | 같은 파일 |
| CASE-tools-024 | 자국 없는 핀은 지우개 판정에서 빠진다(배지로만 잡힌다) | `tools.dev-feedback.draw` | UI | 같은 파일 |

## TestSuite: 오버레이 — 몸짓이 갈래를 가른다

구현: `src/renderer/components/dev-feedback/feedback-overlay.test.tsx` (8)

| Case | 무엇 | 덮는 노드 | 계층 | 구현 |
|---|---|---|---|---|
| CASE-tools-040 | 가장자리 손잡이로 오버레이가 열린다 | `tools.dev-feedback.mark` | UI | `feedback-overlay.test.tsx` |
| CASE-tools-041 | 빈 자리를 탭하면 표시가 1개 늘고 메모창이 열린다 | `tools.dev-feedback.mark` | UI | 같은 파일 |
| CASE-tools-042 | 배지를 탭하면 표시 수는 그대로고 그 메모가 열린다 | `tools.dev-feedback.mark` | UI | 같은 파일 |
| CASE-tools-043 | 끌면 자국이 그려지고, 너무 짧으면 핀으로 떨어진다 | `tools.dev-feedback.mark` | UI | 같은 파일 |
| CASE-tools-044 | 보낼 때 라우트·테마·표시별 항목이 채널로 나간다 | `tools.dev-feedback.note` | UI | 같은 파일 |
| CASE-tools-045 | 캡처 전에 자기 도구막대를 DOM 에서 걷는다 | `tools.dev-feedback.capture` | UI | 같은 파일 |
| CASE-tools-046 | 메인이 거절하면 표시를 지우지 않고 그대로 둔다 | `tools.dev-feedback.note` | UI | 같은 파일 |

## TestSuite: 저장 — 폴더로 떨어진다

구현: `tests/api/dev-feedback.test.ts` (6)

| Case | 무엇 | 덮는 노드 | 계층 | 구현 |
|---|---|---|---|---|
| CASE-tools-060 | `note.md` · `note.json` · `shot.png` 가 시각 폴더 아래 떨어진다 | `tools.dev-feedback.note` | API | `tests/api/dev-feedback.test.ts` |
| CASE-tools-061 | 그림이 표시 번호대로 파일이 되고 `note.md` 가 그것을 가리킨다 | `tools.dev-feedback.sketch` | API | 같은 파일 |
| CASE-tools-062 | 캡처가 실패해도 나머지 피드백은 저장된다 | `tools.dev-feedback.capture` | API | 같은 파일 |
| CASE-tools-063 | 망가진 요청은 아무것도 쓰지 않고 거절된다 | `tools.dev-feedback.note` | API | 같은 파일 |
| CASE-tools-064 | 라우트로 저장 위치를 폴더 밖으로 끌어낼 수 없다 | `tools.dev-feedback.note` | API | 같은 파일 |

## 안 덮는 것 (전제와 함께)

- **`shot.png` 의 픽셀 판정은 자동으로 안 한다.** 이미지 비교가 필요하고, 그 비교가
  깨지는 이유의 대부분은 도구가 아니라 화면 변경이다. 대신 CASE-tools-045 가 "도구막대가
  DOM 에 없다"는 선행 조건을 못박고, 실제 그림은 개발 모드 빌드로 앱을 띄워 눈으로 본다.
- **e2e 에서 안 돈다.** e2e 는 프로덕션 빌드를 띄우는데 이 도구는 거기 없다(정본의
  `AC-tools.dev-feedback-01`). 개발 모드로 강제 빌드해야만 뜨므로 정규 e2e 대상이 아니다.
