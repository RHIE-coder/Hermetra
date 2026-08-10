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
