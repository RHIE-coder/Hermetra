# `pipeline` — 데이터 파이프라인 Service (UI 표시명 "데이터 파이프라인 / Data Pipeline")

데이터를 **어디서 가져와(소스) · 어떻게 꺼내(수집) · 어떻게 바꾸고(처리) · 어디에 쌓고(저장소) ·
무엇을 읽어내는가(인사이트)** 를 다루는 계층. 그 다섯 단계를 하나로 이어 실행하고 지켜보는
자리가 작업(Jobs)이다.

단계를 **만드는** 자리는 여기가 아니다 — 브라우저 작업대는 2026-08-12 에 `studio` Service 로
갈라져 나갔다(`../studio/README.md`). 어느 단계에도 속하지 않는 것을 파이프라인 서랍에 두면
레일이 그것을 단계라고 말하게 된다.

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

**2026-08-12 기준, 여섯 화면 모두 비어 있다.** 각 화면은 라우트와 내비게이션과 `page-*`
컨테이너만 있고, 제목 · 한 줄 부제 · "아직 비어 있습니다" 카드 하나를 그린다
(`PipelinePlaceholder`).

작업(Jobs)도 그중 하나다. 2026-08-12 까지는 이 화면에 브라우저 작업대가 들어 있었지만, 그것은
어느 단계도 아니어서 `studio` 로 나갔다(`../studio/browser.md`). 나간 것은 **작업대**이고 `작업`
은 남는다 — 남아서 원래 약속한 것, 즉 **무엇이 언제 돌았나**를 채우게 된다(`jobs.md`).

이 순서로 만드는 이유는, 파이프라인의 **모양**(단계가 몇 개이고 무엇이라 불리는가)이 그 안의
어떤 기능보다 먼저 정해져야 하기 때문이다. 이름이 흔들리면 라우트·IPC 채널·testid 가 전부
따라 흔들린다 — 작업대를 옮기면서 `pipeline:*` 채널이 전부 `studio:*` 로 따라 움직인 것이 그
예다.

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
  구현: 다섯은 `pipeline-pages.test.tsx`, 작업은 `JobsPage.test.tsx`
- `AC-pipeline-02` **아직 안 만든** 화면은 제목과 한 줄 부제로 무엇이 여기 들어올지를 말하고,
  만들어지지 않았음을 분명히 적는다. 빈 화면을 고장으로 읽히게 두지 않는다. 작업 화면은 이제
  내용이 있으므로 여기서 빠진다.
- `AC-pipeline-03` 여섯 화면의 문자열은 `en`·`ko` 양쪽에 있다 (`app.i18n`).
- `AC-pipeline-04` 첫 화면(`/`)은 여기가 아니다. 전부 껍데기인 화면으로 앱이 뜨면 고장으로
  읽힌다 — `/bridge/scenarios` 유지.
- `AC-pipeline-05` `/pipeline` 로 들어오면 `/pipeline/jobs` 로 보낸다.

## 알려진 한계

- 창고 다섯(소스·수집·처리·저장소·인사이트)은 아직 동작이 없다. 각 정본은 그 화면이 채워질 때
  함께 쓴다.
- 단계가 스크립트를 참조하는 연결이 아직 없다. 작업대에서 직접 돌릴 뿐이다 — `jobs.md`.
