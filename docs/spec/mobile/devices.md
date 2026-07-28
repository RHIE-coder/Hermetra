# `mobile.devices` — 디바이스

라우트 `/mobile/devices` · 컨테이너 `page-mobile-devices` · 사이드바 `nav-mobile-devices`

기기를 찾고, 내 기기로 등록하고, 그 기기를 어떤 설정으로 쓸지 정하는 화면.
탭 두 개로 갈린다: **기기 관리**(`devices-tab-management`, 처음 열리는 탭) ·
**연결 구성**(`devices-tab-connection`).

## `mobile.devices.tooling` — 도구 상태

헤더 옆 아이콘(`tooling-status-badge`). 호버하면 도구 카드가 오버레이로 뜬다
(`tooling-status-overlay`).

- `AC-mobile.devices.tooling-01` 도구가 모두 갖춰지면 정상 아이콘, 하나라도 없으면 경고
  아이콘을 보인다(색은 디자인 토큰).
- `AC-mobile.devices.tooling-02` 오버레이는 도구별 설치 여부를 개별로 보인다.

## `mobile.devices.server` — Appium 서버

내장 서버 시작/중지, 또는 외부 서버 주소로 연결/해제.

- `AC-mobile.devices.server-01` 서버가 돌면 실행 중, 아니면 중지 상태를 보인다. 상태는
  브로드캐스트(`EVT_APPIUM_UPDATE`)로 갱신된다.
- `AC-mobile.devices.server-02` 외부 서버에 연결하면 그 주소가 표시되고, 해제하면
  돌아온다.
- `AC-mobile.devices.server-03` 내장 실행과 외부 연결은 동시에 유효하지 않다.

## `mobile.devices.live` — 실시간 연결

지금 붙어 있는 기기 목록. 5초 폴링으로 갱신된다.

- `AC-mobile.devices.live-01` 기기가 붙거나 빠지면 최대 5초 안에 목록이 바뀐다
  (`EVT_DEVICE_UPDATE`). 목록 내용이 그대로면 통보하지 않는다.
- `AC-mobile.devices.live-02` 기기가 없으면 빈 상태 문구를 보인다.
- `AC-mobile.devices.live-03` 감지된 기기의 UDID 가 내 디바이스의 항목과 같으면
  그 항목의 마지막 연결 시각이 갱신된다.
- `AC-mobile.devices.live-04` 감지된 기기를 내 디바이스로 저장할 수 있다.

## `mobile.devices.my` — 내 디바이스

`my-devices-list`. 사용자가 명시적으로 저장한 기기. **전역** 저장
(`<userData>/devices.json`).

- `AC-mobile.devices.my-01` 파일이 없으면 빈 목록으로 자동 생성한다. 파일이 깨져 있으면
  빈 목록으로 되돌린다(앱은 죽지 않는다).
- `AC-mobile.devices.my-02` 저장하면 목록에 즉시 나타나고 앱을 다시 켜도 남아 있다.
- `AC-mobile.devices.my-03` 같은 id 로 저장하면 덮어쓴다.
- `AC-mobile.devices.my-04` 삭제하면 목록과 파일에서 사라진다. 없는 id 를 지우는 것은
  아무 일도 하지 않는다.
- `AC-mobile.devices.my-05` 각 항목은 지금 실제로 붙어 있는지에 따라 연결됨/연결안됨을
  보인다(UDID 대조).
- `AC-mobile.devices.my-06` 항목을 고르면 우측 상세 패널이 그 기기를 보인다.

## `mobile.devices.detail` — 기기 상세

`device-detail-panel`. 탭 두 개: 정보(`device-detail-tab-info`) ·
앱(`device-detail-tab-apps`).

- `AC-mobile.devices.detail-01` 정보 탭은 이름·UDID·플랫폼·마지막 연결 시각을 보인다.
- `AC-mobile.devices.detail-02` 별칭을 입력하고 포커스를 잃으면 저장되고 다음 렌더에
  반영된다. 별칭을 비우면 별칭이 지워진다.
- `AC-mobile.devices.detail-03` 앱 탭을 열면 그 기기에 설치된 앱을 조회해 보인다.
- `AC-mobile.devices.detail-04` 검색 입력의 부분 문자열로 즉시 걸러진다(대소문자 무시).
- `AC-mobile.devices.detail-05` 새로고침을 누르면 다시 조회한다.
- `AC-mobile.devices.detail-06` 앱이 없으면 빈 상태 문구를, 조회 중이면 조회 중 문구를
  보인다.
- `AC-mobile.devices.detail-07` mock 드라이버에서는 더미 앱 목록을 지연 없이 돌려준다.

## `mobile.devices.connection` — 연결 구성 탭

`conn-config-tab-content`. 이 기기를 Appium 에 어떤 조건으로 넘길지 저장한다.
**워크스페이스별**이며, 사용중 구성은 **한 개**다.

### `mobile.devices.connection.tree` — 구성 트리

`conn-config-device-tree` · 새로 만들기 `conn-config-new-btn` ·
새 구성 대화상자 `conn-new-dialog`

- `AC-mobile.devices.connection.tree-01` 저장하면 트리에 즉시 나타난다.
- `AC-mobile.devices.connection.tree-02` 삭제하면 트리에서 사라지고, 그것이 사용중이었다면
  사용중도 해제된다.
- `AC-mobile.devices.connection.tree-03` 구성을 지운 뒤 같은 기기로 다시 만들 수 있다.
- `AC-mobile.devices.connection.tree-04` 워크스페이스를 바꾸면 다른 목록이 보인다.
- `AC-mobile.devices.connection.tree-05` 새 구성 대화상자는 기기를 골라 만들고, 취소하면
  아무것도 만들지 않는다.

### `mobile.devices.connection.in-use` — 사용중

`conn-config-in-use-section` · 항목 `conn-config-in-use-item` ·
빈 상태 `conn-config-in-use-empty`

- `AC-mobile.devices.connection.in-use-01` 사용하기를 누르면 그 구성이 사용중이 되고,
  이전에 사용중이던 것은 자동으로 해제된다(항상 최대 1개).
- `AC-mobile.devices.connection.in-use-02` 사용중이 없으면 빈 상태 문구를 보인다.

### `mobile.devices.connection.edit` — 구성 편집

`conn-edit-panel`

| 부품 | testid | 규칙 |
|---|---|---|
| 이름 | `conn-edit-name-input` | 자유 입력 |
| 기기·플랫폼 | `conn-edit-device-readonly` · `conn-edit-platform-readonly` | 읽기 전용 (만들 때 정해진다) |
| Appium 주소 | `conn-edit-appium-url` | 자유 입력 |
| 앱 선택 | `conn-edit-app-select` + 검색 `conn-edit-app-search` | 그 기기의 설치 앱에서 고른다. 기본은 "선택 안 함" |
| iOS 서명 | `conn-edit-xcode-signing-id` · `conn-edit-xcode-org-id` | macOS 인증서 목록에서 고른다 |
| 추가 설정 | `conn-edit-kv-add` | 키-값 여러 개. 빈 키는 무시하고, 나머지는 Appium 설정에 그대로 펼친다 |
| 저장·테스트·사용하기 | `conn-edit-save-btn` · `conn-edit-test-btn` · `conn-edit-use-btn` | |

- `AC-mobile.devices.connection.edit-01` 저장하면 `store.json` 의 `connections[]` 에
  들어가고, 같은 id 면 덮어쓴다.
- `AC-mobile.devices.connection.edit-02` 테스트를 누르면 결과와 소요 시간을
  `conn-edit-test-result` 에 보인다. 없는 구성을 테스트하면 찾을 수 없다는 결과가 온다.
- `AC-mobile.devices.connection.edit-03` iOS 인증서 목록은 macOS 에서만 채워진다.
  macOS 가 아니면 빈 목록과 안내를 보인다.
- `AC-mobile.devices.connection.edit-04` 빈 키의 추가 설정은 저장되지 않는다.

## 데이터·채널

| 무엇 | 채널 |
|---|---|
| 도구·서버 | `MOBILE_TOOLING_STATUS` · `MOBILE_APPIUM_STATUS` · `MOBILE_APPIUM_START` · `MOBILE_APPIUM_STOP` · `MOBILE_APPIUM_CONNECT_EXTERNAL` · `MOBILE_APPIUM_DISCONNECT_EXTERNAL` |
| 기기 | `MOBILE_LIST_DEVICES` · `EVT_DEVICE_UPDATE` |
| 내 디바이스 | `DEVICE_LIST_SAVED` · `DEVICE_SAVE` · `DEVICE_REMOVE` · `DEVICE_UPDATE_ALIAS` · `DEVICE_APPS_LIST` |
| 연결 구성 | `CONN_LIST` · `CONN_SAVE` · `CONN_REMOVE` · `CONN_USE` · `CONN_TEST` · `APPLE_CERTS_LIST` |

### 저장 형식

```json
// <workspaceDir>/store.json
{ "connections": [ /* Connection */ ], "activeConnectionId": "conn-1" }

// <userData>/devices.json
{ "devices": [ { "id": "...", "udid": "...", "alias": "...", "lastConnectedAt": "ISO" } ] }
```

읽을 때 `connections` 가 배열이 아니거나 `activeConnectionId` 가 문자열이 아니면 각각
빈 배열·`null` 로 떨어진다. 은퇴한 `capabilities[]` / `activeCapabilityId` 는 읽을 때
무시하고 쓸 때 다시 내보내지 않는다.

## 알려진 한계

- **`connection-to-session-gap` (미구현 · 결정 필요)** — 연결 구성을 실제 Appium 세션으로
  바꾸는 경로가 없다. `MOBILE_SESSION_START` 는 은퇴한 Capability 목록에서 프로파일을
  찾고, 그 목록은 항상 비어 있으므로 실물 드라이버 모드에서 세션 시작이 항상 실패한다.
  같은 이유로 `MOBILE_LIST_CAPABILITIES` · `MOBILE_SAVE_CAPABILITY` ·
  `MOBILE_REMOVE_CAPABILITY` · `MOBILE_TEST_CAPABILITY` 채널은 결과를 낼 수 없다.
  mock 모드는 영향받지 않아 화면과 e2e 는 정상 통과한다.
  결정 대기: (a) 세션 시작을 사용중 연결 구성 기준으로 다시 배선하고 옛 채널을 은퇴시킬지,
  (b) 옛 채널을 남겨둘지.
- 연결 테스트는 아직 실제 Appium 왕복이 아니라 구성 존재 여부 확인 수준이다.
- 기기 목록 폴링 간격(5초)은 설정으로 바꿀 수 없다.
