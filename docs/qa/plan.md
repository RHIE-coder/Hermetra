# TestPlan — Hermetra

이 제품에서 "깨지면 안 되는 것"의 정본이다. 테스트 코드가 아니라 **무엇을 왜 검증하는가**.

## 전략

Hermetra 는 외부 도구(Chromium · Appium · 실기기)를 몰고 다니는 앱이다. 그래서 검증
전략의 축은 하나다: **도구 없이도 제품 전체가 검증되어야 한다.** mock 드라이버가 기본인
이유이자, e2e 가 CI 에서 도는 이유다. 실물 도구가 필요한 검증은 따로 갈라
`coverage-gaps.md` 에 전제와 함께 적는다.

두 번째 축은 **경계에서 잡는다**: 순수 도메인 로직(브리지 3부품·파서)은 단위에서, 저장
형식은 스키마에서, 정책은 IPC 핸들러에서, 화면 동작은 컴포넌트에서, 사람이 실제로 지나는
길은 e2e 에서 잡는다. 같은 것을 여러 층에서 반복하지 않는다.

## 계층 (5층)

| 계층 | 위치 | 러너 | 무엇을 잡나 |
|---|---|---|---|
| 도메인 단위 | `tests/unit/**` | Vitest (node) | 버스·오케스트레이터·파서의 규칙 |
| 스키마 | `tests/schema/**` | Vitest (node) | 저장 파일의 형태와 관용(깨진 파일·낡은 필드) |
| API (IPC) | `tests/api/**` | Vitest (node) | 채널 하나의 입출력과 부작용 |
| UI 컴포넌트 | `src/renderer/**/*.test.tsx` | Vitest + RTL + happy-dom | 화면 하나의 동작 (IPC 는 흉내) |
| E2E | `tests/e2e/**` | Playwright (Electron) | 실제 앱이 뜨고 사람이 지나는 길 |

## 실행

| 무엇 | 명령 |
|---|---|
| 단위·스키마·API·컴포넌트 | `npm run test` |
| E2E (Electron, mock 드라이버) | `npm run test:e2e` |
| 커버리지 임계 | `npm run test:coverage` |
| 전체 게이트 | `npm run check` (타입 · lint · 테스트 · 빌드) |
| 드리프트 검사 | `npm run sweep` (토큰 · 계층 임포트 · i18n 짝 · 커버리지 · immunity) |

회차 기록은 `runs/` 에 추가만 한다. 양식은 `runs/README.md`.

## 임계값

| 대상 | 기준 | 근거 |
|---|---|---|
| `src/main/bridge/**` | 라인·브랜치·함수·구문 95% (현재 100%) | 순수 함수다. 못 덮을 이유가 없다 |
| IPC 핸들러 | 채널마다 성공 1 + 실패 1 | 실패 경로가 사용자에게 보이는 오류의 원천 |
| UI 컴포넌트 | 동작 기준. 픽셀은 세지 않는다 | 픽셀 비교는 흔들리고, 흔들리는 게이트는 무시된다 |
| E2E | 스모크 + 골든 패스 2~3 | 개수가 아니라 "길이 살아 있나"가 목적 |

## 규율 (어기면 테스트가 거짓말을 한다)

- **결정론** — 시간·순서를 검증할 땐 가짜 타이머를 쓰고 정리한다.
- **멱등** — 파일을 만지는 테스트는 임시 디렉터리에만 쓰고 `afterEach` 에서 치운다.
  사용자의 실제 워크스페이스는 절대 건드리지 않는다.
- **e2e 는 mock 만** — 실물 드라이버를 요구하는 e2e 를 만들지 않는다.
- **UI 테스트는 IPC 를 흉내낸다** — 컴포넌트가 실제 채널을 부르지 않는다.

## 트리

| TestScenario | 문서 | 덮는 Service |
|---|---|---|
| 스튜디오 (브라우저 작업대) | `scenarios/studio.md` | `studio` |
| 데이터 파이프라인 | `scenarios/pipeline.md` | `pipeline` |
| 웹 자동화 | `scenarios/web.md` | `web` |
| 모바일 자동화 | `scenarios/mobile.md` | `mobile` |
| 브리지 | `scenarios/bridge.md` | `bridge` |
| 워크스페이스·셸 | `scenarios/workspace.md` | `workspace` · `app` |
| 교차 흐름 (골든 패스) | `scenarios/cross-side.md` | 전 Service |
| 화면 피드백 도구 (개발 전용) | `scenarios/tools-dev-feedback.md` | `tools` |

의도적으로 안 덮는 것과 아직 안 쓴 것: `coverage-gaps.md`.
