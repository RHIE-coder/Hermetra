# 2026-08-10 · pipeline-sidecar

## 회차 1 — 수집 사이드카 (Camoufox, 앱 밖 프로세스)

- 기준: 같은 날 `data-pipeline-nav` 작업 위.
- 범위: 새 모듈 `src/main/sidecar/`(감독자 · 어댑터 · 런처) · 공유 타입 1 · IPC 채널 4 ·
  register 배선 · 빌드 플러그인 1 · eslint 스코프 1줄 · 테스트 2파일 · 정본 3파일.
- 계기: 유저 요청 — 안티봇(Imperva) 뒤의 대상을 긁어야 하고, Playwright + stealth 로는 막힌다.

### 무엇이 이 구조를 정했나

스파이크로 먼저 재고, 그 결과가 설계를 정했다. `scratchpad/camoufox-spike/`.

**대상 셋, 같은 30초 창:**

| 대상 | 보호 | camoufox-js | 맨 Chromium |
|---|---|---|---|
| pokemon.com TCG | Imperva | 통과 | hCaptcha 차단벽 |
| new.land.naver.com | 자체 | 통과 | naver.com 으로 튕김 |
| pricecharting.com | Cloudflare | 통과 (5초에 챌린지 자동 해제) | 30초 내내 "Just a moment…" |

**Electron 안에서는 왜 못 쓰나 — 네 번 재고 얻은 표:**

| 시도 | 결과 |
|---|---|
| 메인 프로세스에서 `launchServer()` | SIGSEGV |
| `require('better-sqlite3')` 만 | 성공 — **쓰는 순간** 죽는다 |
| `ELECTRON_RUN_AS_NODE=1` | SIGSEGV — 같은 V8 |
| `@electron/rebuild` | "Rebuild Complete" 를 찍고 `.node` 를 0개 만든다 |
| 진짜 Node 자식 + `firefox.connect(ws)` | **PASS, 9.2초** |

원인은 `camoufox-js` → `better-sqlite3` 의 배포 빌드가 N-API 가 아니라 V8 ABI 라는 것이다
(napi 심볼 1개). 그래서 경계를 프로세스로 그었다. 취향이 아니라 저 표가 정했다.

### 판정을 두 번 고쳤다

1. 첫 스파이크가 pokemon.com 을 BLOCKED 로 찍었다. `_Incapsula_Resource` 를 차단 표식으로
   봤는데 그건 Imperva 뒤 사이트가 **정상 페이지에도** 싣는 스크립트다. 상태 코드와 표식만
   보면 안 되고 실제로 그려진 것을 봐야 한다 — 스크린샷으로 확인했다.
2. pricecharting 을 "Cloudflare 가 막는다" 로 읽었는데, 챌린지가 스스로 풀린다. 4초만 기다린
   내 탓이었다. **수집기가 403 을 즉시 실패로 처리하면 안 된다**는 요구가 여기서 나왔다.

### 붙인 것

```
Electron 메인 ──spawn──> node launcher.mjs ──> Camoufox
     │                   (better-sqlite3 · impit 이 여기 갇힌다)
     └──── playwright-core firefox.connect(ws://…) ─────┘
```

- `sidecar/supervisor.ts` — **순수 로직.** 상태기계 + 재시작 정책. child_process 도 타이머도
  모른다(주입). 크래시·백오프·포기·의도적 정지 전 분기가 spawn 없이 테스트된다.
- `sidecar/index.ts` — 어댑터. 자식 → 핸들(줄 버퍼링), Node 런타임 탐색.
- `sidecar/launcher.mjs` — 자식. stdout 에 `WS <주소>` 한 줄만.

감시 규칙 중 값이 큰 둘: `ready` 에 닿으면 재시작 카운트가 0으로 돌아가고(회복한 사이드카가
영원히 포기 직전에 남지 않게), `maxRestarts` 를 넘기면 **포기한다**(크래시 루프가 머신을 태우고
진짜 원인을 가린다). 스파이크에서 내가 자식 정리를 안 해 Camoufox 22개가 쌓였고 머신이 굶어
`whenReady` 가 240초 걸렸다 — 실제로 물리는 문제라는 증거라 `before-quit` 정리를 넣었다.

앱 시작 시 자동 기동은 **하지 않는다.** 그 화면을 안 여는 사용자에게 스텔스 브라우저는 순수
비용이다.

### 게이트

| 검사 | 결과 |
|---|---|
| `npm run check` | PASS — 36파일 455테스트 |
| `npm run test:e2e` | PASS — 19테스트 |
| `npm run sweep` | PASS 5/5 |
| 런처 실기동 (진짜 Node) | PASS — camoufox 기동 → WS 출력 → SIGTERM 정상 종료 |

새 테스트 25개: `sidecar-supervisor.test.ts` 13(테스트 먼저, red 확인) · `sidecar.test.ts` 12.

## 회차 2 — 패키징 (같은 날, 이어서)

- 계기: 유저 요청 — "어차피 해야 한다며. 까먹기 전에 해 두자."
- 범위: `electron-builder.yml` · `scripts/bundle-node.mjs` · npm 스크립트 4 ·
  eslint ignore/스코프 · `.gitignore` · 정본 1.

이 프로젝트에는 패키징 설정이 **아예 없었다**(build 섹션 없음, dist 스크립트 없음). 사이드카가
Node 를 요구하니 더 미룰 수 없어 여기서 세웠다.

| 결정 | 왜 |
|---|---|
| Node 를 함께 싣는다 | `process.execPath` 는 Electron 이라 사이드카를 못 돌린다 |
| 버전 고정 `v22.14.0` | "가장 새것"이면 같은 커밋이 매번 다른 런타임을 싣고 그 차이가 안 남는다 |
| 공식 배포본을 **받는다** (개발 기계 것 복사 아님) | mac 에서 win 런타임을 실을 수 있고, 결과가 "무엇이 깔려 있었나"에 안 달린다 |
| `asar: false` | 런처가 진짜 Node 라 `app.asar` 를 못 읽는다. `.node` 만 unpack 으론 부족하고 camoufox-js JS 트리 전체가 밖이어야 한다. 전이 의존성을 글롭으로 열거하면 의존성 하나 늘 때마다 조용히 깨진다 |

**검증 — 패키징된 앱 안에서 실제로 돌렸다.** `Contents/Resources/node/node` 가
`app/out/main/launcher.mjs` 를 돌려 Camoufox 가 떴고 SIGTERM 에 정상 종료했다. 앱 485MB.

lint 가 `release/` 산출물까지 훑어 1192건을 냈다 — ignore 에 `release/`·`resources/`·`.cache/`
를 넣고 `scripts/**/*.mjs` 에 Node 전역을 줬다.

### 남긴 것

| 확인 못 한 것 | 무엇 |
|---|---|
| win32 · linux | 스크립트는 `--platform`/`--arch` 를 받지만 **darwin-arm64 만 실제로 돌려 봤다** |
| 서명 · 공증 | `identity: null`. 배포용 dmg 를 만들 때 |
| 앱 아이콘 | 기본 Electron 아이콘 |

UI 는 안 붙였다 — 채널은 있고 화면은 없다. 소스 화면을 설계할 때 사이드카 상태 자리를 함께
잡는다.
