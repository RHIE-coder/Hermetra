---
phase: handover
status: ready
inputs: []
---

# 기준표 — 코드에서 뽑은 핵심 기능 목록

출처는 문서가 아니라 코드다: `src/renderer/App.tsx`(라우트) ·
`src/renderer/components/layout/sidebar.tsx`(항목) · `src/shared/ipc/channels.ts`(채널) ·
`src/main/services/**`(정책) · `src/main/bridge/**`(도메인 규칙).

## 1. 화면 (10)

| # | Surface | 라우트 | 컨테이너 testid |
|---|---|---|---|
| 1 | 웹 · 브라우저 | `/web/remote` | `page-web-remote` |
| 2 | 웹 · 스크립트 | `/web/code` | `page-web-code` |
| 3 | 모바일 · 디바이스 | `/mobile/devices` | `page-mobile-devices` |
| 4 | 모바일 · 스크립트 | `/mobile/code` | `page-mobile-code` |
| 5 | 모바일 · 인스펙터 | `/mobile/inspector` | `page-mobile-inspector` |
| 6 | 설정 · 시나리오 | `/bridge/scenarios` | `page-bridge-scenarios` |
| 7 | 설정 · 변수 | `/bridge/variables` | `page-bridge-variables` |
| 8 | 설정 · 공유 버스 | `/bridge/bus` | `page-bridge-bus` |
| 9 | 설정 · 이벤트 | `/bridge/events` | `page-bridge-events` |
| 10 | 셸 · 워크스페이스 전환기 | 상단바 | — |

셸 부품(사이드바 그룹 3 · 상단바 5부품)도 기준표에 포함한다.

## 2. 서버 동작 — IPC 채널 91개 (요청 82 · 통보 9)

| 묶음 | 개수 | 무엇 |
|---|---|---|
| `WEB_*` | 12 | 원격 브라우저 상태·탭·북마크·스크립트 실행 |
| `WEB_SCRIPTS_*` | 6 | 웹 스크립트 파일 관리 |
| `MOBILE_*` | 18 | 도구 상태·Appium·기기·세션·스크립트 실행 (+은퇴한 Capability 5) |
| `DEVICE_*` | 5 | 내 디바이스(전역) · 설치 앱 |
| `CONN_*` | 5 | 연결 구성(워크스페이스) |
| `APPLE_*` | 1 | macOS 서명 인증서 |
| `INSPECTOR_*` | 7 | 세션·스크린샷·녹화·요소·컨텍스트 |
| `MOBILE_SCRIPTS_*` | 6 | 모바일 스크립트 파일 관리 |
| `VARS_*` | 2 | 변수 문서 로드·저장 |
| `BRIDGE_*` | 14 | 공유 버스 5 · 이벤트 4 · 시나리오 5 |
| `WORKSPACE_*` | 4 | 목록·저장·삭제·활성 |
| `BROWSER_*` | 2 | 브라우저 설치 상태·실행 |
| `EVT_*` | 9 | 통보(사건·버스·시나리오·기기·Appium·세션·브라우저·워크스페이스·설치) |

## 3. 정책 (데이터 규칙 · 계산 규칙)

| # | 정책 | 어디 |
|---|---|---|
| P1 | 워크스페이스 격리 — 모든 워크스페이스 데이터는 활성 폴더 아래 | `services/workspaceManager.ts` |
| P2 | 마지막 워크스페이스는 삭제 금지, 활성 없으면 첫 번째 | `services/workspaceManager.ts` |
| P3 | 포트 기본 9222 · 이름 공백 제거/슬러그 대체 | `services/workspaceManager.ts` |
| P4 | 읽기 관용 · 쓰기 엄격 (깨진 파일·낡은 필드는 무시, 쓸 때 안 내보냄) | `services/storage.ts` · `connections.ts` · `myDevices.ts` |
| P5 | 변수 공유/개인 파일 분리 — 공유 파일에 개인 값 금지 | `services/variables.ts` |
| P6 | 스크립트 경로 탈출 금지 (워크스페이스 슬롯 밖 거부) | `services/scripts.ts` |
| P7 | 배치 이동 원자성 — 충돌 1건이면 전체 취소 | `services/scripts.ts` |
| P8 | 폴더를 자기 자손으로 이동 금지 | `services/scripts.ts` |
| P9 | 빈 슬롯에 씨앗 스크립트 생성 | `services/scripts.ts` |
| P10 | 사용중 연결 구성은 최대 1개, 삭제 시 자동 해제 | `services/connections.ts` |
| P11 | 내 디바이스는 전역, UDID 일치 시 마지막 연결 시각 갱신 | `services/myDevices.ts` |
| P12 | 기기 폴링 5초, 목록이 바뀔 때만 통보 | `ipc/register.ts` |
| P13 | 공유 버스 — 같은 키 덮어쓰기 · 키 순 정렬 · 메모리뿐 | `bridge/varBus.ts` |
| P14 | 이벤트 이력 상한 200 · 채널별 구독 · 대기 30초 | `bridge/eventBus.ts` |
| P15 | 시나리오 — 순차 실행 · 실패 시 중단 · both 는 병렬 · 중단 후 건너뜀 | `bridge/orchestrator.ts` |
| P16 | 드라이버 기본 mock, `HERMETRA_DRIVERS=real` 만 실물 | `drivers/**` |
| P17 | 렌더러는 `main/`·`node:*` 임포트 금지, 채널 문자열은 한 곳 | `shared/ipc/channels.ts` |
| P18 | 사용자 문자열은 en/ko 양쪽 키로만 | `renderer/lib/messages.ts` |
| P19 | 색·반경·그림자는 등록된 토큰만 | `styles/global.css` · `tailwind.config.ts` |
| P20 | 웹뷰 컨텍스트를 읽은 뒤 네이티브로 복귀 | `ipc/register.ts` |

## 4. 대조 결과 (정본 대비 빈 칸)

handover 시작 시점: 정본 문서 3개(README 씨앗)뿐 — 화면 10/10, 정책 20/20, 채널 묶음
13/13 이 **전부 빈 칸**이었다.

종료 시점: `docs/spec/` 17개 문서 · `docs/qa/` 10개 문서로 전부 채움. 남은 것은
"미구현으로 명시하고 결정을 기다리는 것" 1건뿐이다(`connection-to-session-gap`).
