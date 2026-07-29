# 2026-07-29 · harness-legacy-cleanup

## 회차 1 — 옛 하네스의 명령 층 제거 · 검사 층 이사

- 기준 커밋: `4d0b661` (chore(harness): clear the task baton slug)
- 범위: `.claude/` 안의 하네스 잔재와 그 참조. **제품 코드(`src/`) 0줄**,
  라우트·IPC 채널·스키마·문구 키 모두 손대지 않았다.
- 계기: 유저 지적 — steward 와 옛 하네스가 혼용돼 있는 것 같다.

### 진단에서 갈라낸 세 층

| 층 | 상태 | 처분 |
|---|---|---|
| 일을 시키는 층 — 스킬 6개 · 에이전트 4개 · 배포 키트 | steward 와 **두 벌** | 삭제 |
| 검사하는 층 — sweep 스크립트 · 추출기 · 훅 · 원장 | **한 벌**, steward 가 부름 | 유지 + 이사 |
| 얼린 기록 — `.specs/done/` 7개 | 정본이 "frozen, historical" 로 명시 | 손대지 않음 |

유저가 처음 지목한 두 예시는 둘 다 혼용의 증거가 아니었다. `.specs/done/` 은
`CLAUDE.md`·`docs/spec/README.md` 가 기록으로 못박아 둔 것이고,
`.claude/harness.config.json` 은 steward 의 `token-guard` 바인딩(`npm run sweep`)과
커밋 훅 두 개가 **지금도 읽는** 설정 파일이다. 잔재처럼 보인 이유는 이름과 위치가
거짓말을 했기 때문이다 — 역할은 "프로젝트 검사 설정"인데 죽은 워크플로의 이름을 달고
죽은 스킬 폴더 밑에 있었다.

### 무엇을 지웠나 (커밋 ①)

| 무엇 | 왜 |
|---|---|
| `.claude/skills/{intake,quick,sprint,setup}/` · `sweep/SKILL.md` · `immunize/SKILL.md`+`template.md` | `/steward:*` 와 같은 일. 슬래시 명령이 두 벌이면 요청이 죽은 경로를 탈 수 있다 |
| `.claude/agents/{testwriter,implementer,auditor,sweeper}.md` | steward 의 planner·qa-designer·reviewer·ui-designer 와 병존. 셋은 아무도 안 쓰는 `.specs/active/<slug>.md` 를 읽으라고 지시받아, 스펙 없이 돌 수 있었다 |
| `HARNESS_SETUP.md`(3201줄) · `HARNESS_SETUP_GUIDE.html`(543줄) · `scripts/bundle-setup.mjs` | 옛 하네스를 다른 프로젝트로 배포하던 키트. steward 는 플러그인으로 배포된다. 루트에 프로젝트 문서처럼 놓여 있었다 |
| `.claude/scripts/preflight.mjs` · `.specs/active/.gitkeep` | 옛 하네스 형상을 검증. steward 는 `core/validate.mjs` 를 따로 가진다. `.gitkeep` 은 steward 도입 커밋(`125eb47`)이 이 검사기의 hard 요구를 달래려고 만든 것이었다 |
| `.claude/output-styles/hermetra.md` | `settings.json` 에 `outputStyle` 없음. 참조 0 |
| `package.json` `preflight`, `bundle:setup` | 위 스크립트의 진입점 |

합계 5,917줄 삭제 / 148줄 추가.

### 무엇을 옮겼나 (커밋 ②)

`.claude/skills/{sweep,immunize}/scripts/*.mjs` 7개 → **`.claude/checks/`**.
이걸로 `.claude/skills/` 가 통째로 사라져 "sweep 은 스킬"이라는 거짓 신호가 없어졌다.

`.claude/` **밖으로** 내보내지 않은 이유: 훅은 Claude Code 규약상 `.claude/hooks/` 를
떠날 수 없고, 거기서 `../lib/config.mjs` 를 상대 경로로 import 한다. 검사기와 훅이
같은 설정을 봐야 "가드와 sweep 이 서로 다른 말을 하는" 상태가 안 생긴다.

고친 참조: 이동한 5개 스크립트의 `../../../lib/` → `../lib/`, 훅 2개의 `SCANNER`
경로와 주석, `package.json` 7줄, `lib/config.mjs` 의 오류 메시지(없어진 `/setup` 과
없는 스키마 파일을 가리키고 있었다), `harness.config.json` 의 댕글링 `$schema`(파일
자체가 없었다)와 죽은 `intake.optionalSections`, `.claude/immunity/ledger.md` 산문의
죽은 명령 이름, `CLAUDE.md` §7 · 단축표, `AGENTS.md` §5.

`.harness/steward/config.yaml` 의 `token-guard: "npm run sweep"` 는 **그대로** —
npm 스크립트 이름은 하나도 바뀌지 않았다. 이것이 정본이 안 흔들린 이유다.

| 검사 | 명령 | 결과 |
|---|---|---|
| 타입·lint | `npm run typecheck && npm run lint` | PASS |
| 테스트 | `npm run test` | PASS (28파일 / 282개 — 증감 없음) |
| 빌드 | `npm run build` | PASS |
| E2E (Electron, mock 드라이버) | `npm run test:e2e` | PASS (11개) |
| 드리프트 검사 | `npm run sweep` | PASS (tokens · imports · i18n · ledger · coverage 5/5) |
| 개별 검사 | `sweep:tokens/imports/i18n/coverage/ledger` · `lint:ledger` | PASS 6/6 |
| 하네스 계약 | `node .harness/steward/core/validate.mjs` | 0 error · 경고 1 (`surface-verify` orphan 바인딩 — 이전 회차와 동일) |

UI 게이트는 무장하지 않았다 — `ui_globs` 에 걸리는 파일 변경 0건.

### 훅을 말로 믿지 않고 먹여서 확인했다

경로를 옮긴 스크립트를 훅이 못 찾으면 가드 두 개가 동시에 죽는다. 그래서 훅 stdin 에
직접 페이로드를 먹였다.

| 입력 | 훅 | 결과 |
|---|---|---|
| `bg-popover` (등록 안 된 토큰) | `design-token-guard` | exit 2 차단, 위반 지점 출력 |
| `bg-card` (등록된 토큰) | `design-token-guard` | exit 0 통과 |
| `text-chart-3` (원장 `rule:` 위반) | `immunity-rules-guard` | exit 2 차단, 위반 항목 id 출력 |

### intake 의 위험 판단이 틀렸다

"훅이 조용히 통과하는 쪽으로 실패할 수 있다"고 적었는데 반대였다. 두 훅 모두
`if (r.status === 0) process.exit(0)` 구조라, 스캐너가 없으면 `node <없는 파일>` 이
exit 1 을 내고 훅은 **차단**한다. 경로 실수는 비무장이 아니라 전면 차단으로 드러난다.
다음 사람이 같은 걱정을 안 하도록 `design-token-guard.mjs` 의 `SCANNER` 선언 위에
"fails closed" 를 주석으로 남겼다.

### 남긴 것 · 안 한 것

- **남긴 것 1**: `.claude/checks/lint-ledger.mjs` 는 `run-all.mjs` 의 REGISTRY 에
  없어서 `npm run sweep` 이 안 돌린다. 이사 전과 같은 동작이고 구분에도 이유가 있다
  (코드를 보는 검사 5개 vs 원장 파일 형식을 보는 검사 1개). 다만 한 폴더에 나란히
  놓이니 헷갈릴 수 있다. 등록은 동작 변경이라 범위 밖으로 뒀다.
- **남긴 것 2**: `validate.mjs` 의 `surface-verify` orphan 바인딩 경고 — 이전 회차부터
  있던 것이고 이번 변경과 무관하다.
- **안 한 것**: `.specs/done/` 7개. 정본 두 곳이 "frozen, historical" 로 명시하며,
  옮겨서 얻을 게 없다.
- **미실행**: 실물 드라이버 경로 — 전제는 `../coverage-gaps.md` 의 `gap-real-driver`.
  이번 변경은 드라이버를 지나지 않는다.
