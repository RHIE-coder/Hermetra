# 아키텍처 정본 — Hermetra

지금 돌아가는 코드를 기준으로 쓴 구조 문서다. 세부 패턴 규칙은 `CLAUDE.md §1-2`,
제품 서술은 `ARCHITECTURE.md` 에 있다. 이 문서는 **왜 이 구조인가**와
**데이터가 어디를 지나는가**를 담는다.

## 1. 프로세스 3개

```
Renderer (React 19 + Zustand + Tailwind)   창 안에서 그려지는 전부
   │  window.bridge.invoke(channel, input)
Preload (contextBridge)                    유일한 통로. nodeIntegration off
   │  ipcRenderer -> ipcMain
Main (Electron)                            OS 를 만지는 전부
   ├─ ipc/register.ts      채널 -> 핸들러 배선 + 이벤트 브로드캐스트
   ├─ services/            JSON 저장소 · 워크스페이스 · 스크립트 · 변수 · 연결 · 기기 · 브라우저 설치
   ├─ bridge/              VarBus · BridgeEventBus · ScenarioOrchestrator (순수 로직)
   └─ drivers/             web=Playwright · mobile=Appium/WebdriverIO (mock 가능)
```

**왜 이렇게 갈랐나** — 자동화 도구는 브라우저·기기·셸을 직접 만진다. 그 권한을 렌더러에
주면 화면 코드가 OS 를 만지게 되고, 그 순간 테스트도 보안도 무너진다. 그래서 렌더러는
`node:*` 와 `main/` 을 **아예 임포트하지 못하고**(계층 임포트 검사가 강제), 능력은 전부
타입이 박힌 IPC 채널 하나로만 건너간다.

## 2. 데이터 흐름 두 방향

**요청 방향** (렌더러가 물어본다):

```
페이지 컴포넌트 -> 모듈 store 액션 -> invoke(CHANNELS.X) -> ipcMain.handle -> 서비스/드라이버
```

store 는 상태와 액션만 든다. IPC 문자열은 `src/shared/ipc/channels.ts` 밖에 존재하지
않는다 — 채널을 늘릴 때 그 파일을 먼저 고치는 이유다(오타가 컴파일에서 죽는다).

**통보 방향** (메인이 알려준다):

```
EventEmitter(버스·드라이버·워크스페이스) -> register.ts 구독 -> webContents.send(EVT_*) -> store 구독
```

`bridge/` 의 버스는 IPC 도 fs 도 모른다 — 순수 EventEmitter 다. 그걸 렌더러로 잇는 배선은
`register.ts` 한 곳에만 있다. 이 분리 때문에 버스 로직은 Electron 없이 단위 테스트된다.

## 3. 저장소 — DB 없음

| 데이터 | 위치 | 범위 |
|---|---|---|
| 북마크 · 시나리오 · 연결 구성 | `<workspaceDir>/store.json` | 워크스페이스 |
| 공유 변수 (값 포함) | `<workspaceDir>/variables.json` | 워크스페이스 |
| 개인 변수 (값만) | `<workspaceDir>/variables.private.json` | 워크스페이스 |
| 스크립트 파일 | `<workspaceDir>/scripts/{web,mobile}/**` | 워크스페이스 |
| 워크스페이스 목록 | `<userData>/workspaces.json` | 전역 |
| 내 디바이스 | `<userData>/devices.json` | 전역 |
| 공유 버스 · 이벤트 이력 | 메모리 | 앱 실행 중에만 |

**왜 JSON 인가** — 저장하는 것이 설정과 스크립트뿐이고, 사용자가 손으로 열어보고
git 에 올릴 수 있어야 했다. 그래서 스키마 마이그레이션 대신 **읽기 관용 · 쓰기 엄격**
규칙을 쓴다: 깨진 파일이나 낡은 필드는 조용히 무시하고 기본값으로 떨어지며, 쓸 때는
현재 스키마만 내보낸다(P4 의 `capabilities[]` 가 그렇게 사라졌다).

**왜 개인 변수를 파일로 가르나** — 공유 변수는 팀이 저장소에 올려 함께 쓰고, 토큰 같은
값은 올라가면 안 된다. 그래서 공유 파일에는 개인 변수의 **키만** 남고 값은 `.private`
파일에만 있다.

## 4. 워크스페이스 = 격리 경계

모든 워크스페이스 데이터는 `workspaceManager().activeDir()` 아래에만 쓴다. 서비스가 그
경로 밖으로 나가는 것은 전역 데이터(브라우저 설치 상태, 내 디바이스)뿐이다.
워크스페이스가 바뀌면 `App.tsx` 가 store 들을 다시 초기화한다.

**왜** — 같은 앱으로 프로젝트 여러 개를 오가며 자동화한다. 스크립트·변수·연결이 섞이면
남의 환경으로 시나리오를 돌리는 사고가 난다. 워크스페이스는 항상 최소 1개가 남는다
(마지막 하나는 삭제되지 않는다 — 지울 수 있으면 앱이 상태 없는 화면으로 떨어진다).

## 5. 드라이버 = 교체 가능한 전략

`HERMETRA_DRIVERS=real` 이 아니면 **mock** 이 기본이다. mock 은 Chromium·Appium 없이도
앱이 끝까지 도는 것을 보장한다 — e2e 와 데모가 여기에 얹혀 있다.

**왜 mock 을 기본으로 두나** — 실물 드라이버는 설치가 무겁고 CI 에 기기가 없다. 기본이
실물이면 "환경이 없어서 테스트를 못 돌린다"가 상수가 된다.

## 6. UI 시스템

- 색·반경·그림자는 전부 `styles/global.css` + `tailwind.config.ts` 의 토큰이다. 컴포넌트에
  raw hex 를 쓰지 않는다(토큰 검사가 강제). 등록 안 된 색 클래스는 Tailwind 가 조용히
  버려서 투명하게 렌더된다 — 그 사고가 immunity 원장의 `design-token-fabrication` 항목이다.
- 사용자에게 보이는 문자열은 `lib/messages.ts` 의 `en`/`ko` 양쪽 키로만 존재한다.
  `MessageKey` 타입이 빠진 키를 컴파일에서 잡는다.
- 모듈 색 구분: 웹=`web`, 모바일=`mobile`, 브리지=`bridge` 액센트 토큰.

## 7. 이름에 대한 주의

UI 는 브리지 모듈을 **"설정 / Settings"** 로 표시하지만, 라우트(`/bridge/*`)·IPC 채널
(`BRIDGE_*`)·폴더(`modules/bridge`)·도메인 타입(`BridgeEvent`)은 `bridge` 를 유지한다.
표시명만 바꾼 것이며 식별자를 따라 고치면 IPC 계약과 테스트가 통째로 흔들린다.
