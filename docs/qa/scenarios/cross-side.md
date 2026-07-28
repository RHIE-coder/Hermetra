# TestScenario: 교차 흐름 (골든 패스)

이 제품이 존재하는 이유 그 자체를 검증하는 길 — 웹 쪽 일이 모바일 쪽 일을 깨우는 것.
한 층에서 다 볼 수 없는 흐름이라 단위와 e2e 를 나눠 덮는다.

덮는 정본: `docs/spec/bridge/*` · `docs/spec/architecture.md`

## TestSuite: `cross.handoff` — 웹 → 모바일 인계

골든 패스 정의:

```
1. 웹 스크립트가 공유 버스에 값을 쓴다           bus.set('orderId', ...)
2. 웹 단계가 사건을 발행한다                     emits: login.completed
3. 모바일 단계가 그 사건을 기다리다 풀린다        waitFor: login.completed
4. 모바일 스크립트가 버스에서 그 값을 읽는다      bus.get('orderId')
5. 시나리오가 완료로 끝난다
```

| Case | 무엇 | 덮는 노드 | 계층 | 구현 |
|---|---|---|---|---|
| CASE-cross-001 | 발행한 사건이 기다리던 단계를 풀어 준다 | `bridge.scenarios` · `bridge.events` | 단위 | `tests/unit/orchestrator.test.ts` + `tests/unit/eventBus.test.ts` |
| CASE-cross-002 | 한쪽이 쓴 버스 값을 반대쪽이 읽는다 | `bridge.bus` | 단위 | `tests/unit/varBus.test.ts` |
| CASE-cross-003 | 기다리는 사건이 안 오면 그 단계가 시간 초과로 실패하고 뒤가 멈춘다 | `bridge.scenarios` | 단위 | `tests/unit/orchestrator.test.ts` |
| CASE-cross-004 | 예시 시나리오(웹 로그인 → 모바일 OTP)가 새 워크스페이스에 있다 | `bridge.scenarios` | 스키마 | `tests/schema/storage.test.ts` |
| CASE-cross-005 | 실제 앱에서 버스에 값을 쓰면 상단 카운터와 표가 함께 움직인다 | `bridge.bus` · `app.shell.topbar` | E2E | 미구현 |
| CASE-cross-006 | 실제 앱에서 시나리오를 끝까지 돌려 완료 상태를 본다 (mock 드라이버) | `bridge.scenarios` | E2E | 미구현 |

## 주의

CASE-cross-005·006 이 이 제품의 **가장 값진 회귀**다. 지금은 각 조각이 단위로만 덮여 있고,
"앱을 켜서 끝까지 지나가는" 검증은 스모크(화면 이동)까지다.
`coverage-gaps.md` 의 `gap-golden-path` 를 본다.
