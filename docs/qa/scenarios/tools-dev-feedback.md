# TestScenario: 화면 피드백 도구 (`tools.dev-feedback`)

유저가 화면을 보다 이상한 곳을 가리켜 남기고, 에이전트가 그것만 읽고 어느 코드를 고칠지
아는 길. 덮는 정본: `docs/spec/tools/dev-feedback.md`

이 도구가 지켜야 할 단 하나: **유저가 남긴 것이 온전히 남아서 에이전트가 읽을 수 있는가.**
그래서 검증의 무게가 "화면에서 본 것 == 저장된 것"과 "조용히 잃지 않는가"에 쏠려 있다 —
둘 다 유저가 보내고 나서야, 그것도 대개 며칠 뒤에나 드러난다.

## TestSuite: 순수 로직 — 폴더·검증·note.md

구현: `tests/unit/dev-feedback.test.ts` (44)

| Case | 무엇 | 덮는 노드 | 계층 | 구현 |
|---|---|---|---|---|
| CASE-tools-001 | 라우트가 폴더 이름 조각이 되고 경로 구분자·상위 이동이 지워진다 | `tools.dev-feedback.note` | 단위 | `tests/unit/dev-feedback.test.ts` |
| CASE-tools-002 | 같은 분에 남긴 두 피드백이 서로 덮어쓰지 않는다(초까지 넣는다) | `tools.dev-feedback.note` | 단위 | 같은 파일 |
| CASE-tools-003 | 배지는 표시 영역 좌상단에 앉고, 조금 빗나간 탭도 집는다 | `tools.dev-feedback.mark` | 단위 | 같은 파일 |
| CASE-tools-004 | 배지가 겹치면 나중에 그린(위에 보이는) 것이 잡힌다 | `tools.dev-feedback.mark` | 단위 | 같은 파일 |
| CASE-tools-005 | 메모가 비거나 요소를 못 찾아도 표시를 버리지 않는다 | `tools.dev-feedback.note` | 단위 | 같은 파일 |
| CASE-tools-006 | 망가진 본문(객체 아님·화면 없음·좌표 NaN·묶음 0개/21개)을 거절한다 | `tools.dev-feedback.note` | 단위 | 같은 파일 |
| CASE-tools-007 | 형식이 틀린 그림은 조용히 버리지 않고 거절한다 | `tools.dev-feedback.sketch` | 단위 | 같은 파일 |
| CASE-tools-008 | `note.json` 에 그림 바이트가 아니라 파일 이름만 남는다 | `tools.dev-feedback.note` | 단위 | 같은 파일 |
| CASE-tools-009 | `note.md` 가 메모·컴포넌트 사슬·클래스·테마를 싣는다 | `tools.dev-feedback.note` | 단위 | 같은 파일 |
| CASE-tools-010 | `note.md` 가 핀을 "한 점"으로, 표시를 "영역"으로 구분해 적는다 | `tools.dev-feedback.mark` | 단위 | 같은 파일 |
| CASE-tools-011 | 초안 이름은 `_draft-` 로 갈리고, 우리가 지은 모양만 받는다 | `tools.dev-feedback.draft` | 단위 | 같은 파일 |
| CASE-tools-012 | 그림 이름이 쌓을 땐 뜬 순서, 끝낼 땐 흐름 순서다 | `tools.dev-feedback.draft` | 단위 | 같은 파일 |
| CASE-tools-013 | 그림 파일 이름은 본문에서 받지 않고 서버가 짓는다 | `tools.dev-feedback.note` | 단위 | 같은 파일 |
| CASE-tools-014 | 묶음에 표시가 여럿이면 제목 하나 아래 표시별 요소가 실린다 | `tools.dev-feedback.group` | 단위 | 같은 파일 |
| CASE-tools-015 | 표시 하나짜리 묶음은 예전처럼 평평하게 적힌다 | `tools.dev-feedback.group` | 단위 | 같은 파일 |
| CASE-tools-016 | 화면이 둘 이상이면 흐름 절이 맨 앞에 서고 표시마다 단계 꼬리표가 붙는다 | `tools.dev-feedback.flow` | 단위 | 같은 파일 |
| CASE-tools-017 | 화면 하나뿐이면 흐름 절도 단계 꼬리표도 안 붙는다 | `tools.dev-feedback.flow` | 단위 | 같은 파일 |
| CASE-tools-018 | 화면을 걸친 묶음이 그 사실을 `note.md` 에 밝힌다 | `tools.dev-feedback.flow` | 단위 | 같은 파일 |
| CASE-tools-019 | 배지 판정이 표시가 실제로 든 화면 필드를 본다 | `tools.dev-feedback.flow` | 단위 | 같은 파일 |

## TestSuite: 묶음·흐름 다루기 — 조용히 잃지 않는가

구현: `src/renderer/components/dev-feedback/group.test.ts` (17)

| Case | 무엇 | 덮는 노드 | 계층 | 구현 |
|---|---|---|---|---|
| CASE-tools-030 | 메모창이 열린 묶음에 새 표시가 붙는다 | `tools.dev-feedback.group` | UI | `group.test.ts` |
| CASE-tools-031 | 표시 하나를 지워도 메모는 남고, 마지막 하나면 묶음째 사라진다 | `tools.dev-feedback.group` | UI | 같은 파일 |
| CASE-tools-032 | 묶을 때 메모를 이어 붙이고, 버린 그림 수를 돌려준다 | `tools.dev-feedback.group` | UI | 같은 파일 |
| CASE-tools-033 | 묶을 때 맨 앞 묶음의 자리를 지켜 배지 번호가 안 밀린다 | `tools.dev-feedback.group` | UI | 같은 파일 |
| CASE-tools-034 | 풀면 메모·그림은 맨 앞 표시만 물려받는다(베껴 나누지 않는다) | `tools.dev-feedback.group` | UI | 같은 파일 |
| CASE-tools-035 | 지금 화면의 표시만 골라 주고, 걸친 화면 수를 센다 | `tools.dev-feedback.flow` | UI | 같은 파일 |
| CASE-tools-036 | 화면을 옮겨도 표시는 안 건드리고, 끝에서는 아무 일도 안 한다 | `tools.dev-feedback.flow` | UI | 같은 파일 |
| CASE-tools-037 | 화면을 빼면 그 화면 표시도 같이 가고, 남은 화면 번호는 그대로다 | `tools.dev-feedback.flow` | UI | 같은 파일 |

## TestSuite: 그리기 기하 — 화면과 저장물이 같은 함수를 읽는다

구현: `src/renderer/components/dev-feedback/draw.test.ts` (22)

| Case | 무엇 | 덮는 노드 | 계층 | 구현 |
|---|---|---|---|---|
| CASE-tools-020 | 도형은 폴리라인 한 벌로만 정해진다(펜·직선·상자) | `tools.dev-feedback.draw` | UI | `draw.test.ts` |
| CASE-tools-021 | 화살표는 몸통과 촉이 끊긴 두 줄이고, 촉이 굵기를 따라 커진다 | `tools.dev-feedback.draw` | UI | 같은 파일 |
| CASE-tools-022 | 배지 자리는 화살촉까지 감싸고, 점이 없으면 0 크기다 | `tools.dev-feedback.draw` | UI | 같은 파일 |
| CASE-tools-023 | 지우개는 겹쳐도 더 가까운 자국을 집고, 선분 너머는 안 집는다 | `tools.dev-feedback.draw` | UI | 같은 파일 |
| CASE-tools-024 | 화면 위 지우개는 묶음이 아니라 표시 하나를 집는다 | `tools.dev-feedback.group` | UI | 같은 파일 |
| CASE-tools-025 | 자국 없는 핀은 배지 원으로 잡히고, 지난 화면 것은 안 잡힌다 | `tools.dev-feedback.flow` | UI | 같은 파일 |

## TestSuite: 오버레이 — 몸짓이 갈래를 가르고, 메모창이 묶는다

구현: `src/renderer/components/dev-feedback/feedback-overlay.test.tsx` (19)

| Case | 무엇 | 덮는 노드 | 계층 | 구현 |
|---|---|---|---|---|
| CASE-tools-040 | 가장자리 손잡이로 오버레이가 열린다 | `tools.dev-feedback.mark` | UI | `feedback-overlay.test.tsx` |
| CASE-tools-041 | 빈 자리를 탭하면 표시가 1개 늘고 메모창이 열린다 | `tools.dev-feedback.mark` | UI | 같은 파일 |
| CASE-tools-042 | 배지를 탭하면 표시 수는 그대로고 그 메모가 열린다 | `tools.dev-feedback.mark` | UI | 같은 파일 |
| CASE-tools-043 | 끌면 자국이 그려지고, 너무 짧으면 핀으로 떨어진다 | `tools.dev-feedback.mark` | UI | 같은 파일 |
| CASE-tools-044 | 메모창이 열린 채 그린 것들이 한 묶음이 되고 배지가 전부 ① 이다 | `tools.dev-feedback.group` | UI | 같은 파일 |
| CASE-tools-045 | 메모창을 닫으면 그 다음 자국부터 새 묶음이다 | `tools.dev-feedback.group` | UI | 같은 파일 |
| CASE-tools-046 | 되돌리기가 자국 하나만 걷고 메모는 남긴다 | `tools.dev-feedback.group` | UI | 같은 파일 |
| CASE-tools-047 | 풀면 표시마다 따로 서고 메모는 맨 앞이 물려받는다 | `tools.dev-feedback.group` | UI | 같은 파일 |
| CASE-tools-048 | "다음 화면"이 화면을 굳히고 오버레이를 접는다(버리지 않는다) | `tools.dev-feedback.flow` | UI | 같은 파일 |
| CASE-tools-049 | 다음 화면에 지난 화면 자국이 안 그려진다 | `tools.dev-feedback.flow` | UI | 같은 파일 |
| CASE-tools-050 | 화면을 걸친 묶음이 두 화면에서 같은 번호를 단다 | `tools.dev-feedback.flow` | UI | 같은 파일 |
| CASE-tools-056 | 다른 화면에서 묶음을 열면 안내가 번호를 밝히고, 그리면 메모창에 자리를 내준다 | `tools.dev-feedback.flow` | UI | 같은 파일 |
| CASE-tools-051 | 보낼 때 흐름 순서와 표시별 단계가 채널로 나간다 | `tools.dev-feedback.flow` | UI | 같은 파일 |
| CASE-tools-052 | 아무것도 안 그린 지금 화면은 흐름 끝에 안 붙는다 | `tools.dev-feedback.flow` | UI | 같은 파일 |
| CASE-tools-053 | 닫으면 쌓아 둔 초안을 지운다 | `tools.dev-feedback.draft` | UI | 같은 파일 |
| CASE-tools-054 | 캡처 전에 자기 도구막대를 DOM 에서 걷는다 | `tools.dev-feedback.capture` | UI | 같은 파일 |
| CASE-tools-055 | 저장이 실패해도 쌓아 둔 화면과 표시가 살아 다시 보낼 수 있다 | `tools.dev-feedback.draft` | UI | 같은 파일 |

## TestSuite: 저장 — 초안으로 쌓고 폴더로 끝낸다

구현: `tests/api/dev-feedback.test.ts` (15)

| Case | 무엇 | 덮는 노드 | 계층 | 구현 |
|---|---|---|---|---|
| CASE-tools-060 | 첫 화면이 초안 폴더를 만들고 뜬 순서로 그림을 쌓는다 | `tools.dev-feedback.draft` | API | `tests/api/dev-feedback.test.ts` |
| CASE-tools-061 | 그림이 묶음 번호대로 파일이 되고 `note.md` 가 그것을 가리킨다 | `tools.dev-feedback.sketch` | API | 같은 파일 |
| CASE-tools-062 | 캡처가 실패해도 그 화면과 나머지 피드백은 저장된다 | `tools.dev-feedback.capture` | API | 같은 파일 |
| CASE-tools-063 | 망가진 요청은 초안을 그대로 두고 거절된다 | `tools.dev-feedback.draft` | API | 같은 파일 |
| CASE-tools-064 | 초안 이름·라우트로 저장 위치를 폴더 밖으로 끌어낼 수 없다 | `tools.dev-feedback.note` | API | 같은 파일 |
| CASE-tools-065 | 끝낼 때 그림이 흐름 순서로 다시 이름 지어지고 `screen-*` 는 안 남는다 | `tools.dev-feedback.draft` | API | 같은 파일 |
| CASE-tools-066 | 그림 한 장이 없어져도 나머지를 저장하고 없는 척하지 않는다 | `tools.dev-feedback.capture` | API | 같은 파일 |
| CASE-tools-067 | 하루 지난 초안을 치운다 | `tools.dev-feedback.draft` | API | 같은 파일 |
| CASE-tools-068 | 닫기는 초안 폴더만 지우고, 최종 폴더는 못 지운다 | `tools.dev-feedback.draft` | API | 같은 파일 |

## 안 덮는 것 (전제와 함께)

- **`shot-N.png` 의 픽셀 판정은 자동으로 안 한다.** 이미지 비교가 필요하고, 그 비교가
  깨지는 이유의 대부분은 도구가 아니라 화면 변경이다. 대신 CASE-tools-054 가 "도구막대가
  DOM 에 없다"는 선행 조건을 못박고, 실제 그림은 개발 모드 빌드로 앱을 띄워 눈으로 본다.
- **새로고침 이어받기(`sessionStorage`)는 단위로 안 덮는다.** 실제 새로고침을 일으켜야
  뜻이 있는데, 이 도구는 개발 모드 빌드에서만 뜨므로 e2e 대상이 아니다. 대신 이어받기는
  모양을 확인하고 못 읽으면 새로 시작한다 — 실패해도 지금 작업을 깨뜨리지 않는 자리다.
- **e2e 에서 안 돈다.** e2e 는 프로덕션 빌드를 띄우는데 이 도구는 거기 없다(정본의
  `AC-tools.dev-feedback-01`). 개발 모드로 강제 빌드해야만 뜨므로 정규 e2e 대상이 아니다.
