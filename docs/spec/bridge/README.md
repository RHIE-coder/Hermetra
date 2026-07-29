# `bridge` — 브리지 Service (UI 표시명 "브리지 / Bridge")

웹과 모바일을 잇는 계층. 이 제품이 웹 자동화 도구와 모바일 자동화 도구를 한 창에 담은
것에 그치지 않는 이유가 여기 있다.

> 표시명·라우트·채널·폴더·타입이 모두 `bridge` 다 (`../architecture.md` §7).

| Surface | ID | 라우트 | 정본 |
|---|---|---|---|
| 시나리오 | `bridge.scenarios` | `/bridge/scenarios` | `scenarios.md` |
| 변수 | `bridge.variables` | `/bridge/variables` | `variables.md` |
| 공유 버스 | `bridge.bus` | `/bridge/bus` | `bus.md` |
| 이벤트 | `bridge.events` | `/bridge/events` | `events.md` |

## Service 규칙

- 브리지의 세 부품(공유 버스 · 이벤트 버스 · 시나리오 오케스트레이터)은 **순수 로직**이다.
  fs 도 IPC 도 모르며 EventEmitter 로만 바깥과 말한다. 렌더러로 잇는 배선은
  `ipc/register.ts` 한 곳에만 있다.
- 공유 버스와 이벤트 이력은 **메모리에만** 있다. 앱을 끄면 비워진다 — 살아있는 상태를
  모델하는 것이고 기록이 아니다.
- 시나리오 정의는 워크스페이스의 `store.json` 에 남는다(정의는 자산, 실행 상태는 아니다).
- 웹·모바일 모듈이 서로를 임포트하지 못하므로, 두 쪽이 만나는 코드는 여기에만 둔다.

## 세 부품

| 부품 | 무엇 | 어디 |
|---|---|---|
| 공유 버스 (`VarBus`) | 키-값 하나를 양쪽 스크립트가 실시간으로 주고받는다 | `src/main/bridge/varBus.ts` |
| 이벤트 버스 (`BridgeEventBus`) | 한쪽의 사건을 반대쪽이 기다린다. 이력 최대 200건 | `src/main/bridge/eventBus.ts` |
| 오케스트레이터 (`ScenarioOrchestrator`) | 순서 있는 단계를 양쪽 드라이버로 돌린다 | `src/main/bridge/orchestrator.ts` |

## 커버리지 기준

이 폴더의 코드는 순수 함수라서 예외를 인정하지 않는다 — 라인·브랜치·함수·구문 모두
**95% 이상**이 CI 게이트다(현재 100%).
