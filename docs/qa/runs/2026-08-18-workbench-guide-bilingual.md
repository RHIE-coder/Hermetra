# 게이트 기록 — 2026-08-18 · workbench-guide-bilingual

작업대 가이드를 언어마다 한 파일로 갈랐다. 요구는 한 줄이었다: "자동으로 생겨나는
GUIDE.md 를 GUIDE_ko.md, GUIDE_en.md 이렇게 2개로."

| 슬롯 | 값 |
|---|---|
| 대상 | `src/main/services/scripts.ts` · `src/main/sidecar/host/runner.ts` · `modules/shared/MarkdownView.tsx`(주석) · `modules/shared/CodeEditor.tsx`(주석) |
| 인수조건 | `AC-studio.browser-39`·`-40`(신규) · `AC-studio.browser-15`(개정) · `AC-studio.browser-32`·`-33`(문구 갱신) |
| 스펙 | `docs/spec/studio/browser.md` · `docs/spec/web/code.md` |
| 테스트 | `tests/api/scripts.test.ts` (43 → 44) · `tests/unit/studio-runner.test.ts` (21 → 19) |
| 새 의존성 | 없음 |

같은 작업에서 두 번째 요구가 붙었다: 가이드가 설명하던 `extract`/`transform` 약속을 **기능째로
지운다.** 아래 2절.

## 무엇을 바꿨나

가이드는 2026-08-14 부터 영어 `GUIDE.md` 한 파일이었다. 화면의 모든 문구는 en/ko 짝으로만
존재하고(`MessageKey` 가 한쪽이 없으면 컴파일을 막는다), **스크립트 쓰는 법을 적은 유일한
문서만 영어였다.**

- `SEED_GUIDE` → `SEED_GUIDE_KO` + `SEED_GUIDE_EN`. 한국어판은 번역이 아니라 옆에 나란히
  사는 원문으로 둔다(생성해 내지 않는다).
- **둘 다 깔린다.** UI 언어에 맞는 하나만 깔면 언어를 바꾸는 순간 가이드가 사라지고, 어느
  언어로 읽을지는 읽는 사람이 안다 (`AC-studio.browser-39`).
- 두 파일은 첫머리 한 줄로 서로를 가리킨다. 목록에 가이드가 둘 보이는 이유가 파일을 여는
  즉시 설명돼야 한다.
- 예전 단일 `GUIDE.md` 는 슬롯을 열 때 지운다 (`AC-studio.browser-40`). **사람이 고친 것도
  지운다** — 2026-08-18 유저 판단이며(선택지를 보이고 받았다), 이 화면에서 사람의 글이
  사라질 수 있는 유일한 자리다. 그래서 `GUIDE.md` 는 그 폴더에서 메모를 적어 둘 이름이
  아니게 됐다.
- 시드 판정(빈 슬롯인가)에서 두 가이드는 안 센다. 세면 모든 슬롯이 찬 것으로 보여 시작
  스크립트가 영영 안 깔린다 (`AC-studio.browser-33`, 이름만 바뀐 기존 계약).

**딸린 갱신 하나.** 시작 스크립트(`example.ts`)의 머리 주석이 `GUIDE.md` 를 가리키고
있었다. 2026-08-14~18 사이에 워크스페이스를 연 사람은 그 문장을 쥔 채이고, 그 파일은 이제
없다 — 이름을 대는 안내라 사람이 찾아 나선다. 그래서 그 시드를 `PAST_STUDIO_SEEDS` 에,
지금 그대로인 `lib/rows.ts` 를 `PAST_STUDIO_LIBS` 에 적어 **손 안 댄 짝은 갱신되게** 했다
(`AC-studio.browser-26`·`-30` 의 기존 장치). 두 기록 모두 템플릿이 아니라 기록이다.

## 2. `extract` / `transform` 제거

유저가 가이드의 그 절을 읽고 물었다: "이게 뭐야 이게 필요해? 어디서 가져오는데? 왜 있어야
하는데?" **4일 전 시드에서 같은 질문을 받고 설명을 가이드로 옮긴 그 절이다.** 옮겨도 질문이
사라지지 않은 것은 설명이 모자라서가 아니라 기능이 필요 없어서였다.

지운 것:

- `host/runner.ts` 의 네 줄 — 파일이 `extract` 를 내보내면 `(page, ctx)` 로 부르고,
  `transform` 이 있으면 그 결과에 이어 붙이던 부분.
- 두 가이드의 그 절. 자리에 `실행` 절 한 문단이 들어갔다 — **기본 내보내기(default export)가
  함수면 `(page, ctx)` 로 불리고 돌려준 값이 패널에 찍힌다.** 이것 하나만 남는다.
- 스펙의 "역할은 export 이름으로" 절과 `AC-studio.browser-15`, QA CASE-studio-021~023.

남긴 것: `default` 처리. 이 앱이 지어낸 이름이 아니라 자바스크립트 관용구이고, 스크립트가
값을 돌려주는 유일한 통로다.

왜 지금 지워도 되나: 부른다던 화면(수집·처리)은 13줄 빈 껍데기이고 그 스펙도 데이터 모양이
미정이라고 적는다. 소비자가 생길 때 그 화면이 데이터 모양을 손에 쥔 채 자기 계약을 정한다.

비용: `studio-runner.test.ts` 가 `extract` 를 "값 돌려주는 손쉬운 방법"으로 쓰던 13곳을
`export default` 로 갈아탔다. 러너 동작을 보던 케이스(타입 주석·상대 import·트레이스 정리·
값 출력·정리)는 전부 그대로 살아 있다. 케이스 3개를 지우고 1개를 새로 넣었다 —
"`extract`·`transform` 이라는 이름은 아무 힘이 없다".

## 검증

| 무엇 | 결과 |
|---|---|
| `npm run typecheck` (tsc node+web) | PASS |
| `npm run lint` | PASS |
| `npm run test` | PASS — 49 files / 702 tests |
| `npm run build` | PASS |
| `npm run test:e2e` | PASS — 20 tests |
| `npm run sweep` | PASS 5/5 (tokens · imports · i18n · ledger · coverage) |
| `surface-verify` (화면 9 × 폼팩터 3 × 테마 2 = 96 캡처) | 차단 0 · 관찰 18(hit-target, 기준선) |

**실물 확인** — 앱을 띄워 `브라우저 작업대` → 파일 목록에서 두 가이드를 각각 열고 미리보기로
전환했다(임시 Playwright 스크립트, `HERMETRA_DRIVERS=mock`, 확인 후 폐기).
목록: `lib` / `example.ts` / `GUIDE_en.md` / `GUIDE_ko.md` — `GUIDE.md` 없음.
두 파일 다 제목·표·인라인 코드·링크가 문서로 그려지고, `실행` 은 잠긴 채다.
캡처: `.harness/steward/artifacts/workbench-guide-bilingual/shots/`(비추적).

### 빨강 확인

- 가이드 묶음 10건이 "앱이 영어 `GUIDE.md` 하나만 싣는다"는 이유로 먼저 실패했다.
- 시드 갱신 1건은 기록을 도로 빼고 돌려, 옮겨온 `example.ts` 가 `GUIDE_ko.md` 를 못 가리켜
  실패하는 것을 확인한 뒤 되돌렸다.
- 제거 케이스("이름은 아무 힘이 없다")는 러너를 고치기 전에 먼저 빨강이었다 — `extract` 가
  실제로 불려 `must not be called` 로 죽었다.

## 남은 것

- `GUIDE.md` 라는 이름은 이 폴더에서 **영구히 못 쓴다.** 사람이 그 이름으로 새로 메모를
  적어도 다음 목록에서 지워진다. 유저가 고른 동작이고, 이 기록과 코드 주석
  (`ensureGuide`)·`AC-studio.browser-40` 이 그 사실을 든다. 되돌리려면 "옛 시드와 바이트가
  같을 때만 지운다"로 좁히면 된다.
- 한국어판은 지금 영어판과 같은 내용이다. 한쪽만 고치면 갈라진다 — 가이드를 고칠 때는 두
  파일을 함께 고친다(짝을 강제하는 검사는 없다).
- 2026-08-12~13 시드를 **고쳐 쓰고 있는** 파일이 어딘가에 있으면, 그 `extract` 는 이제 아무도
  안 부른다 — 실행해도 조용히 아무 일도 안 일어난다. 손 안 댄 시드는 자동으로 갱신되므로
  대상은 사람이 고친 파일뿐이고, 작업대 자체가 6일 된 화면이라 실사용 파일이 있을 가능성은
  낮다. **알림을 넣지 않는다** — 죽은 규칙을 살려 두는 장치를 또 만드는 셈이다.
