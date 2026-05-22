# devices-my-storage

> 물리 디바이스를 `<userData>/devices.json` (global)에 저장하는 "내 디바이스"
> 개념을 도입한다. DevicesPage를 "실시간 연결" + "내 디바이스" + "기기 상세 (정보 tab)"
> 레이아웃으로 바꾸고, 디바이스 저장/삭제/Alias 편집 IPC를 신설한다. 앱 탭은 P3,
> 연결구성 탭은 P4에서.

## Goal

UDID/serial 기준으로 디바이스를 영구 저장하고, 실시간 연결과 분리해서 보여준다.

## Scope

- 신규 저장소: `<userData>/devices.json` (global; workspaces.json과 같은 위치).
- 데이터 shape: `{ devices: SavedDevice[] }`. SavedDevice = id(`platform:udid`),
  platform, udid, name, alias, lastConnectedAt (ISO string), kind ('real' | 'sim/emu').
- 신규 IPC: DEVICE_LIST_SAVED, DEVICE_SAVE, DEVICE_REMOVE, DEVICE_UPDATE_ALIAS.
- UI: DevicesPage 재구성.
  - 좌측 컬럼: "실시간 연결" 카드 (현재 detected devices, "내 디바이스로 저장" 버튼) +
    "내 디바이스" 카드 (저장된 목록, 연결 상태 배지).
  - 우측 컬럼: "기기 상세" 패널. 현재는 정보 tab만 (앱 tab은 P3에서).
    - 정보: 이름 (read-only), Alias (편집 가능, 선택 시), UDID (copy 버튼),
      플랫폼, 타입 (real/sim), 상태 배지, 마지막 연결 시각.
    - 미저장 디바이스 선택 시: "내 디바이스로 저장" CTA button (하단).
    - 저장된 디바이스 선택 시: "내 디바이스에서 삭제" 버튼.
- 도구 카드 / Appium 서버 카드 / 캐퍼빌리티 카드 / 세션 카드는 **이번 phase에서 일단 유지**
  (P3에서 위치 이동, P4/P5에서 대체될 예정). 단 새 레이아웃에 자연스럽게 들어맞게
  하단으로 밀어 넣음.

## Non-scope (explicit)

- 탭 (기기관리 / 연결구성) 도입 — P3.
- 앱 리스트 탭 — P3.
- 연결구성 panel — P4.
- 세션/요소 페이지 — P5.
- 도구 상태 아이콘 + 호버 모달 — P3.
- 디바이스 정보 외 fingerprint (model, OS version) 자동 수집 — 추후.

## Acceptance criteria

- [ ] `<userData>/devices.json`이 없으면 `{ devices: [] }`로 자동 seed.
- [ ] "내 디바이스로 저장" 버튼 → 해당 detected device가 devices.json에 추가, "내 디바이스" 목록에 즉시 표시.
- [ ] "내 디바이스에서 삭제" → 목록에서 제거, devices.json에서 entry 삭제.
- [ ] Alias 입력 후 blur → DEVICE_UPDATE_ALIAS IPC → 다음 list/render에 반영.
- [ ] 같은 UDID가 다시 detect되면 lastConnectedAt 업데이트.
- [ ] "내 디바이스" 목록의 각 entry는 현재 실시간으로 연결되어 있는지(`devices[]`와 UDID 매칭)에
      따라 "연결됨" / "연결안됨" 배지 표시.
- [ ] 한 entry 선택 → 우측 "기기 상세" panel이 그 정보를 표시.
- [ ] 화면 새로고침 후에도 저장된 디바이스 유지.

## Affected layers (CLAUDE.md §3.1)

- Pure logic: `src/main/services/myDevices.ts` (신규) — read/write devices.json,
  upsert, delete, updateAlias.
- DB schema: 신규 `devices.json` (global). tests/schema/myDevices.test.ts 추가.
- IPC handler: `src/main/ipc/register.ts`에 4개 채널 추가.
- UI component: `src/renderer/modules/mobile/pages/DevicesPage.tsx` 재구성.
  새 sub-component: `MyDeviceCard.tsx`, `LiveDeviceCard.tsx`, `DeviceDetailPanel.tsx`
  (단 P3에서 탭 추가 시 다시 wrapping될 수 있으므로 hierarchy는 implementer 재량).
- E2E: 기존 nav 테스트가 깨지지 않는지 확인 (sidebar `nav-mobile-devices`는 유지).

## Data model changes

- 신규 type `src/shared/types/mobile.ts`:
  ```ts
  export interface SavedDevice {
    id: string;             // `${platform}:${udid}` 정규화 키
    platform: 'ios' | 'android';
    udid: string;           // raw UDID/serial
    name: string;           // 최초 저장 시점의 device name
    alias?: string;         // 사용자 별칭
    kind?: 'real' | 'sim' | 'emu';
    lastConnectedAt: string; // ISO
  }
  ```
- 기존 `MobileDevice` (실시간 detected 결과)는 유지. SavedDevice와는 별도.

## IPC contract changes

| Channel | Direction | Input | Output |
|---|---|---|---|
| `CHANNELS.DEVICE_LIST_SAVED` | renderer → main | `{}` | `{ devices: SavedDevice[] }` |
| `CHANNELS.DEVICE_SAVE` | renderer → main | `{ device: SavedDevice }` (id/udid/platform 필수) | `{ ok: true }` |
| `CHANNELS.DEVICE_REMOVE` | renderer → main | `{ id: string }` | `{ ok: true }` |
| `CHANNELS.DEVICE_UPDATE_ALIAS` | renderer → main | `{ id: string, alias: string \| null }` | `{ ok: true }` |

이벤트 (선택): saved list가 바뀌면 `EVT_DEVICES_CHANGED` 등을 brodcast해서 다른
탭/window가 sync — 첫 iteration은 단일 window이므로 생략 가능.

## UI flow

레이아웃 (image 1, 3 기준):

```
[기존 헤더 — Smartphone icon + "디바이스" title]
[기존: 도구 카드 / Appium 서버 카드 (P3에서 처리될 예정 — 일단 유지)]

┌────────────────────────────┬─────────────────────────────┐
│ 실시간 연결                │ 기기 상세                   │
│  - 이민형의 iPhone (IOS·r) │  [정보 tab] [앱 tab(disabled)] │
│  "내 디바이스로 저장" 힌트 │                             │
├────────────────────────────┤  이름: ...                  │
│ 내 디바이스                │  UDID: ... [copy]           │
│  - (selected) saved device │  플랫폼/타입/상태/마지막연결 │
│  - 저장된 디바이스 없음    │                             │
└────────────────────────────┤  [내 디바이스로 저장]        │
                             │    또는                      │
                             │  Alias 입력 + [삭제]         │
                             └─────────────────────────────┘
[기존: 캐퍼빌리티 / 세션 카드 (P4/P5에서 대체)]
```

States to handle:
- Empty: 실시간/내 디바이스 모두 빈 상태 → 빈 메시지.
- Loading: IPC 진행 중 → 비활성화 + spinner.
- Error: 파일 I/O 실패 → toast.

## i18n

신규 키 (en + ko):

- `mobile.devices.liveConnections` — "실시간 연결" / "Live connections"
- `mobile.devices.myDevices` — "내 디바이스" / "My devices"
- `mobile.devices.saveToMy` — "내 디바이스로 저장" / "Save to my devices"
- `mobile.devices.removeFromMy` — "내 디바이스에서 삭제" / "Remove from my devices"
- `mobile.devices.alias` — "별칭" / "Alias"
- `mobile.devices.aliasPlaceholder` — "별칭을 입력하세요" / "Enter alias"
- `mobile.devices.detail` — "기기 상세" / "Device detail"
- `mobile.devices.info` — "정보" / "Info"
- `mobile.devices.apps` — "앱" / "Apps" (P3에서 활성, P2에선 disabled label)
- `mobile.devices.lastConnected` — "마지막 연결" / "Last connected"
- `mobile.devices.saveHint` — "\"내 디바이스로 저장\"하면 연결이 해제되어도 목록에 유지됩니다." /
  "Saving to My Devices keeps the entry visible after disconnect."

## Error handling

- devices.json 파싱 실패 → 백업 후 fresh seed + toast.
- IPC throw → red toast, 트리/패널 상태는 호출 전과 동일 유지.

## Performance / security notes

- devices.json은 작음 (< 100 entries 가정). sync I/O 허용.
- UDID는 민감하지 않지만 alias는 사용자 입력이므로 sanitize 없이 그대로 저장.
- workspace 변경 시에도 devices.json은 변하지 않음 (global).

## Workspace / multi-tenancy

`<userData>/devices.json` — global. workspaceManager().activeDir()를 통하지 않고
electron `app.getPath('userData')` 직접 사용. CLAUDE.md §2.6 "genuinely global"
예외 적용 — 명시적으로 spec에 정당화 기재.

## Driver compatibility

- Real driver: detected devices를 그대로 반환. UDID 부재 시 entry 생성 불가 (skip).
- Mock driver: hard-coded `dummyDevices = [{ platform: 'ios', udid: 'MOCK-IOS-1', name: 'Mock iPhone', kind: 'real' }]`
  최소 1개 제공 → 사용자가 "저장" → devices.json 정상 작동 검증.

## Open notes for /sprint

- **schema lock**: tests/schema/myDevices.test.ts에 zod 또는 manual validator로
  shape 고정. 후속 phase가 필드 추가 시 backwards-compatible 강제.
- **DeviceDetailPanel**: P3에서 탭 (정보/앱) 도입 시 wrapping을 다시 손봐야 함.
  이번 phase에서는 "정보" 영역만 만들고 "앱" tab은 disabled trigger로 placeholder.
- **저장 시 lastConnectedAt**: 최초 저장 시점 = now(). 이후 같은 UDID detection 시
  자동 update. Mobile store의 refreshDevices() loop에서 trigger.
- **CLAUDE.md §3.5 보존**: tests는 os.tmpdir() 하위에서. 실제 ~/Library/Application Support/Hermetra/는 절대 건들지 말 것.
- 기존 capability data 삭제는 P4 책임. 이번 phase에서는 capability를 건들지 않음.

---

**Status:** done
**Created:** 2026-05-22
**Completed:** 2026-05-22
**Slug:** devices-my-storage
**Origin:** intake
**Depends on:** none
**Required-by:** devices-tabbed-detail-apps (P3), devices-connection-config (P4),
  mobile-inspector-page (P5)
