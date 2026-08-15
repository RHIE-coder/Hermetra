# `studio` — 스튜디오 Service (UI 표시명 "스튜디오 / Studio")

파이프라인이 **재료 창고**라면 스튜디오는 그 재료를 **만드는 자리**다. 어느 단계에도 속하지
않는다 — 브라우저를 열고 · 로그인하고 · 목록을 긁고 · 숫자를 정리하는 한 줄기는 네 단계에
동시에 걸치기 때문이다.

> 표시명·라우트·폴더·testid 가 모두 `studio` 다 — 브리지·파이프라인이 잡아 둔 규칙과 같다
> (`../architecture.md` §7).

| Surface | ID | 라우트 | testid | 정본 |
|---|---|---|---|---|
| 브라우저 작업대 | `studio.browser` | `/studio/browser` | `nav-studio-browser` / `page-studio-browser` | `browser.md` |

## 지금 상태 — 화면 하나

**2026-08-12 기준 화면은 하나다.** 서랍인 것은 지금 하나뿐이기 때문이지 하나여야 하기
때문이 아니다: 레거시의 `웹 > 스크립트` · `모바일 > 스크립트` 도 같은 성격의 작업대라, 언젠가
여기로 모이면 레거시가 줄어든다.

이 Service 는 2026-08-12 에 `pipeline` 에서 갈라져 나왔다. 작업대가 파이프라인 서랍 안에 있는
동안 레일은 그것을 **단계 중 하나라고 말하고** 있었고, `작업` 이라는 이름은 파이프라인에 필요한
실행 이력을 약속해 놓고 작업대에게 내주고 있었다. 갈라진 뒤 `작업`(`pipeline.jobs`)은 파이프라인
안에 남아 원래 약속으로 돌아간다.

## `studio.sidecar` — 브라우저는 앱 밖에서 뜬다

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
     │                        │  (better-sqlite3 · impit 이 여기 갇힌다)
     └── JSON 라인 (stdin/stdout) ┘  탭 · 이동 · 스크립트 실행 · 로그
                              │
                              └── playwright firefox.connect(ws://…) ── 브라우저를 쥔다
```

부수 효과가 둘 더 있고, 둘 다 원래 필요했던 것이다: 수집을 **병렬로 돌리고 스케줄링** 하려면
어차피 프로세스가 따로 있어야 하고, 브라우저가 죽어도 앱이 안 죽는다.

### 계약 — stdout 은 JSON 라인이다

사이드카는 브라우저를 띄우고 **거기서 멈추지 않는다.** 브라우저를 쥐고 있는 것도, 사용자
스크립트를 돌리는 것도 이쪽이다(`browser.md` `studio.session` 이 그 이유를 실측으로 적는다).
그래서 stdout 이 주소 한 줄로는 부족해졌고, 대신 **한 줄에 JSON 하나**가 규칙이다.

| 방향 | 프레임 | 무엇 |
|---|---|---|
| → 사이드카 (stdin) | `{"id":n,"op":"pages"\|"navigate"\|"new-tab"\|"close-page"\|"set-active"\|"run"}` | 요청 하나 |
| ← 메인 (stdout) | `{"t":"ready","endpoint":"ws://…"}` | 브라우저가 섰다. 한 번 |
| | `{"t":"reply","id":n,"ok":…}` | 그 요청의 답 |
| | `{"t":"log","runId":…,"level":…,"text":…}` | 도는 스크립트의 한 줄, 나오는 대로 |

stderr 는 그대로 사람이 읽는 진행 상황이다. **형식을 섞지 않는 것이 요점이다** — 수다스러운
의존성이 프레임으로 오인되지 않게 하는 유일한 방법이고, 파싱 못 하는 줄은 잡음으로 버린다.

- SIGTERM 을 받으면 브라우저를 닫고 0 으로 끝난다.

인수조건:

- `AC-studio.sidecar-01` stdout 은 조각으로 온다. 프레임이 두 청크에 걸쳐 와도, 한 청크에 두
  줄이 와도 감독자는 **완전한 줄만** 본다. JSON 이 아닌 줄은 버린다.
- `AC-studio.sidecar-02` 자식이 스스로 죽으면 `crashed` 가 되고 **왜 죽었는지**가 남는다.
  재시작은 백오프(1s·2s·4s…)로 예약된다.
- `AC-studio.sidecar-03` `ready` 에 도달하면 재시작 횟수가 **0으로 돌아간다.** 회복한
  사이드카가 영원히 포기 직전 상태로 남으면 안 된다.
- `AC-studio.sidecar-04` `maxRestarts` 를 넘기면 **포기한다.** 크래시 루프는 머신을 태우고
  진짜 원인을 가린다. 포기는 상태이지 처리 실패가 아니다.
- `AC-studio.sidecar-05` 사람이 멈춘 것과 죽은 것을 가른다 — `stop()` 뒤의 종료는
  `stopped` 이고 재시작하지 않는다. 예약된 재시작도 취소한다.
- `AC-studio.sidecar-06` spawn 자체가 실패해도(런타임 없음·런처 없음) **죽음으로 보고된다.**
  오지 않을 주소를 기다리지 않는다.
- `AC-studio.sidecar-07` 앱이 종료하면 사이드카도 종료한다. 살아남은 사이드카는 포트를 쥔
  고아 브라우저다.
- `AC-studio.sidecar-08` 앱이 뜰 때 자동으로 시작하지 **않는다.** 그 화면을 안 여는
  사용자에게 스텔스 브라우저는 순수 비용이다.
- `AC-studio.sidecar-09` 브라우저가 **주장하는 OS 는 호스트의 OS 다.** Camoufox 가 매
  실행마다 무작위로 고르게 두지 않는다 — 이유는 아래.

### 위장 OS 는 호스트를 따른다

Camoufox 는 실행마다 OS 를 하나 골라 위장하고, **폰트 집합을 통째로 그 OS 의 것으로 바꾸며
호스트의 진짜 폰트를 감춘다.** 지문 방어의 핵심이지만 CJK 가 그 대가를 치른다: 맥에서 윈도우를
주장하면 한글을 그릴 수 있는 폰트가 하나도 없어 네이버가 네모로 나온다. 고르는 게 무작위라 세 번에
한 번은 멀쩡해 보이고, 그래서 고장이 아니라 변덕으로 읽힌다.

폰트를 넣어주는 방식은 **안 된다.** 실측:

| 시도 | 결과 |
|---|---|
| `font.name-list.<generic>.<lang>` 로 언어별 지정 | **무시된다.** `lang="ja"` 페이지가 한글 폰트를 쓴다 — 한자는 깨지고 한글은 나온다 |
| 목록에 여러 폰트를 나열 | **글자 단위 폴백이 없다.** 존재하는 첫 폰트 하나를 쓰고 멈춘다. 순서를 뒤집어도 같다 |
| 번들 폰트로 CJK 전체 덮기 | **덮는 폰트가 없다.** 한글은 `Noto Sans KR` 에만(CJK 통합한자 38.9%), 한자 100% 는 `Noto Sans SC` 에만(한글 0%) |
| 통합 CJK 폰트를 폰트 폴더에 추가 | **등록되지 않는다.** 이름 표기 4가지 모두 실패, 같은 페이지에서 기존 번들 폰트는 정상 |

그래서 남는 레버가 OS 하나다. 호스트와 맞추면 **호스트의 진짜 폰트가 쓰이므로** 한글·가나·간체·번체가
전부 나온다 — macOS 에서 네이버·야후재팬·시나 실측 확인.

잃는 것은 위장의 **OS 축 하나뿐**이다. 화면·캔버스·WebGL·오디오·UA 버전은 그대로 매 실행 무작위다.
그리고 이건 모순을 하나 **없애는** 쪽이기도 하다 — 맥에서 렌더링·측정·합성하면서 윈도우라고 주장하는
브라우저는 그 자체로 눈에 띄고, 네모는 그 불일치가 눈에 보이게 드러난 증상이었다.

Camoufox 가 폰트 집합을 갖지 않은 플랫폼(freebsd 등)에서는 **아무것도 주장하지 않는다.** 무작위
선택이 그대로 남고, 이는 예전 동작이다 — 이 머신에 없는 폰트의 OS 를 주장하는 것보다 낫다.

### 배포 — Node 를 함께 싣는다

`process.execPath` 는 Electron 이라 못 쓴다(위 표). 그래서 **Node 바이너리가 앱과 함께
실린다.** `scripts/bundle-node.mjs` 가 공식 배포본을 받아 `resources/node/` 에 놓고,
electron-builder 의 `extraResources` 가 그것을 `Contents/Resources/node/` 로 싣는다.

버전은 **고정**한다(`v24.19.0`). "가장 새것"으로 두면 같은 커밋이 빌드할 때마다 다른 런타임을
싣고, 그 차이가 어디에도 안 남는다.

고정값은 아무 LTS 가 아니다. **`.ts` 타입 스트리핑이 기본으로 켜진 런타임이어야 한다** —
사용자 스크립트가 TypeScript 인 채로 `import` 되는 것이 작업대의 계약이기 때문이다
(`browser.md` `AC-studio.browser-21`). 22.14 에는 그 기능이 없었고, 그래서 이 버전은 취향이
아니라 요구다. 트랜스파일러를 하나 더 싣는 대신 런타임이 하는 일을 쓴다.

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

### Camoufox 도 함께 싣는다 (2026-08-11 변경)

**받아서 쓰는 것이 아니라 앱과 함께 실린다.** 처음에는 "첫 실행에 받는다" 로 두었는데, 실측해
보니 그 경로가 아예 없다 — `camoufox-js` 는 없으면 받아 주지 않고 그냥 던진다:

```
[sidecar] failed: FileNotFoundError: Version information not found at
          ~/Library/Caches/camoufox/version.json. Please run `camoufox fetch` to install.
```

그래서 설치한 사람이 "브라우저 켜기" 를 누르면 아무 말 없이 실패한다. 실을 수밖에 없다.

`scripts/bundle-camoufox.mjs` 가 `camoufox-js fetch` 를 `CAMOUFOX_INSTALL_DIR` 를
`resources/camoufox/` 로 돌려서 부르고, electron-builder 의 `extraResources` 가 그것을
`Contents/Resources/camoufox/` 로 싣는다. 릴리스 zip 을 손으로 풀지 않는 이유는, 라이브러리가
믿는 레이아웃(`Camoufox.app` + `GeoLite2-City.mmdb` + `version.json`)의 규칙이 저쪽에 있고
여기서 재현하면 규칙이 두 곳에 사는 것이기 때문이다.

`resolveCamoufoxDir()` 의 순서는 `CAMOUFOX_INSTALL_DIR` → 번들(`resourcesPath/camoufox`) →
**null** 이다. null 이 세 번째 답이고 좋은 답이다 — 변수를 안 걸면 `camoufox-js` 가 자기
캐시를 쓰고, 그게 `npm run dev` 체크아웃이 원하는 것이다. 디렉터리로 인정하는 기준은
`version.json` 이다. 중간에 죽은 스테이징이 남긴 빈 폴더를 가리키는 것은 아무것도 안 가리키는
것보다 나쁘다 — 설치된 것으로 읽히고 기동에서 실패한다.

**대가는 크기다.** 실측 717MB(폰트만 362MB)이고 앱이 463MB → **1.2GB** 가 된다. 폰트는
지문의 일부라 덜어내면 Camoufox 를 쓸 이유가 없어진다. 스테이징을 건너뛰면(= `bundle:camoufox`
를 안 돌리면) 앱은 작아지고 사용자 캐시로 떨어지지만, 캐시가 없는 기계에서는 위 오류가 난다.

**호스트 플랫폼만 스테이징된다.** 페처가 도는 OS 의 릴리스를 고르므로 mac 에서 Windows 용을
만들 수 없다. `bundle-node.mjs` 와 다른 점이고, win32·linux 패키징이 아직 미확인인 것과 같은
한계다.

검증(2026-08-11, darwin-arm64): 사용자 캐시를 치워 둔 상태에서 패키징된
`Contents/Resources/node/node` 가 패키징된 `launcher.mjs` 를 돌려 **번들된 Camoufox 로** 기동,
`WS ws://…` 출력, SIGTERM 정상 종료. 앱 1.2GB.

