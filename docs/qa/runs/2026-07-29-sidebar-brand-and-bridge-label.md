# 2026-07-29 · sidebar-brand-and-bridge-label

## 회차 1 — 브리지 이름 복구 · 사이드바 머리 태그라인 제거

- 기준 커밋: `d311615` (chore(harness): clear the task baton slug)
- 범위: 문구 키(en/ko) 2건 · 사이드바 컴포넌트 머리 · 그 이름을 "의도된 개명"으로
  적어 둔 정본 문서 6곳. 토큰·라우트·IPC 는 손대지 않았다.
- 검증 당시 작업 트리에는 이번 범위 밖의 미커밋 변경이 하나 더 있었다 — 그룹 제목을
  띠(band)로 바꾼 사이드바 변경. 아래 검사·캡처는 **둘이 합쳐진 상태**를 본 것이고,
  커밋은 두 갈래로 갈랐다(띠 → 이름).
- 계기: 유저 지적 — 태그라인은 "브리지"라고 말하는데 내비게이션에 브리지가 없다.
  본업(시나리오·변수·공유 버스·이벤트)이 "설정" 아래 들어가 있었다.

### 무엇을 고쳤나

| 무엇 | 전 | 후 |
|---|---|---|
| 브리지 그룹 라벨 | `Settings` / `설정` | `Bridge` / `브리지` |
| 사이드바 머리 | 마크 + 제품명 + 태그라인 2줄 | 마크 + 제품명 1줄 |
| `sidebar.tagline` 키 | en/ko 존재 | 삭제 (참조 0) |

표시명이 내부 식별자와 같아졌다. 라우트(`/bridge/*`)·IPC 채널(`BRIDGE_*`)·폴더
(`modules/bridge`)·타입(`BridgeEvent`)은 전과 동일하다 — 계약을 흔들지 않았다.

옛 이름을 가리키던 정본을 전부 고쳤다: `CLAUDE.md` §0, `docs/spec/architecture.md` §7,
`docs/spec/README.md`, `docs/spec/bridge/README.md`, `docs/spec/application.md`
(사이드바 표 + 머리 서술), `docs/glossary.md`. 살아있는 참조는 0건이고, 세 곳에는
**폐기 기록**으로 남겼다(왜 버린 이름인지가 다음 사람에게 필요한 정보라서).

| 검사 | 명령 | 결과 |
|---|---|---|
| 타입·lint | `npm run typecheck && npm run lint` | PASS |
| 테스트 | `npm run test` | PASS (28파일 / 282개 — 사이드바 2개 추가) |
| 빌드 | `npm run build` | PASS |
| E2E (Electron, mock 드라이버) | `npm run test:e2e` | PASS (11개) |
| 드리프트 검사 | `npm run sweep` | PASS (tokens · imports · i18n · ledger · coverage 5/5) |
| 화면 시각 판정 | `surface-verify` | 캡처 54건 · 차단 0 · 관찰 12 |
| 하네스 계약 | `node .harness/steward/core/validate.mjs` | 0 error · 경고 1 (`surface-verify` orphan 바인딩 — 이전 회차와 동일) |

기준선(`surface-baseline.json`)은 건드리지 않았다. 새로 얹은 항목 0건.

### 판정기 흔들림을 하나 확인했다

중간에 `hit-target narrow/dark — textbox: (486x20 < 24)` 가 **차단 1건**으로 떴다.
같은 코드·같은 빌드로 그 캡처만 3회 반복해 **1회 차단 · 2회 통과**를 재현했고, 크기가
`486x1` ↔ `486x20`, 역할이 `input:` ↔ `textbox:` 로 캡처마다 달라지는 것을 확인했다.

원인은 어댑터가 편집기 화면을 Monaco 의 배치가 끝나기 전에 찍는 것이다. 기준선은
역할·크기 문자열로 짝을 맞추므로 흔들린 쪽은 기준선에 없는 새 위반으로 보인다.
**이번 변경(사이드바 문구·라벨)이 편집기 textarea 에 영향을 줄 경로는 없다.**

이건 커밋 훅이 무작위로 막힐 수 있다는 뜻이므로 `../coverage-gaps.md` 의
`gap-visual-baseline` 에 적었다. 판정기 쪽 수정거리이고 이번 범위 밖이라 안 고쳤다.
기준선을 다시 생성해 덮지 않았다.

### 눈으로 확인한 것

빌드된 앱을 mock 드라이버로 띄워 `공유 버스` 화면(중간 폭 · 어두움)을 봤다: 머리는
마크 + `Hermetra` 한 줄, 그룹은 `웹 / 모바일 / 브리지`, 선택된 행은 카드 안으로 눌린
표현 유지. 캡처는 `.harness/steward/artifacts/sidebar-brand-and-bridge-label/shots/`
(추적 안 함).

- 미실행: 실물 드라이버 경로 — 전제는 `../coverage-gaps.md` 의 `gap-real-driver`.
- 실패 상세: 없음.
- 남긴 것: 사이드바 브랜드 마크가 아직 앱 아이콘 PNG(184KB)를 28px 로 줄여 쓴다.
  그 크기에서 안쪽 글리프가 안 읽히고, 화면에서 채도가 가장 높은 물체인데 정보가 없다
  (`app.theme` 의 "색은 주 행동과 상태 신호에만"과 어긋난다). 브랜드 결정이라 유저에게
  넘겼다.
