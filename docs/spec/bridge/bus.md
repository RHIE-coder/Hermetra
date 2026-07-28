# `bridge.bus` — 공유 버스

라우트 `/bridge/bus` · 컨테이너 `page-bridge-bus` · 사이드바 `nav-bridge-bus`

웹 스크립트가 쓴 값을 모바일 스크립트가 즉시 읽는 통로. 이 화면은 그 버스를 눈으로 보고
손으로 찔러보는 자리다.

## 데이터 규칙 (도메인)

- 항목 하나는 `{ 키, 값, 갱신 시각, 갱신 주체 }` 다. 갱신 주체는 `web`·`mobile`·`bridge`
  중 하나다.
- 같은 키에 쓰면 **덮어쓴다**. 이력은 남지 않는다.
- 목록은 항상 키 알파벳 순으로 정렬해 돌려준다.
- 저장은 **메모리뿐**이다. 앱을 끄면 사라진다.

인수조건:

- `AC-bridge.bus-01` 값을 쓰면 갱신 시각과 주체가 함께 기록된다.
- `AC-bridge.bus-02` 같은 키에 다시 쓰면 항목이 하나로 유지되고 값만 바뀐다.
- `AC-bridge.bus-03` 목록은 키 순으로 정렬된다.
- `AC-bridge.bus-04` 없는 키를 읽으면 없음이 돌아온다(오류가 아니다).
- `AC-bridge.bus-05` 없는 키를 지우는 것은 목록을 바꾸지 않는다.
- `AC-bridge.bus-06` 비우면 목록이 빈다.
- `AC-bridge.bus-07` 쓰기·비우기·지우기는 각각 구독자에게 통보된다.

## `bridge.bus.write` — 값 저장

키·값 입력과 저장 버튼.

- `AC-bridge.bus.write-01` 키와 값을 넣고 저장하면 아래 목록에 즉시 나타난다.
- `AC-bridge.bus.write-02` 이 화면에서 쓴 값의 주체는 `bridge` 다.

## `bridge.bus.snapshot` — 현재 버스

키 / 값 / 갱신 주체 / 갱신 시각 4열 표. 항목별 삭제, 전체 비우기.

- `AC-bridge.bus.snapshot-01` 비어 있으면 빈 상태 문구를 보인다.
- `AC-bridge.bus.snapshot-02` 다른 쪽(스크립트 실행 등)이 값을 쓰면 이 표가 즉시 갱신된다
  (`EVT_BUS_UPDATE` 브로드캐스트).
- `AC-bridge.bus.snapshot-03` 항목을 지우면 그 행만 사라진다.
- `AC-bridge.bus.snapshot-04` 전체 비우기를 누르면 표가 빈 상태가 된다.

## 데이터·채널

`BRIDGE_BUS_GET` · `BRIDGE_BUS_SET` · `BRIDGE_BUS_LIST` · `BRIDGE_BUS_CLEAR` ·
`BRIDGE_BUS_REMOVE` · 통보 `EVT_BUS_UPDATE`

## 알려진 한계

- 값은 문자열만이다. 구조체를 넣으려면 스크립트가 직렬화해야 한다.
- 항목 수 상한이 없다.
- 워크스페이스를 전환해도 버스는 비워지지 않는다(프로세스 하나에 버스 하나).
