# devices-connection-config

> 기존 Capability 개념을 완전 제거하고, 새로운 "연결 구성 (connection)" 개념을
> per-workspace로 도입한다. 연결 구성은 1개 디바이스를 가리키고, 앱 선택,
> iOS xcodeOrgId + xcodeSigningId (macOS keychain에서 조회), 추가 Key-Value
> Appium capabilities, "사용중" 토글, 테스트 (Appium reach) 액션을 포함한다.
> 프로젝트당 1개 구성만 "사용중"이 될 수 있다.

## Goal

per-workspace 연결 구성 CRUD + 사용중 1개 선택 + macOS Apple 인증서 자동 조회가 동작한다.

## Scope

- 데이터: `connections[]`를 `<workspaceDir>/store.json`에 추가 (또는 별도 connections.json
  — implementer 재량, 단 store.json에 두는 게 기존 패턴과 일치).
  - 기존 `capabilities[]`는 **삭제** (read 시 무시, save 시 drop).
  - `activeCapabilityId` 필드도 삭제. 대신 `activeConnectionId`.
- IPC: CONN_LIST, CONN_SAVE, CONN_REMOVE, CONN_USE, CONN_TEST, APPLE_CERTS_LIST.
- UI: "연결 구성" 탭 본문 채우기.
  - 좌측 패널 (image 4 left):
    - "+ 새 연결 구성" 버튼.
    - "사용중" section (1개 또는 빈 상태).
    - 디바이스별 tree: 내 디바이스마다 펼치면 그 디바이스에 속한 구성 리스트.
  - 우측 패널 (image 5):
    - 새 구성 만들기 dialog → 디바이스 선택 + "생성" → 우측 편집 패널 활성.
    - 편집 패널: 이름 / 기기 (read-only) / 플랫폼 (read-only) / 앱 (선택, P3 앱 리스트에서 가져옴) /
      iOS 인증서 (xcodeOrgId text + xcodeSigningId dropdown) / Key-Value extra /
      Appium URL footer / [저장][테스트][사용하기] 3 버튼.
  - 기존 캐퍼빌리티 카드와 세션 카드는 본 phase에서 **삭제** (capability 의존도 제거됨;
    세션 카드는 P5 inspector 페이지로 이전).

## Non-scope (explicit)

- 다중 "사용중" — 이번 phase는 1개만.
- 연결 구성 import/export.
- Apple 인증서 갱신/추가 UI (조회만).
- Android 인증서 — 해당 사항 없음 (Android는 keystore 별도, 이번 미지원).
- 세션 시작 — P5 inspector 페이지 책임.
- "테스트" 버튼이 실제 Appium 서버 핑을 어떻게 하는지 구체화 (단순 capability dry-run으로 reach).

## Acceptance criteria

- [ ] 기존 store.json에 `capabilities[]` / `activeCapabilityId`가 있어도 무시되고
      `connections[]` / `activeConnectionId`로 대체 동작.
- [ ] `CONN_SAVE`로 새 연결 구성 저장 → 좌측 tree에 즉시 표시.
- [ ] `CONN_USE(id)` → `activeConnectionId`가 그 id로 설정, "사용중" section에 반영.
      다른 ID가 사용중이었다면 자동 해제 (1개 제약).
- [ ] `CONN_REMOVE(id)` → 트리에서 제거. 그게 사용중이었다면 사용중 해제.
- [ ] iOS 인증서 dropdown: `APPLE_CERTS_LIST` 호출 → macOS `security find-identity -v -p codesigning`
      파싱 결과 표시. macOS가 아니면 빈 list + 안내 텍스트.
- [ ] "테스트" 버튼: `CONN_TEST` IPC → Appium에 capability 형태로 dry-run 요청 →
      ok/fail + 소요 시간을 panel에 표시 (image의 lastTest 패턴과 동일).
- [ ] 앱 선택 dropdown: 그 구성의 디바이스에 설치된 앱 (P3 IPC `DEVICE_APPS_LIST` 재사용)
      에서 검색/선택. "앱 선택 안함" 옵션 기본.
- [ ] 추가 설정 KV: key-value pair 여러 개 추가 가능. 빈 key는 무시. 결과는 Appium
      capability에 그대로 spread.
- [ ] 구성 삭제 후 다시 같은 디바이스로 새로 생성 → 정상 동작.
- [ ] 모든 연결 구성은 **per-workspace** — workspace 전환 시 다른 list.

## Affected layers (CLAUDE.md §3.1)

- Pure logic:
  - `src/main/services/connections.ts` (신규): CRUD on connections[] in store.json.
  - `src/main/services/appleCerts.ts` (신규): spawn `security`, parse output.
  - `src/main/services/storage.ts`: capabilities[] / activeCapabilityId 필드 제거 또는 무시.
- DB schema: store.json 변경. 새 schema test (tests/schema/connections.test.ts).
- IPC handler: 6개 신규 채널.
- UI component:
  - `ConnectionConfigTab.tsx` (신규): 좌측 tree + 사용중 section.
  - `NewConnectionDialog.tsx` (신규): 디바이스 선택 + 생성.
  - `ConnectionEditPanel.tsx` (신규): 편집 form + 3 버튼.
  - `AppleCertSelect.tsx` (신규): xcodeSigningId dropdown.
  - 기존 `CapabilityDialog.tsx` / 캐퍼빌리티 카드 / 세션 카드 — 삭제.
- E2E: 새 탭에서 nav-mobile-devices 작동 확인 + 연결 구성 탭 click 후 화면 렌더 확인.

## Data model changes

신규 type (src/shared/types/mobile.ts):
```ts
export interface Connection {
  id: string;
  name: string;
  deviceId: string;         // SavedDevice.id 참조
  platform: 'ios' | 'android';
  bundleId?: string;        // 선택한 앱의 bundle (또는 appPackage on Android)
  xcodeOrgId?: string;      // iOS only
  xcodeSigningId?: string;  // iOS only (signing identity hash from keychain)
  extra: Record<string, string>; // Appium capability KV
}

export interface AppleSigningIdentity {
  hash: string;        // 4NC5GBGM93
  label: string;       // "Apple Development: foo@bar.com"
  fullLine: string;    // 원문 (그대로 dropdown label 사용)
}
```

기존 `Capability`, `activeCapabilityId` 필드 — **삭제**. store.json read 시
이 필드가 있어도 무시. write 시 절대 다시 쓰지 않음.

## IPC contract changes

| Channel | Direction | Input | Output |
|---|---|---|---|
| `CHANNELS.CONN_LIST` | renderer → main | `{}` | `{ connections: Connection[], activeId: string \| null }` |
| `CHANNELS.CONN_SAVE` | renderer → main | `{ connection: Connection }` | `{ ok: true }` |
| `CHANNELS.CONN_REMOVE` | renderer → main | `{ id: string }` | `{ ok: true }` |
| `CHANNELS.CONN_USE` | renderer → main | `{ id: string \| null }` (null=해제) | `{ ok: true }` |
| `CHANNELS.CONN_TEST` | renderer → main | `{ id: string }` | `{ ok: boolean, durationMs: number, message: string }` |
| `CHANNELS.APPLE_CERTS_LIST` | renderer → main | `{}` | `{ identities: AppleSigningIdentity[] }` |

기존 채널: `CAP_LIST`, `CAP_SAVE`, `CAP_REMOVE`, `CAP_TEST`, `CAP_SET_ACTIVE` — 모두 **삭제**.

## UI flow

좌측 패널 (이미지 4):
```
연결 구성                      [+ 새 연결 구성]
사용중
  (사용중인 연결 구성이 없습니다.)
  또는
  [구성 이름] (사용중 배지)

▽ 이민형의 iPhone                                    2
   [구성 이름 1] (active = 우측 편집)
   [구성 이름 2]
▽ 다른 디바이스                                      0
   연결 구성 없음
```

우측 편집 (이미지 5):
```
연결 구성 편집                                       [trash]
이름:          [New Config            ]
기기:          [이민형의 iPhone (read-only)]
플랫폼:        [IOS (read-only)              ]
앱 (선택사항): [검색 input                     ]
              [dropdown: 앱 선택 안함 / 앱들]
iOS 인증서:
  xcodeOrgId (Team ID):    [ABCD1234EF      ]
  xcodeSigningId:          [선택하세요  ▼ ]
                             ✓ 선택하세요
                             Apple Development: ... (HASH)
                             ...
추가 설정 (Key-Value):
  [key]  =  [value]                              [+ 추가]
  추가 Appium 설정이 없습니다. 필요한 설정을 Key-Value 형식으로 추가하세요.

[저장]                  [테스트]              [✓ 사용하기]
Appium URL: http://localhost:4723
```

새 구성 dialog (이미지 4 우측 floating):
```
새 연결 구성
디바이스 선택: [이민형의 iPhone (IOS)  ▼]
                       [취소]  [생성]
```

States:
- Empty (구성 0개): 좌측 tree에 device 노드만 + "연결 구성 없음" 캡션.
- Loading (TEST 진행 중): "테스트" 버튼 spinner.
- Error (TEST 실패): 결과 영역 red 텍스트.

## i18n

신규 키 (en + ko):

- `mobile.conn.title` — "연결 구성" / "Connection configs"
- `mobile.conn.new` — "+ 새 연결 구성" / "+ New config"
- `mobile.conn.inUse` — "사용중" / "In use"
- `mobile.conn.inUseEmpty` — "사용중인 연결 구성이 없습니다." / "No active config."
- `mobile.conn.deviceEmpty` — "연결 구성 없음" / "No configs"
- `mobile.conn.edit.title` — "연결 구성 편집" / "Edit config"
- `mobile.conn.name` — "이름" / "Name"
- `mobile.conn.device` — "기기" / "Device"
- `mobile.conn.platform` — "플랫폼" / "Platform"
- `mobile.conn.appOptional` — "앱 (선택사항)" / "App (optional)"
- `mobile.conn.appNone` — "앱 선택 안함" / "No app selected"
- `mobile.conn.iosCert` — "iOS 인증서" / "iOS certificate"
- `mobile.conn.xcodeOrgId` — "xcodeOrgId (Team ID)" / "xcodeOrgId (Team ID)"
- `mobile.conn.xcodeSigningId` — "xcodeSigningId" / "xcodeSigningId"
- `mobile.conn.selectPrompt` — "선택하세요" / "Select"
- `mobile.conn.extra` — "추가 설정 (Key-Value)" / "Extra capabilities (Key-Value)"
- `mobile.conn.extraEmpty` — "추가 Appium 설정이 없습니다. 필요한 설정을 Key-Value 형식으로 추가하세요." / "No extra Appium settings. Add as Key-Value pairs."
- `mobile.conn.add` — "+ 추가" / "+ Add"
- `mobile.conn.test` — "테스트" / "Test"
- `mobile.conn.use` — "사용하기" / "Use"
- `mobile.conn.appiumUrl` — "Appium URL: " / "Appium URL: " (단순 prefix)
- `mobile.conn.selectDevice` — "디바이스 선택" / "Select device"

## Error handling

- `security` 명령어 실행 실패 (Linux/Win) → 빈 list + 안내 toast "macOS에서만 자동 조회됩니다".
- 구성 저장 시 deviceId가 존재하지 않는 device → save 거부 + toast.
- `CONN_TEST` 실패 → 결과 패널 red 텍스트 (Capability 패턴과 동일).
- Appium 서버 없음 → 테스트는 "Appium not reachable" 메시지.

## Performance / security notes

- `security find-identity` 실행은 빠름 (수십 ms). caching 불필요.
- xcodeSigningId hash는 secret이 아님 (공개 식별자) — 평문 저장 OK.
- KV extra의 value는 사용자 입력 그대로 (sanitize 없음, Appium에 그대로 전달).

## Workspace / multi-tenancy

connections는 `<workspaceDir>/store.json`에 저장 → 완벽 per-workspace 격리.
workspace 전환 시 mobile store가 reload → 다른 list 표시.
`<userData>/devices.json`은 workspace 전환과 무관 (P2).

## Driver compatibility

- Real: `security` CLI 호출, 실제 Appium에 dry-run capability 전송.
- Mock: AppleSigningIdentity 2개 hard-coded (image 6와 동일 모양),
  CONN_TEST는 항상 ok=true + durationMs=42.

## Open notes for /sprint

- **Capability 제거**: src/main/services/storage.ts, src/renderer/modules/mobile/store.ts,
  CapabilityDialog.tsx, DevicesPage.tsx의 capability 관련 로직 모두 제거. 빈 캐퍼빌리티 카드와
  세션 카드 자체도 삭제 (capability에 의존하므로). 세션 시작 UI는 P5에서 inspector 페이지로.
- **store.json schema test**: capabilities 필드가 있으면 무시 (no error) + 절대
  다시 쓰지 않는지 검증.
- **security CLI parsing**: 출력 형식 예:
  ```
    1) 4NC5GBGM93 "Apple Development: quotia72@gmail.com (XYZ123)"
    2) ...
       2 valid identities found
  ```
  - `(\d+)\)\s+([A-F0-9]+)\s+"([^"]+)"` 정도로 라인 파싱.
- **AppleCertSelect**: macOS 외에서도 컴포넌트는 렌더링되지만 dropdown은 disabled +
  안내. fail-quiet.
- **KV extra UI**: rows 추가/삭제. 빈 row 자동 제거. 저장 시 `Record<string, string>`으로 합침.
- **세션 카드 제거 + P5 의존**: P4와 P5 사이의 회귀 — capability 시절의 세션 기능
  (screenshot/recording)이 P5 완료 전까지 잠시 부재함. 사용자에게 안내 필요.

---

**Status:** active
**Created:** 2026-05-22
**Slug:** devices-connection-config
**Origin:** intake
**Depends on:** devices-my-storage (P2), devices-tabbed-detail-apps (P3)
**Required-by:** mobile-inspector-page (P5 — 사용중 구성을 inspector가 사용)
