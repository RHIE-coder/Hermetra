# 게이트 기록 — 2026-08-12 · sidecar-cjk-fonts

파이프라인 브라우저가 위장하는 OS 를 호스트의 OS 로 맞춘다. 화면 피드백
(`/pipeline/jobs`, 네이버가 전부 네모로 보임)에서 시작해 원인을 좇은 결과다.

| 슬롯 | 값 |
|---|---|
| 대상 | `src/main/sidecar/spoof.ts`, `index.ts`, `launcher.mjs` |
| 인수조건 | `AC-studio.sidecar-09` |
| 스펙 | `docs/spec/studio/README.md` — "위장 OS 는 호스트를 따른다" |

## 무엇이 문제였나

Camoufox 는 실행마다 OS 를 무작위로 골라 위장하고 폰트 집합을 그 OS 의 것으로 바꾸며
호스트의 진짜 폰트를 감춘다. 맥에서 윈도우를 주장하면 한글을 그릴 폰트가 없다. 무작위라
세 번에 한 번은 멀쩡해 보여서 변덕처럼 읽혔다.

## 폰트로 푸는 길이 왜 막혔나 (실측)

전부 Camoufox 를 실제로 띄워 스크린샷으로 판정했다. `覧録税択験払毎残内険` 은
`Noto Sans JP` 에 있고 `Noto Sans KR` 에 없어 어느 폰트가 쓰였는지 가리는 데 썼다.

| 시도 | 결과 |
|---|---|
| `font.name-list.<generic>.<lang>` 언어별 지정 | 무시. `lang="ja"` 페이지가 한글은 그리고 한자는 깨뜨림 → 한글 폰트를 씀 |
| 목록에 여러 폰트 나열 (`KR, SC` / `SC, KR`) | 글자 단위 폴백 없음. 첫 폰트만 쓰고 멈춤. 순서 무관하게 동일 |
| 번들 폰트만으로 CJK 전체 덮기 | 불가. 한글 100% 는 KR 뿐(한자 38.9%), 한자 100% 는 SC 뿐(한글 0%) |
| `Noto Sans CJK KR` (16MB, 전부 덮음) 를 폰트 폴더에 추가 | 등록 안 됨. 이름 표기 4가지 모두 실패. 같은 페이지에서 기존 번들 폰트는 정상 → 폰트 집합은 Camoufox 빌드 시점 고정 |

원인 하나가 더 잡혔다: 언어별 지정이 무시된 것은 브라우저가 **로케일** 로 언어 그룹을 정하기
때문이다. 이 호스트가 한국어 로케일이라 페이지 언어와 무관하게 `ko` 그룹이 쓰였다.

## 검증

앱의 실제 경로로 확인했다 — `launcher.mjs` 를 감독자와 같은 방식으로 spawn 하고,
stdout 의 주소로 붙었다. `launchServer` 만 직접 부르는 확인은 배선을 건너뛴다.

```
hostSpoofOs() = macos
[sidecar] starting camoufox (headless=true, os=macos)
UA: Macintosh; Intel Mac OS X 10.15; rv:152.0
```

| 대상 | 이전 (윈도우 위장) | 이후 |
|---|---|---|
| 한글·가나·간체·번체·JP전용한자 (7행) | 부분~전부 네모 | 전부 정상 |
| naver.com | 본문 텍스트 전부 네모 | 정상 |
| yahoo.co.jp | `□省の□□`, `危■警報`, `一■` | `帰省の渋滞`, `危険警報`, `一覧` |
| news.sina.com.cn | — | 정상 |

## 게이트

| 명령 | 결과 |
|---|---|
| `npm run check` (typecheck·lint·test·build) | PASS — 43 files, 593 tests |
| `npm run test:e2e` | PASS — 19 passed |
| `npm run sweep` | PASS — tokens·imports·i18n·ledger·coverage 5/5 |

UI 게이트는 해당 없음: `src/renderer/**` 를 건드리지 않았다.

## 남는 것

- 위장의 **OS 축 하나**를 잃는다. 화면·캔버스·WebGL·오디오·UA 버전 무작위화는 유지된다.
  맞바꾼 대가는 사용자가 알고 선택했다.
- 확인은 **macOS 호스트에서만** 했다. 윈도우·리눅스 호스트는 추론이다 — 그쪽은 그 OS 의
  진짜 폰트를 쓰게 되므로 유리한 방향이지만, 실측은 아니다.
- 일본어·중국어 사이트는 첫 화면만 봤다. 로그인 뒤 화면까지 훑지 않았다.
