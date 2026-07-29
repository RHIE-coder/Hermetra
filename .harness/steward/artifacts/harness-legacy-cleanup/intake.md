# intake — harness-legacy-cleanup

경로: `[small]` · 2026-07-29

## 요구 (유저 승인 완료)

steward 도입 이후 남은 옛 `.claude` 하네스의 **명령 층**을 걷어내고, 살아남은
**검사 층**을 정직한 위치로 옮긴다. consult 진단에서 합의한 6항목 그대로.

핵심 구분:

| 층 | 상태 | 처분 |
|---|---|---|
| 일을 시키는 층 (스킬·에이전트·배포 키트) | steward와 두 벌 | 삭제 |
| 검사하는 층 (sweep 스크립트·추출기·훅·원장) | 한 벌, steward가 부름 | 유지 + 이사 |
| 얼린 기록 (`.specs/done/`) | 문서가 명시 | 손대지 않음 |

## 작업 목록

### 커밋 ① 명령 표면 삭제

| What | Why |
|---|---|
| `.claude/skills/{intake,quick,sprint,setup}/` 전체 | `/steward:*` 와 같은 일. 슬래시 명령이 두 벌이라 잘못된 경로를 탈 수 있다 |
| `.claude/skills/sweep/SKILL.md`, `.claude/skills/immunize/{SKILL.md,template.md}` | 스킬 정의만 죽음. 같은 폴더의 `scripts/` 는 커밋 ②에서 이사 |
| `.claude/agents/{testwriter,implementer,auditor,sweeper}.md` | steward의 planner·qa-designer·reviewer·ui-designer 와 병존. 게다가 셋은 아무도 안 쓰는 `.specs/active/<slug>.md` 를 읽으라고 지시받는다 |
| `.claude/scripts/bundle-setup.mjs` · `HARNESS_SETUP.md` · `HARNESS_SETUP_GUIDE.html` | 옛 하네스를 다른 프로젝트로 배포하던 키트(131KB). steward는 플러그인으로 배포된다 |
| `.claude/scripts/preflight.mjs` · `.specs/active/.gitkeep` | 옛 하네스 형상을 검증. steward는 `core/validate.mjs` 를 따로 가진다. `.gitkeep` 은 이 검사기를 달래려고만 존재했다 |
| `.claude/output-styles/hermetra.md` | `settings.json` 에 `outputStyle` 없음. 참조 0 |
| package.json `bundle:setup`, `preflight` | 위 스크립트를 가리키는 진입점 |

### 커밋 ② 검사 스크립트 이사 + 참조 갱신

`.claude/skills/sweep/scripts/*.mjs`(6) + `.claude/skills/immunize/scripts/lint-ledger.mjs`
→ `.claude/checks/`. 이걸로 `.claude/skills/` 가 통째로 사라지고 "sweep은 스킬"이라는
거짓 신호가 없어진다.

`.claude/` 밖으로 내보내지 **않는** 이유: 훅이 상대 경로로 `../lib/config.mjs` 를
import 하고 ROOT 기준으로 `extractors/` 를 spawn 한다. 훅은 Claude Code 규약상
`.claude/hooks/` 를 떠날 수 없으므로 검사기와 같은 트리에 있어야 한다.

고칠 참조:

| 파일 | 무엇 |
|---|---|
| 이동한 5개 스크립트 | `../../../lib/config.mjs` → `../lib/config.mjs` |
| `.claude/hooks/design-token-guard.mjs` | `SCANNER` 경로 + 주석 |
| `.claude/hooks/immunity-rules-guard.mjs` | `SCANNER` 경로 + 주석 |
| `package.json` | `sweep*` 6개 + `lint:ledger` |
| `.claude/harness.config.json` | 댕글링 `$schema`(파일 없음), 죽은 `intake.optionalSections` |
| `.claude/immunity/ledger.md` | 산문의 `/sprint`·`testwriter→implementer→auditor`·`auditor / sweeper` → steward 단계 이름 |
| `CLAUDE.md` | §7 legacy 절 재작성, 단축표에서 `npm run preflight` 제거, 경로 갱신 |

`.harness/steward/config.yaml` 의 `token-guard: "npm run sweep"` 는 그대로 —
npm 스크립트 이름은 바뀌지 않는다.

## 건드리지 않는 것

- `src/**` — 제품 코드 0줄
- `.specs/done/` 7개 — `CLAUDE.md:256`·`docs/spec/README.md:5,78` 이 "frozen, historical" 로 명시
- `docs/spec/`, `docs/qa/` 정본 노드 — 이 변경은 제품 동작을 바꾸지 않는다 (spec 영향 없음)

## 완료 기준

1. `npm run sweep` 5개 검사 PASS
2. `npm run check` 초록 (typecheck · lint · test · build)
3. `npm run test:e2e` 초록
4. 훅 2개가 이동한 검사기를 실제로 찾아 실행 (경로 회귀 없음)
5. 죽은 이름 grep 0: `HARNESS_SETUP`, `bundle-setup`, `preflight`, `.specs/active`,
   `skills/sweep`, `testwriter|implementer|auditor|sweeper`
6. `node .harness/steward/core/validate.mjs` 통과

## 위험

이동한 스크립트의 import 가 깨지면 `npm run sweep` 과 커밋 훅이 **동시에** 죽는다.
훅은 조용히 통과하는 쪽으로 실패할 수 있어(스캐너 없으면 allow) 더 위험하다 —
이사 직후 5개를 개별 실행하고, 훅은 일부러 위반을 써서 막히는지 확인한다.
