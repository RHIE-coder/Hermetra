# 게이트 기록 — 2026-08-18 · guide-record-guard

같은 날 세 번째 회차. 앞 회차가 "남은 것"으로 적어 둔 세 줄을 유저가 그대로 가리키며
"처리 ㄱㄱ". **새 동작을 만드는 일이 아니라, 사람이 지켜야 했던 규칙을 기계가 지키게 옮기는
일**이다.

| 슬롯 | 값 |
|---|---|
| 대상 | `.claude/checks/check-seeded-docs.mjs`(신규) · `.claude/checks/run-all.mjs` · `.claude/harness.config.json` · `.claude/immunity/ledger.md` · `package.json` · `CLAUDE.md` · `AGENTS.md` |
| 인수조건 | 해당 없음 — 앱 동작은 안 바뀐다 |
| 테스트 | 앱 테스트 증감 없음(705). 검사 자체는 양쪽 실패를 실제로 일으켜 확인 |
| 새 의존성 | 없음 |

## 1. 가이드 기록 누락을 검사가 잡는다

가이드를 고칠 때 옛 원문을 `services/past-guides.ts` 에 안 옮기면, 앱은 디스크의 낡은 사본을
자기 것으로 못 알아보고 그대로 둔다 — 사용자 파일이 없는 기능을 계속 가르친다. 그게 이날
오후에 실제로 난 사고다.

`.claude/checks/check-seeded-docs.mjs` — 작업 트리와 HEAD 를 견준다.

- 실리는 글이 지난 커밋과 달라졌는데 그 지난 글이 기록에 없으면 **FAIL**.
- 지금 실리는 글이 기록에 들어 있어도 **FAIL** — 그러면 목록마다 파일을 덮어써서 사람이 고친
  가이드가 한 번밖에 못 산다.
- 상수가 HEAD 에 없으면(이번에 새로 생긴 문서) 통과. 물러난 판이 아직 없다.

설정으로 움직이고(`harness.config.json` → `checks.seeded-docs`), `npm run sweep` 에 `docs` 로
등록했다. 따로 돌릴 때는 `npm run sweep:docs`.

**무는지 확인했다**: 기록 없이 한국어 가이드를 한 줄 고치면 FAIL, 지금 판을 기록에 넣어도
FAIL, 되돌리면 OK. 검사가 통과만 하는 검사가 아니라는 증거가 있어야 검사다.

구현 중 한 번 틀렸다 — 첫 스캐너가 주석 안의 백틱까지 리터럴로 세어 짝이 어긋났고
`SEED_GUIDE_EN` 을 못 찾았다. 줄 주석·블록 주석·따옴표 문자열을 건너뛰는 상태 기계로 다시
썼다.

## 2. 확인용 스크립트가 실제 프로파일을 못 쓰게 한다

낡은 사본이 유저 워크스페이스에 놓인 경로 자체가, 확인용으로 손수 짠 스크립트가
`--user-data-dir` 에 그 사람의 진짜 프로파일을 넘긴 것이었다. `ui-shot.mjs` 와
`surface-verify.mjs` 는 임시 프로파일이 기본인데 손 스크립트가 그 관례를 비껴갔다.

immunity ledger 에 `real-profile-in-verification-script` 추가. `rule:` 정규식이 붙어 있어
PreToolUse 훅이 **그런 내용을 쓰는 것 자체를 막는다.** 실제 프로파일로 launch 하는 내용은
차단(종료코드 2), 임시 폴더로 launch 하는 내용은 통과(0)로 확인했다.

## 3. 피드백 폴더

`.harness/feedback/20260818-164608-studio-browser` — 유저 확인을 받고 지웠다. 제보 캡처는
`.harness/steward/artifacts/workbench-guide-refresh/shots/reported.png` 에 남는다.

## 검증

| 무엇 | 결과 |
|---|---|
| `npm run typecheck && npm run lint` | PASS |
| `npm run test` | PASS 705 (앱 코드 변경 0) |
| `npm run build` | PASS |
| `npm run sweep` | PASS **6/6** — 검사가 하나 늘었다 |
| `npm run lint:ledger` | OK — 5 entries |
| `surface-verify` | 해당 없음 — 렌더러 변경 0 |

`npm run test:e2e` 는 안 돌렸다. 이번 변경은 하네스 검사·ledger·문서뿐이고 앱 코드에 닿지
않는다(앞 회차에서 같은 트리로 20건 통과).

## 남은 것

- 검사는 **커밋 경계**에서만 문다. 한 커밋 안에서 고쳤다 되돌리면 볼 것이 없다 — 사용자에게
  닿는 것은 커밋된 판이라 그것으로 충분하다.
- 훅 규칙은 `--user-data-dir=` 뒤에 실제 경로가 글자로 올 때를 잡는다. 변수로 조립해 넘기면
  못 잡는다. 정규식으로 갈 수 있는 데까지다.
