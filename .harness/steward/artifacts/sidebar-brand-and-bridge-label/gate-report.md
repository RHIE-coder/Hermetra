---
phase: gate
status: ready
inputs: [surface-verify]
---

# gate — sidebar-brand-and-bridge-label

경로: `[small]` — intake(축약) → build → review(관점 1: UI 시각) → gate → report

## 판정: PASS

| 검사 | 결과 |
|---|---|
| `npm run typecheck && npm run lint` | PASS |
| `npm run test` | PASS 282 (28파일) |
| `npm run build` | PASS |
| `npm run test:e2e` | PASS 11 |
| `npm run sweep` | PASS 5/5 |
| `surface-verify` (54캡처) | 차단 0 · 관찰 12 |
| `validate.mjs` | 0 error · 경고 1 (기존) |

## 정본 드리프트

없음 — 이번 변경이 어긋나게 만든 정본을 같은 변경에서 전부 고쳤다.

| 정본 | 무엇 |
|---|---|
| `CLAUDE.md` §0 | 표시명 개명 주석을 "식별자와 일치" + 폐기 기록으로 |
| `docs/spec/architecture.md` §7 | 같음 |
| `docs/spec/README.md` | 같음 |
| `docs/spec/bridge/README.md` | 제목·주석 |
| `docs/spec/application.md` | 사이드바 표의 그룹명 · 머리 서술(태그라인 없음) |
| `docs/glossary.md` | `설정 / Settings` 를 폐기 항목으로 |
| `docs/qa/scenarios/workspace.md` | CASE-app-016 · 017 등록 |
| `docs/qa/coverage-gaps.md` | `gap-visual-baseline` 에 flake 기록 |

## review — UI 시각 관점에서 잡은 것

1. 브랜드 워드마크에 남아 있던 `truncate` 를 제거했다. `min-w-0` 없는 flex 항목이라
   애초에 발동하지 않고, 문자열이 두 언어 모두 `Hermetra` 한 단어여서 줄바꿈도 없다.
   죽은 클래스였다.
2. 머리 높이 `h-12` 는 상단바와 같아야 좌우 눈금이 맞는다 — 태그라인을 빼면서 줄이지
   않았다. 캡처로 확인.
3. 남긴 결함: 브랜드 마크가 앱 아이콘 PNG 다. 28px 에서 글리프가 안 읽히고, 화면에서
   채도 최상위 물체인데 정보가 0 — `AC-app.theme-05` 와 어긋난다. 브랜드 결정이라
   유저에게 올렸고 고치지 않았다.

## 커밋 시 주의

작업 트리에 **이전 작업의 미커밋 변경**이 같은 파일(`sidebar.tsx`)에 있다 —
그룹 제목을 띠(band)로 바꾼 변경. 이번 변경과 논리적으로 별건이므로 커밋을 가를지
유저에게 물어야 한다.
