# `bridge.events` — 이벤트

라우트 `/bridge/events` · 컨테이너 `page-bridge-events` · 사이드바 `nav-bridge-events`

한쪽에서 일어난 사건을 반대쪽이 기다리게 하는 통로. 이 화면은 그 사건 흐름을 시간순으로
보여 주고, 손으로 사건을 발행해 반대쪽 흐름을 시험하게 한다.

## 데이터 규칙 (도메인)

- 사건 하나는 `{ 식별자, 채널, 발생 쪽, 실린 값, 시각 }` 이다.
- 채널 이름은 이름공간으로 구분한다: `web.*` · `mobile.*` · `bridge.*`.
- 이력은 최대 **200건**이며, 넘으면 오래된 것부터 버린다.
- 발행하면 두 갈래로 알린다: 전체 구독(`event`)과 그 채널 구독(`<채널>`). 시나리오의
  대기가 후자를 쓴다.
- 특정 채널을 기다리는 대기는 기본 **30초** 뒤 시간 초과로 실패한다.
- 저장은 메모리뿐이다.

인수조건:

- `AC-bridge.events-01` 발행하면 식별자와 시각이 붙어 이력에 쌓인다.
- `AC-bridge.events-02` 200건을 넘기면 가장 오래된 것이 밀려난다.
- `AC-bridge.events-03` 채널 구독자는 그 채널의 사건만 받는다.
- `AC-bridge.events-04` 대기 중 사건이 오면 즉시 풀리고, 안 오면 시간 초과로 실패한다.
- `AC-bridge.events-05` 없는 식별자를 지우는 것은 이력을 바꾸지 않는다.

## `bridge.events.emit` — 사건 발행

채널 이름 입력과 발행 버튼.

- `AC-bridge.events.emit-01` 채널을 넣고 발행하면 타임라인 맨 앞(가장 최근)에 나타난다.
- `AC-bridge.events.emit-02` 이 화면에서 발행한 사건의 쪽은 `bridge` 다.

## `bridge.events.timeline` — 타임라인

채널·쪽·시각·값을 시간순으로 보인다. 항목별 삭제, 전체 비우기.

- `AC-bridge.events.timeline-01` 비어 있으면 빈 상태 문구를 보인다.
- `AC-bridge.events.timeline-02` 스크립트나 시나리오가 사건을 발행하면 이 목록이 즉시
  갱신된다(`EVT_BRIDGE_EVENT` 브로드캐스트).
- `AC-bridge.events.timeline-03` 항목을 지우면 그것만 사라진다.
- `AC-bridge.events.timeline-04` 전체 비우기를 누르면 목록이 빈다.

## 데이터·채널

`BRIDGE_EVENT_EMIT` · `BRIDGE_EVENT_HISTORY` · `BRIDGE_EVENT_REMOVE` ·
`BRIDGE_EVENT_CLEAR` · 통보 `EVT_BRIDGE_EVENT`

## 알려진 한계

- 이력이 메모리뿐이라 앱을 끄면 사라진다. 실행 기록을 남기려면 별도 기능이 필요하다.
- 채널 이름공간(`web.*` 등)은 규약일 뿐 코드가 강제하지 않는다.
- 실린 값에 크기 제한이 없다.
