# TestScenario: 모바일 자동화 (`mobile`)

기기를 찾고, 등록하고, 연결 구성을 만들고, 화면을 들여다보는 길.
덮는 정본: `docs/spec/mobile/*`

## TestSuite: `mobile.devices.management` — 기기 관리 탭

구현: `src/renderer/modules/mobile/pages/DevicesPage.test.tsx` (25) ·
`tests/api/my-devices.test.ts` (9) · `tests/schema/myDevices.test.ts` (6) ·
`tests/api/device-apps.test.ts` (5) · `tests/unit/mobile-apps-parser.test.ts` (8)

| Case | 무엇 | 덮는 노드 | 계층 | 구현 |
|---|---|---|---|---|
| CASE-mobile-001 | devices.json 이 없으면 빈 목록으로 자동 생성된다 | `mobile.devices.my` | 스키마 | `tests/schema/myDevices.test.ts` |
| CASE-mobile-002 | 깨진 devices.json 은 빈 목록으로 복구된다 | `mobile.devices.my` | 스키마 | `tests/schema/myDevices.test.ts` |
| CASE-mobile-003 | 저장하면 목록에 남고 다시 읽어도 유지된다 | `mobile.devices.my` | API | `tests/api/my-devices.test.ts` |
| CASE-mobile-004 | 같은 id 로 저장하면 덮어쓴다 | `mobile.devices.my` | API | `tests/api/my-devices.test.ts` |
| CASE-mobile-005 | 없는 id 를 지우는 것은 무해하다 | `mobile.devices.my` | API | `tests/api/my-devices.test.ts` |
| CASE-mobile-006 | 별칭을 넣고/비우면 반영된다 | `mobile.devices.detail` | API | `tests/api/my-devices.test.ts` |
| CASE-mobile-007 | 같은 UDID 가 다시 감지되면 마지막 연결 시각이 갱신된다 | `mobile.devices.live` | API | `tests/api/my-devices.test.ts` |
| CASE-mobile-008 | 감지 기기를 내 디바이스로 저장할 수 있다 | `mobile.devices.live` | UI | `DevicesPage.test.tsx` |
| CASE-mobile-009 | 내 디바이스 항목이 연결됨/연결안됨으로 구분된다 | `mobile.devices.my` | UI | `DevicesPage.test.tsx` |
| CASE-mobile-010 | 항목을 고르면 상세 패널이 그 기기를 보인다 | `mobile.devices.detail` | UI | `DevicesPage.test.tsx` |
| CASE-mobile-011 | 상세의 정보/앱 탭이 갈린다 | `mobile.devices.detail` | UI | `DevicesPage.test.tsx` |
| CASE-mobile-012 | 앱 탭이 설치 앱을 조회해 보인다 | `mobile.devices.detail` | UI | `DevicesPage.test.tsx` |
| CASE-mobile-013 | 앱 검색이 대소문자 무시 부분일치로 걸러낸다 | `mobile.devices.detail` | UI | `DevicesPage.test.tsx` |
| CASE-mobile-014 | 앱 새로고침이 다시 조회한다 | `mobile.devices.detail` | API | `tests/api/device-apps.test.ts` |
| CASE-mobile-015 | 앱 목록 출력 파싱(안드로이드/iOS)이 정확하다 | `mobile.devices.detail` | 단위 | `tests/unit/mobile-apps-parser.test.ts` |
| CASE-mobile-016 | 도구 상태가 모두 정상/일부 없음으로 갈려 표시된다 | `mobile.devices.tooling` | UI | `DevicesPage.test.tsx` |
| CASE-mobile-017 | 탭 초기값이 기기 관리다 | `mobile.devices` | UI | `DevicesPage.test.tsx` |
| CASE-mobile-018 | Appium 서버 시작/중지·외부 연결이 상태에 반영된다 | `mobile.devices.server` | UI | `DevicesPage.test.tsx` |

## TestSuite: `mobile.devices.connection` — 연결 구성 탭

구현: `src/renderer/modules/mobile/pages/ConnectionConfigTab.test.tsx` (17) ·
`tests/api/connections.test.ts` (13) · `tests/schema/connections.test.ts` (5) ·
`tests/api/apple-certs.test.ts` (9)

| Case | 무엇 | 덮는 노드 | 계층 | 구현 |
|---|---|---|---|---|
| CASE-mobile-030 | 낡은 capabilities 필드는 무시되고 다시 쓰이지 않는다 | `mobile.devices.connection` | 스키마 | `tests/schema/connections.test.ts` |
| CASE-mobile-031 | connections 가 배열이 아니면 빈 배열로 떨어진다 | `mobile.devices.connection` | 스키마 | `tests/schema/connections.test.ts` |
| CASE-mobile-032 | 저장하면 목록에 즉시 나타난다 | `...connection.tree` | API | `tests/api/connections.test.ts` |
| CASE-mobile-033 | 사용하기가 사용중을 그 하나로 바꾼다 | `...connection.in-use` | API | `tests/api/connections.test.ts` |
| CASE-mobile-034 | 사용중인 것을 지우면 사용중이 해제된다 | `...connection.tree` | API | `tests/api/connections.test.ts` |
| CASE-mobile-035 | 지운 뒤 같은 기기로 다시 만들 수 있다 | `...connection.tree` | API | `tests/api/connections.test.ts` |
| CASE-mobile-036 | 워크스페이스가 다르면 목록이 갈린다 | `...connection.tree` | API | `tests/api/connections.test.ts` |
| CASE-mobile-037 | 없는 구성을 테스트하면 찾을 수 없다는 결과가 온다 | `...connection.edit` | API | `tests/api/connections.test.ts` |
| CASE-mobile-038 | 테스트 결과와 소요 시간이 화면에 보인다 | `...connection.edit` | UI | `ConnectionConfigTab.test.tsx` |
| CASE-mobile-039 | 앱 선택이 검색으로 걸러지고 선택 안 함이 기본이다 | `...connection.edit` | UI | `ConnectionConfigTab.test.tsx` |
| CASE-mobile-040 | 빈 키의 추가 설정은 무시된다 | `...connection.edit` | UI | `ConnectionConfigTab.test.tsx` |
| CASE-mobile-041 | 기기·플랫폼 칸은 읽기 전용이다 | `...connection.edit` | UI | `ConnectionConfigTab.test.tsx` |
| CASE-mobile-042 | 사용하기를 누르면 사용중 영역에 반영된다 | `...connection.in-use` | UI | `ConnectionConfigTab.test.tsx` |
| CASE-mobile-043 | 새 구성 대화상자의 만들기/취소가 동작한다 | `...connection.tree` | UI | `ConnectionConfigTab.test.tsx` |
| CASE-mobile-044 | macOS 인증서 목록 파싱이 정확하다 | `...connection.edit` | API | `tests/api/apple-certs.test.ts` |
| CASE-mobile-045 | macOS 가 아니면 인증서 목록이 비고 안내가 보인다 | `...connection.edit` | API | `tests/api/apple-certs.test.ts` |

## TestSuite: `mobile.inspector` — 인스펙터

구현: `src/renderer/modules/mobile/pages/MobileInspectorPage.test.tsx` (29) ·
`tests/api/inspector.test.ts` (10) · `tests/unit/inspector-element-parser.test.ts` (12)

| Case | 무엇 | 덮는 노드 | 계층 | 구현 |
|---|---|---|---|---|
| CASE-mobile-060 | 사용중 구성이 없으면 세션 시작이 비활성이고 경고가 보인다 | `mobile.inspector.actions` | UI | `MobileInspectorPage.test.tsx` |
| CASE-mobile-061 | 구성이 있고 Appium 이 돌면 세션 시작이 활성이다 | `mobile.inspector.actions` | UI | `MobileInspectorPage.test.tsx` |
| CASE-mobile-062 | 세션을 시작하면 상태 뱃지가 연결됨으로 바뀐다 | `mobile.inspector.actions` | UI | `MobileInspectorPage.test.tsx` |
| CASE-mobile-063 | 세션 시작 실패 시 이유가 보이고 뱃지는 그대로다 | `mobile.inspector.actions` | UI | `MobileInspectorPage.test.tsx` |
| CASE-mobile-064 | 세션이 없으면 스크린샷·녹화·추출이 비활성이다 | `mobile.inspector.actions` | UI | `MobileInspectorPage.test.tsx` |
| CASE-mobile-065 | 녹화 시작/중지 버튼이 서로 전환된다 | `mobile.inspector.actions` | UI | `MobileInspectorPage.test.tsx` |
| CASE-mobile-066 | 화면을 벗어나면 세션이 자동 중지된다 | `mobile.inspector.actions` | UI | `MobileInspectorPage.test.tsx` |
| CASE-mobile-067 | 스크린샷이 패널에 표시되고, 없으면 빈 상태다 | `mobile.inspector.screenshot` | UI | `MobileInspectorPage.test.tsx` |
| CASE-mobile-068 | 이미지 호버가 해당 요소를 강조한다 | `mobile.inspector.screenshot` | UI | `MobileInspectorPage.test.tsx` |
| CASE-mobile-069 | 이미지 클릭이 요소를 선택하고 상세를 채운다 | `mobile.inspector.detail` | UI | `MobileInspectorPage.test.tsx` |
| CASE-mobile-070 | 트리 선택이 화면 강조와 동기화된다 | `mobile.inspector.tree` | UI | `MobileInspectorPage.test.tsx` |
| CASE-mobile-071 | 추출이 네이티브·웹뷰를 함께 읽고 개수를 갱신한다 | `mobile.inspector.tree` | API | `tests/api/inspector.test.ts` |
| CASE-mobile-072 | 웹뷰 컨텍스트가 없으면 웹뷰 탭이 빈 상태다 | `mobile.inspector.tree` | API | `tests/api/inspector.test.ts` |
| CASE-mobile-073 | 웹뷰를 읽은 뒤 컨텍스트가 네이티브로 되돌아온다 | `mobile.inspector.tree` | API | `tests/api/inspector.test.ts` |
| CASE-mobile-074 | 안드로이드 bounds 파싱이 정확하다 | `mobile.inspector.tree` | 단위 | `tests/unit/inspector-element-parser.test.ts` |
| CASE-mobile-075 | iOS 좌표 속성 파싱이 정확하다 | `mobile.inspector.tree` | 단위 | `tests/unit/inspector-element-parser.test.ts` |
| CASE-mobile-076 | 좌표 속성이 없으면 위치가 없음으로 남는다 | `mobile.inspector.tree` | 단위 | `tests/unit/inspector-element-parser.test.ts` |
| CASE-mobile-077 | 요소 식별자가 트리 위치로 안정적으로 붙는다 | `mobile.inspector.tree` | 단위 | `tests/unit/inspector-element-parser.test.ts` |
| CASE-mobile-078 | mock 드라이버가 더미 화면·트리를 돌려준다 | `mobile.inspector` | API | `tests/api/inspector.test.ts` |

## TestSuite: `mobile.code` — 스크립트 화면

편집기 껍데기는 `web.code` Suite 가 대표한다. 모바일 고유분만 여기 둔다.

| Case | 무엇 | 덮는 노드 | 계층 | 구현 |
|---|---|---|---|---|
| CASE-mobile-090 | 모바일 스크립트가 mobile 폴더에만 쓰인다 | `mobile.code` | API | `tests/api/scripts.test.ts` |
| CASE-mobile-091 | 빈 폴더에 모바일 씨앗 파일이 생긴다 | `mobile.code` | API | `tests/api/scripts.test.ts` |
| CASE-mobile-092 | 사용중 구성이 없으면 준비되지 않은 상태로 보인다 | `mobile.code.readiness` | UI | 미구현 |
