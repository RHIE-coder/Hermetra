# `mobile` — 모바일 자동화 Service

Appium/WebdriverIO 로 실기기·에뮬레이터를 다룬다. 사이드바 그룹 "모바일",
액센트 토큰 `mobile`.

| Surface | ID | 라우트 | 정본 |
|---|---|---|---|
| 디바이스 | `mobile.devices` | `/mobile/devices` | `devices.md` |
| 스크립트 | `mobile.code` | `/mobile/code` | `code.md` |
| 인스펙터 | `mobile.inspector` | `/mobile/inspector` | `inspector.md` |

## Service 규칙

- **Appium 서버는 하나**다. 앱이 직접 띄우거나(내장 실행), 이미 돌고 있는 서버에
  주소로 붙는다(외부 연결). 둘 중 하나만 유효하다.
- 세션도 하나다. 인스펙터와 스크립트 실행이 같은 세션을 공유한다.
- 기기 목록은 5초 간격으로 다시 읽고, 목록이 바뀔 때만 렌더러에 통보한다
  (같은 내용이면 조용하다).
- **연결 구성(Connection)은 워크스페이스별**, **내 디바이스(SavedDevice)는 전역**이다.
  기기는 사람에게 물리적으로 하나뿐이고, 그 기기를 어떤 설정으로 쓰는지는 프로젝트마다
  다르기 때문이다.
- `modules/mobile` 은 `modules/web` 을 임포트하지 않는다.

## 상태 소유

| 무엇 | 어디 | 범위 |
|---|---|---|
| 도구 설치 상태 (Appium/ADB/libimobiledevice 등) | 메인 (드라이버가 조회) | 전역 |
| Appium 서버 상태 | 메인 (드라이버) | 전역 |
| 감지된 기기 목록 | 메인 (5초 폴링) | 전역 |
| 내 디바이스 | `<userData>/devices.json` | 전역 |
| 연결 구성 · 사용중 구성 | `<workspaceDir>/store.json` | 워크스페이스 |
| 스크립트 파일 | `<workspaceDir>/scripts/mobile/**` | 워크스페이스 |
| 세션 상태 | 메인 (메모리) | 앱 실행 중 |

## Service 수준 미구현 (결정 필요)

`connection-to-session-gap` — 연결 구성을 실제 세션으로 바꾸는 경로가 없다.
세션 시작 채널(`MOBILE_SESSION_START`)은 아직 은퇴한 Capability 목록에서 프로파일을
찾으므로 실물 드라이버 모드에서 **항상 실패**한다. mock 모드는 영향받지 않는다.
자세한 내용과 결정 대기 사항은 `devices.md` 의 "알려진 한계" 를 본다.
