# `pipeline` — 데이터 파이프라인 Service (UI 표시명 "데이터 파이프라인 / Data Pipeline")

데이터를 **어디서 가져와(소스) · 어떻게 꺼내(수집) · 어떻게 바꾸고(처리) · 어디에 쌓고(저장소) ·
무엇을 읽어내는가(인사이트)** 를 다루는 계층. 그 다섯 단계를 하나로 이어 실행하고 지켜보는
자리가 작업(Jobs)이다.

> 표시명·라우트·폴더·testid 가 모두 `pipeline` 이다 — 브리지가 잡아 둔 규칙과 같다
> (`../architecture.md` §7).

| Surface | ID | 라우트 | testid | 정본 |
|---|---|---|---|---|
| 작업 | `pipeline.jobs` | `/pipeline/jobs` | `nav-pipeline-jobs` / `page-pipeline-jobs` | `jobs.md` |
| 소스 | `pipeline.sources` | `/pipeline/sources` | `nav-pipeline-sources` / `page-pipeline-sources` | `sources.md` |
| 수집 | `pipeline.ingestion` | `/pipeline/ingestion` | `nav-pipeline-ingestion` / `page-pipeline-ingestion` | `ingestion.md` |
| 처리 | `pipeline.processing` | `/pipeline/processing` | `nav-pipeline-processing` / `page-pipeline-processing` | `processing.md` |
| 저장소 | `pipeline.storage` | `/pipeline/storage` | `nav-pipeline-storage` / `page-pipeline-storage` | `storage.md` |
| 인사이트 | `pipeline.insights` | `/pipeline/insights` | `nav-pipeline-insights` / `page-pipeline-insights` | `insights.md` |

## 지금 상태 — 껍데기 여섯

**2026-08-10 기준, 여섯 화면 모두 내용이 없다.** 라우트와 내비게이션과 `page-*` 컨테이너만
있고, 각 화면은 제목 · 한 줄 부제 · "아직 비어 있습니다" 카드 하나를 그린다. 상태도 IPC 도
없다 — `modules/pipeline` 에는 store 가 없고 `channels.ts` 에 새 채널이 없다.

이 순서로 만든 이유는, 파이프라인의 **모양**(단계가 몇 개이고 무엇이라 불리는가)이 그 안의
어떤 기능보다 먼저 정해져야 하기 때문이다. 이름이 흔들리면 라우트·IPC 채널·testid 가 전부
따라 흔들린다.

화면 하나가 내용을 갖게 될 때 그 화면의 정본 파일(`jobs.md` 등)을 함께 채운다. 그 전까지
각 파일은 "무엇이 여기 들어와야 하는가" 한 문단이다.

## 이름 규칙 (2026-08-10 확정)

영문은 **단계 명사**다 — `Ingestions` · `Processings` · `Storages` 는 쓰지 않는다. 셋 다
불가산 명사라 복수형이 오타로 읽힌다. 한국어는 `수집 / 처리 / 저장` 세 음절이 그대로 이어지는
쪽을 골랐다.

| 영문 | 한국어 | 버린 후보 |
|---|---|---|
| Jobs | 작업 | Job Managements (동사형 + 복수) |
| Sources | 소스 | 데이터 소스 (레일에서 길다) |
| Ingestion | 수집 | Ingestions, Extractings |
| Processing | 처리 | Processings |
| Storage | 저장소 | Storages, Destinations |
| Insights | 인사이트 | Reporting, 분석 |

작업(Jobs)은 **한 화면**이다. 등록해 둔 실행 플로우(즐겨찾기)와 지금 돌고 있는 작업을 한 곳에
둔다. 정의(Flows)와 실행(Runs)을 두 화면으로 쪼개는 안은 보류했다 — 아직 IPC 계약이 없어서
지금 쪼개면 계약까지 미리 갈라 놓게 된다. 내용이 붙을 때 다시 본다.

## `pipeline.sidecar` — 브라우저는 앱 밖에서 뜬다

안티봇(Imperva·Cloudflare) 뒤의 대상을 받으려면 **Camoufox** — JS 주입이 아니라 소스를 고쳐
빌드한 Firefox — 가 필요하다. 그것을 띄우는 `camoufox-js` 가 `better-sqlite3` 를 의존하는데,
그 패키지가 배포하는 빌드는 **N-API 가 아니라 V8 ABI** 다(napi 심볼 1개).

**Electron 안에서는 못 쓴다.** 실측:

| 시도 | 결과 |
|---|---|
| Electron 메인 프로세스에서 `launchServer()` | **SIGSEGV** |
| `require` 만 | 성공 — 로드는 되고 **쓰는 순간** 죽는다 |
| `ELECTRON_RUN_AS_NODE=1` | **SIGSEGV** — 같은 V8 이라 모드와 무관 |
| `@electron/rebuild` | "Rebuild Complete" 를 찍고 **아무것도 안 만든다** (평면 `prebuilds/` 레이아웃 미인식) |
| **진짜 Node 자식 프로세스 + WS 연결** | **PASS** — 9.2초에 Imperva 통과 |

그래서 경계가 이렇다. 이건 취향이 아니라 저 표가 정한 것이다.

```
Electron 메인 ──spawn──> node launcher.mjs ──> Camoufox (Firefox)
     │                   (better-sqlite3 · impit 이 여기 갇힌다)
     └──── playwright-core firefox.connect(ws://…) ───────────┘
```

부수 효과가 둘 더 있고, 둘 다 원래 필요했던 것이다: 수집을 **병렬로 돌리고 스케줄링** 하려면
어차피 프로세스가 따로 있어야 하고, 브라우저가 죽어도 앱이 안 죽는다.

### 계약

- stdout 에는 `WS <ws://…>` 한 줄만 나간다. 진행 상황과 로그는 stderr 다. 수다스러운 의존성이
  주소로 오인되지 않게 하는 유일한 방법이다.
- SIGTERM 을 받으면 브라우저를 닫고 0 으로 끝난다.

인수조건:

- `AC-pipeline.sidecar-01` stdout 은 조각으로 온다. 주소가 두 청크에 걸쳐 와도, 한 청크에 두
  줄이 와도 감독자는 **완전한 줄만** 본다.
- `AC-pipeline.sidecar-02` 자식이 스스로 죽으면 `crashed` 가 되고 **왜 죽었는지**가 남는다.
  재시작은 백오프(1s·2s·4s…)로 예약된다.
- `AC-pipeline.sidecar-03` `ready` 에 도달하면 재시작 횟수가 **0으로 돌아간다.** 회복한
  사이드카가 영원히 포기 직전 상태로 남으면 안 된다.
- `AC-pipeline.sidecar-04` `maxRestarts` 를 넘기면 **포기한다.** 크래시 루프는 머신을 태우고
  진짜 원인을 가린다. 포기는 상태이지 처리 실패가 아니다.
- `AC-pipeline.sidecar-05` 사람이 멈춘 것과 죽은 것을 가른다 — `stop()` 뒤의 종료는
  `stopped` 이고 재시작하지 않는다. 예약된 재시작도 취소한다.
- `AC-pipeline.sidecar-06` spawn 자체가 실패해도(런타임 없음·런처 없음) **죽음으로 보고된다.**
  오지 않을 주소를 기다리지 않는다.
- `AC-pipeline.sidecar-07` 앱이 종료하면 사이드카도 종료한다. 살아남은 사이드카는 포트를 쥔
  고아 브라우저다.
- `AC-pipeline.sidecar-08` 앱이 뜰 때 자동으로 시작하지 **않는다.** 그 화면을 안 여는
  사용자에게 스텔스 브라우저는 순수 비용이다.

### 배포 — Node 를 함께 싣는다

`process.execPath` 는 Electron 이라 못 쓴다(위 표). 그래서 **Node 바이너리가 앱과 함께
실린다.** `scripts/bundle-node.mjs` 가 공식 배포본을 받아 `resources/node/` 에 놓고,
electron-builder 의 `extraResources` 가 그것을 `Contents/Resources/node/` 로 싣는다.

버전은 **고정**한다(`v22.14.0`). "가장 새것"으로 두면 같은 커밋이 빌드할 때마다 다른 런타임을
싣고, 그 차이가 어디에도 안 남는다.

`resolveNodeRuntime()` 의 순서는 `HERMETRA_NODE` → 번들(`resourcesPath/node`) → PATH 다.
패키징된 앱이 사용자 기계의 아무 node 보다 **자기 것을 먼저 쓰게** 하는 순서이고, 셋 다 없으면
null 을 돌려주고 그 사실을 보고한다(앱이 죽지 않는다).

**asar 를 켜지 않는다.** 런처는 진짜 Node 로 도는데 Node 는 `app.asar` 를 아예 못 읽는다 —
`.node` 만 unpack 해서 될 일이 아니라 `camoufox-js` 의 JS 트리 전체가 밖에 있어야 한다. 전이
의존성을 `asarUnpack` 글롭으로 열거하는 것은 의존성이 하나 늘 때마다 조용히 깨진다.

검증(2026-08-10, darwin-arm64): `npm run pack` 산출물 안에서
`Contents/Resources/node/node` 가 `app/out/main/launcher.mjs` 를 돌려 Camoufox 가 떴다.
앱 크기 485MB(Electron + Node 104MB + 의존성).

| 아직 확인 못 한 것 | 무엇 |
|---|---|
| win32 · linux 패키징 | 스크립트는 `--platform`/`--arch` 를 받고 URL 규칙도 같지만 **darwin-arm64 만 실제로 돌려 봤다** |
| 코드 서명 · 공증 | `identity: null` 로 꺼 뒀다. 배포용 dmg 를 만들 때 함께 정한다 |
| 앱 아이콘 | 기본 Electron 아이콘이 쓰인다 |

Camoufox 바이너리(~150MB)는 여기 안 들어간다 — 이 앱이 Chromium 을 받는 것과 같은 방식으로
첫 실행에 받는다.

## `pipeline.automatch` — 셀렉터가 깨졌을 때 요소를 다시 찾는다

Scrapling 의 adaptive tracking 과 같은 두 단계다. 성공한 추출에서 요소의 신원을 적어 두고,
나중에 셀렉터가 아무것도 못 맞히면 페이지의 후보 전부를 그 지문과 대조해 점수를 매긴다.

**끝이 다르다.** 점수 매기기는 언제나 1등을 만들어 내므로 "가장 높은 것을 돌려준다" 는 규칙은
원하는 요소가 사라졌을 때 **엉뚱한 것을 조용히 끼워 넣는다.** 행을 적재하는 파이프라인에서는
틀린 채 조용한 것이 깨진 채 시끄러운 것보다 나쁘다. 그래서 재배치는 기준을 넘고 **2위와도
벌어져야** 채택되고, 아니면 사람에게 넘긴다 — 몰래 바꿔치지 않는다.

### 점수 (`WEIGHTS`)

한 곳에 선언한다. 분기마다 흩어진 상수로 만든 점수 함수는 논증할 수가 없고, 지금 보고 있는
케이스가 통과할 때까지 만지게 될 뿐이다. 순서가 곧 주장이며 근거는 "재배치에서 무엇이 살아
남는가" 다.

| 차원 | 가중 | 왜 |
|---|---|---|
| identity | .36 | `id`·`data-testid`·`name`·`aria-label` — 안정되라고 있는 속성. 가장 강한 증거 |
| text | .24 | 버튼은 전후로 "Buy" 다. 내용은 마크업보다 덜 움직인다 |
| classes | .14 | 가장 심하게 갈린다(유틸리티 CSS·CSS-in-JS). 참고는 되어도 결정하지 않는다 |
| path | .11 | 재배치가 부모를 계속 바꾼다. 꼬리 쪽만 의미가 있다 |
| tag | .10 | 링크는 링크로 남는다. 싸고 약하고 거의 항상 참 |
| position | .05 | 형제 중 순번. 동점 처리용이고 혼자서는 잡음이다 |

**증거 없음(`null`)과 불일치는 다르다.** 양쪽 다 `id` 가 없다면 그건 같은 요소인지에 대해
아무것도 말하지 않은 것이다. 일치로 치면 희박한 마크업의 점수가 부풀고, 중립 0.5 로 치면 더
나쁘다 — 그 차원의 가중이 조용히 깎여서 **스냅샷이 자기 자신과도 1점이 안 나온다.** 비교할
것이 없는 차원은 빠지고 나머지가 재정규화된다.

### 판정 (`relocate`)

| 결과 | 언제 |
|---|---|
| `exact` | 저장된 셀렉터가 아직 맞는다. 재배치 없음 |
| `relocated` | 기준(0.75) 이상이고 2위를 여유(0.08) 이상 앞섰다. 점수를 함께 보고한다 |
| `uncertain` | 기준 미달이거나 **2위와 구분이 안 된다.** 사람이 정한다 |
| `lost` | 바닥(0.4) 미만 — 닮은 것이 아예 없다 |

인수조건:

- `AC-pipeline.automatch-01` 같은 스냅샷끼리는 정확히 1점이다. 그렇지 않으면 척도가 뜻을 잃고
  임계값도 근거를 잃는다.
- `AC-pipeline.automatch-02` 점수는 대칭이다 — 비교 순서가 답을 바꾸지 못한다.
- `AC-pipeline.automatch-03` 강한 신호 하나가 나머지 전부의 반대를 이기지 못한다. `testid` 만
  같고 텍스트도 위치도 달라졌다면 그것은 **애매한 것이 맞다.**
- `AC-pipeline.automatch-04` 후보 둘이 똑같이 좋으면 **고르지 않는다.** 그건 매칭이 아니라
  동전 던지기다.
- `AC-pipeline.automatch-05` 후보가 없거나 전부 동떨어져도 던지지 않고 `lost` 로 보고한다.
- `AC-pipeline.automatch-06` 지문은 **성공한 추출에서만** 뜬다. 소급이 안 된다 — 그 실행이
  기록을 안 남겼으면 그 실행은 나중의 재배치에 기여할 수 없다.
- `AC-pipeline.automatch-07` 휘발성 속성은 지문에서 빠진다. `style`, 프레임워크 부기
  (`data-v-*`·`_ngcontent-*`), 생성된 클래스 토큰(`css-1x2y3z`·`Button_root__a1b2c`) —
  빌드마다 갈리므로 남기면 아무것도 안 바뀐 배포에서 지문이 자기와 어긋난다.
- `AC-pipeline.automatch-08` 요소의 텍스트는 **자기 것만** 센다. 컨테이너가 자손의 글자를
  자기 것으로 신고하면 지문이 그 컨테이너가 아니라 그 안의 내용이 된다.

### 아직 없는 것

지문을 **어디에 저장하는가**가 안 정해졌다. 추출 계층이 없어서다(소스·수집 화면이 아직
껍데기). 저장 자리가 생기면 `ElementFingerprint` 를 그 옆에 둔다 — 형식은 이미 정해져 있다.

## Service 규칙

- 다른 모듈과 마찬가지로 `modules/pipeline` 은 `modules/web`·`modules/mobile` 을 임포트하지
  않는다. 양쪽에 걸치는 코드가 생기면 `modules/bridge` 나 `shared/` 로 간다.
- 화면이 상태를 갖게 되면 모듈별 Zustand store 하나 + `channels.ts` 의 타입 박힌 채널로
  간다. 채널 문자열을 다른 곳에 쓰지 않는다 (`app.ipc`).
- 데이터가 생기면 워크스페이스 경계 안이다 (`app.tenancy`).

## 인수조건 (지금 지켜야 하는 것)

- `AC-pipeline-01` 여섯 화면이 각자의 `page-*` 컨테이너를 렌더한다. e2e 와 표면 어댑터가
  이 ID로 화면을 찾으므로, 없는 화면은 검증되지 않는 화면이다.
  구현: `src/renderer/modules/pipeline/pages/pipeline-pages.test.tsx`
- `AC-pipeline-02` 각 화면은 제목과 한 줄 부제로 **무엇이 여기 들어올지**를 말하고,
  아직 만들어지지 않았음을 분명히 적는다. 빈 화면을 고장으로 읽히게 두지 않는다.
- `AC-pipeline-03` 여섯 화면의 문자열은 `en`·`ko` 양쪽에 있다 (`app.i18n`).
- `AC-pipeline-04` 첫 화면(`/`)은 여기가 아니다. 전부 껍데기인 화면으로 앱이 뜨면 고장으로
  읽힌다 — `/bridge/scenarios` 유지.
- `AC-pipeline-05` `/pipeline` 로 들어오면 `/pipeline/jobs` 로 보낸다.

## 알려진 한계

- 여섯 화면 모두 동작이 없다. 이 폴더의 나머지 정본은 화면이 채워질 때 함께 쓴다.
- 커버리지 기준은 화면에 로직이 생길 때 잡는다. 지금은 렌더 테스트뿐이다.
