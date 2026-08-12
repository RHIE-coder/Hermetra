# 게이트 기록 — 2026-08-12 · studio-split

브라우저 작업대를 `pipeline` 에서 떼어 `studio` Service 로 옮긴다. 화면 피드백
(`/pipeline/jobs` 전체를 가리키며 "Jobs 서비스와 어울리지 않는다")에서 시작했다.

| 슬롯 | 값 |
|---|---|
| 스펙 | `docs/spec/studio/README.md`, `docs/spec/studio/browser.md`, `docs/spec/pipeline/jobs.md`, `application.md` |
| 인수조건 | `AC-app.shell.sidebar-01` / `-04` 갱신, `-06` 불변 |

## 왜

파이프라인 여섯은 **순서가 곧 제품**인데(`AC-app.shell.sidebar-06`) 작업대는 어느 단계도
아니다. 여섯 안에 있는 동안 레일이 그것을 단계라고 말하고 있었고, 그러는 사이 `작업` 이라는
이름이 약속하는 것 — 무엇이 언제 돌았나 — 은 아무 화면도 지키지 않았다.

나간 것은 **작업대**이고 `작업` 은 남는다. 여섯의 순서는 손대지 않았다.

## 무엇이 움직였나

| | 전 | 후 |
|---|---|---|
| 라우트 | `/pipeline/jobs` | `/studio/browser` |
| testid | `nav-pipeline-jobs` / `page-pipeline-jobs` | `nav-studio-browser` / `page-studio-browser` |
| 화면 testid | `pipeline-browser-bar` · `pipeline-url` · `pipeline-tabs` … | `studio-*` |
| 렌더러 | `modules/pipeline/{store,pages/JobsPage}` | `modules/studio/{store,pages/BrowserPage}` |
| IPC 채널 | `pipeline:sidecar:*` · `pipeline:session:*` · `pipeline:scripts:*` · `evt:pipeline:*` | `studio:*` · `evt:studio:*` |
| 공유 타입 | `types/pipeline.ts`, `PipelineSessionStatus`, `PipelineLogLine` | `types/studio.ts`, `StudioSessionStatus`, `StudioLogLine` |
| 메인 서비스 | `pipelineSession.ts(.connect)` | `studioSession.ts(.connect)` |
| 스크립트 슬롯 | `'pipeline'` → `<ws>/scripts/pipeline/` | `'studio'` → `<ws>/scripts/studio/` |
| 사이드바 | 서랍 2개 · 항목 15 | 서랍 3개 · 항목 16 |

`작업` 은 `PipelinePlaceholder` 로 돌아갔다 — 나머지 다섯과 같은 상태다.

## 디스크 데이터 — 슬롯 이름은 폴더 이름이었다

슬롯은 사람이 쓴 파일이 든 디렉터리다. 코드에서만 이름을 바꾸면 그들의 스크립트가 아무도 읽지
않는 이름 뒤로 숨고, `seedIfEmpty` 가 빈 새 폴더에 시드를 떨군다 — "내 스크립트가 사라졌다"로
읽힌다. 그래서 `migrateLegacySlot` 이 폴더째 옮긴다.

테스트 4개로 고정했다 (`tests/api/scripts.test.ts`): 하위 폴더까지 옮겨지는가 · 옛 이름이
남지 않는가 · 옮긴 파일 위에 시드가 덮이지 않는가 · 두 폴더가 다 있으면 새 쪽이 이기는가.

## 게이트

| 명령 | 결과 |
|---|---|
| `npm run check` | PASS — 43 files, 601 tests |
| `npm run test:e2e` | PASS — 20 passed (`nav-studio-browser` 포함) |
| `npm run sweep` | PASS — tokens·imports·i18n·ledger·coverage 5/5 |
| `surface-verify` | 캡처 96건 · **차단 0** · 관찰 18 (hit-target, 기준선) |

눈으로 확인: `shots/studio-browser-1440x900.png`(스튜디오 서랍 + 작업대),
`shots/pipeline-jobs-1440x900.png`(작업이 플레이스홀더로 복귀, 여섯 순서 유지).

## 같이 들어간 것 — 입력창과 탭의 구분 (①)

같은 피드백의 첫 항목. 활성 탭이 `bg-muted` + `shadow-inner` 를 쓰고 있었는데, 그 조합은
`Input` 이 "여기 타이핑한다"에 예약해 둔 서명이다("An input is a well carved into its panel").
주소창 두 줄 아래에서 같은 옷을 입고 있으니 둘이 같은 물건으로 보였다. 주소창은 지구본을 얻고,
탭은 우물을 내주고 `bg-secondary` + 점 표식을 쓴다. 불변식은
`BrowserPage.test.tsx` 가 직접 잡는다(주소창에 `shadow-inner` 있음, 선택된 탭에 없음).

## 남는 것

- 탭 목록은 **브라우저를 켜야 렌더된다.** 스크린샷으로는 못 봤고 컴포넌트 테스트로만 확인했다.
- `작업` 화면의 내용(실행 목록)은 이번 범위가 아니다. 저장 위치·보관 기간부터 정해야 한다 —
  `docs/spec/pipeline/jobs.md` 에 적어 두었다.
- 워크스페이스를 여러 개 쓰는 경우, 슬롯 마이그레이션은 **그 워크스페이스를 열 때** 일어난다.
  한 번에 전부 옮기지 않는다.
