---
phase: gate
status: ready
inputs: [intake]
---

# gate — harness-legacy-cleanup

경로: `[small]` — intake(축약) → build → review(관점 1: 설계 패턴) → gate → report

## 판정: PASS

| 검사 | 결과 |
|---|---|
| `npm run typecheck && npm run lint` | PASS |
| `npm run test` | PASS 282 (28파일 — 증감 없음) |
| `npm run build` | PASS |
| `npm run test:e2e` | PASS 11 |
| `npm run sweep` | PASS 5/5 (이동한 경로에서) |
| `sweep:*` 6개 개별 실행 | PASS 6/6 |
| 훅 2개 실물 확인 | 위반 입력 → exit 2 차단 · 정상 토큰 → exit 0 통과 |
| `validate.mjs` | 0 error · 경고 1 (`surface-verify` orphan 바인딩 — 기존) |

UI 게이트는 **무장하지 않았다**: `src/renderer/**/*.tsx`,
`src/renderer/styles/**/*.css`, `tailwind.config.ts` 중 손댄 것이 0건이다.
제품 코드(`src/`)는 한 줄도 바뀌지 않았다.

## 정본 드리프트

**없음.** 정본(`docs/spec/`, `docs/qa/`)이 하네스를 가리키는 지점은 전부
**npm 스크립트 이름**이고, 이름은 하나도 바뀌지 않았다.

| 정본 위치 | 가리키는 것 | 상태 |
|---|---|---|
| `docs/qa/plan.md:30-34` | `npm run test` · `test:e2e` · `test:coverage` · `check` · `sweep` | 그대로 유효 |
| `docs/qa/scenarios/workspace.md:54-67` (`app.rules` Suite) | `sweep:tokens` · `sweep:imports` · `sweep:i18n` · `sweep:coverage` · `sweep:ledger` | 그대로 유효 — 전부 재실행해 PASS 확인 |
| `docs/glossary.md:37` | `.claude/immunity/ledger.md` | 경로 안 바뀜 |
| `docs/spec/README.md:5,78` | `.specs/done/` | 손대지 않음 |

정본은 스크립트의 **구현 경로**를 몰라도 되게 쓰여 있었고, 그 덕에 이 이사가
정본을 흔들지 않았다. 제품 명세 영향: **없음** (동작 변경 0건).

## 완료 기준 대조 (intake §완료 기준)

| # | 기준 | 결과 |
|---|---|---|
| 1 | `npm run sweep` 5개 PASS | ✅ |
| 2 | `npm run check` 초록 | ✅ |
| 3 | `npm run test:e2e` 초록 | ✅ |
| 4 | 훅 2개가 이동한 검사기를 찾아 실행 | ✅ 차단·통과 양방향 확인 |
| 5 | 죽은 이름 grep 0 | ✅ 살아있는 참조 0 — 남은 3건은 의도한 기록(아래) |
| 6 | `validate.mjs` 통과 | ✅ |

기준 5의 남은 3건은 **역사 기록**이며 지시가 아니다:

- `CLAUDE.md` §7 — 무엇을 왜 지웠는지 적은 부고. 다음 사람이 `.claude/skills/` 를
  다시 만들지 않게 하는 정보다.
- `.claude/immunity/ledger.md` 항목 `esm-dirname-assumption` 의 `source:` —
  "legacy `/sprint` run" 으로 명시해 살아있는 명령이 아님을 드러냈다.
- `AGENTS.md` §5 — 같은 부고 한 문장.

## 위험 재평가

intake 에서 "훅이 조용히 통과하는 쪽으로 실패할 수 있다"고 적었는데 **틀렸다.**
두 훅 모두 `if (r.status === 0) process.exit(0)` 구조라 스캐너가 없으면
`node <없는 파일>` 이 exit 1 을 내고 훅은 **차단**한다. 경로 실수는 조용히
비무장되는 게 아니라 시끄럽게 전부 막히는 쪽으로 실패한다 — 안전한 방향이다.
`design-token-guard.mjs` 의 `SCANNER` 선언 위에 이 사실을 주석으로 남겼다.

## 관찰 (차단 아님)

`.claude/checks/lint-ledger.mjs` 는 `run-all.mjs` 의 REGISTRY 에 **없다** —
`npm run sweep` 은 이걸 안 돌린다. 이사 전과 같은 동작이고 이유도 있다(코드를 보는
검사 5개 vs 원장 파일 자체의 형식을 보는 검사 1개). 다만 이제 한 폴더에 나란히
있으니 헷갈릴 수 있다. 등록 여부는 동작 변경이라 이번 범위에서 하지 않았다.
