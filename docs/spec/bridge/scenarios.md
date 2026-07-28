# `bridge.scenarios` — 시나리오

라우트 `/bridge/scenarios` · 컨테이너 `page-bridge-scenarios` ·
사이드바 `nav-bridge-scenarios`

웹과 모바일을 넘나드는 순서 있는 흐름을 정의하고 돌린다. 이 제품의 목적이 여기서 형태를
갖춘다: 웹에서 로그인하고, 그 사실을 모바일이 기다렸다가 OTP 를 확인하는 식.

## 데이터 규칙 (도메인)

시나리오 하나는 `{ 식별자, 이름, 단계[] }` 이고, 단계 하나는
`{ 식별자, 실행 쪽, 이름, 스크립트 경로, 기다릴 사건?, 발행할 사건? }` 이다.
실행 쪽은 `web` · `mobile` · `both` 중 하나다.

정의는 워크스페이스의 `store.json` 의 `scenarios[]` 에 남는다. 새 워크스페이스에는
웹 로그인 → 모바일 OTP 예시 시나리오가 하나 들어 있다.

## 실행 규칙 (오케스트레이터)

- 단계는 **정의 순서대로 하나씩** 실행한다.
- 각 단계는 시작할 때 실행 중을, 끝날 때 완료를 통보한다.
- `기다릴 사건` 이 있으면 그 사건이 올 때까지 그 단계에서 멈춘다(기본 30초, 넘으면 실패).
- `발행할 사건` 이 있으면 그 단계가 성공한 뒤 `bridge` 쪽 사건으로 발행한다.
- `both` 단계는 웹과 모바일을 **동시에** 돌리고 둘 다 끝나야 완료다.
- 한 단계가 실패하면 그 단계를 실패로 기록하고 **남은 단계를 돌리지 않는다**.
- 중지하면 진행 중 실행이 중단되고, 그 뒤의 단계는 "건너뜀(중단)"으로 기록된다.
- 같은 실행을 두 번 중지하면 두 번째는 아무 일도 하지 않는다.

인수조건:

- `AC-bridge.scenarios-01` 두 단계 시나리오를 돌리면 첫 단계 완료가 두 번째 시작보다
  앞선다.
- `AC-bridge.scenarios-02` 실패한 단계 뒤의 단계는 실행되지 않는다.
- `AC-bridge.scenarios-03` 실패 메시지는 예외가 아닌 값을 던져도 문자열로 기록된다.
- `AC-bridge.scenarios-04` 발행할 사건이 지정된 단계가 끝나면 그 채널로 사건이 나간다.
- `AC-bridge.scenarios-05` `both` 단계는 양쪽 드라이버를 각각 한 번 부른다.
- `AC-bridge.scenarios-06` 중지 후 남은 단계는 건너뜀으로 기록되고 그 쪽 드라이버는
  불리지 않는다.
- `AC-bridge.scenarios-07` 실행 쪽이 세 값 중 아무것도 아니면 드라이버를 부르지 않고
  완료로 넘어간다(손으로 고친 저장 파일에 대한 관용).
- `AC-bridge.scenarios-08` 없는 시나리오를 돌리려 하면 오류가 된다.

## `bridge.scenarios.list` — 시나리오 목록

- `AC-bridge.scenarios.list-01` 저장된 시나리오를 모두 보인다. 고르면 우측에 단계가
  펼쳐진다.
- `AC-bridge.scenarios.list-02` 고른 것이 없으면 안내 문구를 보인다.
- `AC-bridge.scenarios.list-03` 삭제는 확인을 받은 뒤 지운다. 없는 것을 지우면 목록이
  그대로다.

## `bridge.scenarios.steps` — 단계 패널

각 단계의 실행 쪽·이름·스크립트 경로와, 기다릴/발행할 사건 표식.

- `AC-bridge.scenarios.steps-01` 기다릴 사건과 발행할 사건이 각각 표식으로 구분된다.
- `AC-bridge.scenarios.steps-02` 실행 중에는 각 단계가 실행 중/완료/실패/건너뜀 중 하나로
  보인다(`EVT_SCENARIO_UPDATE` 브로드캐스트).

## `bridge.scenarios.run` — 실행 제어

- `AC-bridge.scenarios.run-01` 실행을 누르면 실행 식별자가 만들어지고 진행 상태가 흐른다.
- `AC-bridge.scenarios.run-02` 실행 중에는 중지 버튼이 보인다.
- `AC-bridge.scenarios.run-03` 실행 로그가 단계별로 쌓인다.

## 데이터·채널

`BRIDGE_SCENARIO_LIST` · `BRIDGE_SCENARIO_SAVE` · `BRIDGE_SCENARIO_DELETE` ·
`BRIDGE_SCENARIO_RUN` · `BRIDGE_SCENARIO_STOP` · 통보 `EVT_SCENARIO_UPDATE`

## 알려진 한계

- **스크립트 경로는 아직 실행에 쓰이지 않는다.** 오케스트레이터는 경로를 주석 한 줄로
  감싼 자리표시자 원문을 드라이버에 넘긴다. 진짜 파일을 읽어 넘기는 것은 미구현이다.
- 화면에서 시나리오를 새로 만들거나 단계를 편집하는 UI 가 없다. 저장 채널은 있으므로
  파일을 직접 고치거나 다른 경로로 저장해야 한다.
- 중지는 진행 중인 드라이버 호출 자체를 취소하지 않는다. 그 호출이 끝난 뒤 남은 단계가
  건너뜀으로 처리된다.
- 실행 이력은 메모리에만 남는다.
