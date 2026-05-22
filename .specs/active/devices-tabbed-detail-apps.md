# devices-tabbed-detail-apps

> DevicesPage에 "기기관리 / 연결구성" 탭 구조를 도입하고, 기기 상세 panel에 "정보 / 앱"
> 탭을 추가한다. 앱 탭은 libimobiledevice / adb로 설치된 앱 목록을 조회해 표시.
> 도구 설치 상태 (Appium/ADB/libimobiledevice)는 상단 헤더 옆 체크/경고 아이콘
> 으로 축소하고, 마우스 호버 시 원본 도구 카드 모달을 오버레이로 표시. 연결구성
> 탭 내용물은 P4에서.

## Goal

Devices 페이지가 탭 구조로 정리되고, 디바이스마다 설치된 앱을 볼 수 있다.

## Scope

- 페이지 상단에 `Tabs` 도입: "기기 관리" / "연결 구성".
- 기기 관리 tab 내용: P2에서 만든 실시간 연결 + 내 디바이스 + 기기 상세 panel.
- 연결 구성 tab 내용: placeholder ("P4에서 구현 예정" 또는 단순 빈 상태). 빈 시각.
- 기기 상세 panel에 "정보 / 앱" 탭 도입.
- "앱" 탭:
  - 헤더: "설치된 앱 (N/M)" — N은 필터 결과, M은 전체. 새로고침 버튼.
  - 검색 input: 이름/Bundle ID/버전 substring 매칭.
  - 리스트: 각 row = 이름 (큰), bundle ID (작음 muted), 버전 (우측 정렬 muted).
  - 데이터 소스: Mobile driver의 `listInstalledApps(deviceId)`.
    - iOS real: `ideviceinstaller -l` 출력 파싱.
    - Android: `adb shell pm list packages -3` + `dumpsys package <pkg> | grep versionName` (또는 `cmd package list packages --show-versioncode`).
    - Mock: hard-coded 13개 dummy (image 2 기준).
- 헤더 도구 상태 아이콘:
  - DevicesPage `<h1>` 옆에 작은 status icon.
  - 모든 도구 설치 완료 → 체크 (green), 1개 이상 미흡 → warning (amber).
  - 호버 시 기존 "도구" 카드를 modal로 띄움 (Popover 또는 floating panel).
  - 기존 "도구" 카드와 "Appium 서버" 카드는 페이지 본문에서 제거.

## Non-scope (explicit)

- 앱 아이콘 표시 (이미지 2에도 없음).
- 앱 설치/삭제 / 실행 기능.
- 앱 권한 / 정보 deep dive.
- 연결 구성 panel 실제 내용 — P4.
- Appium 서버 시작/중지 UI — 호버 모달 안으로 옮김 (구현은 그대로).
- 세션/요소 페이지 — P5.

## Acceptance criteria

- [ ] DevicesPage가 두 개 탭 ("기기 관리" / "연결 구성")으로 분리. 초기 탭은 "기기 관리".
- [ ] 기기 관리 탭은 P2 레이아웃 (실시간 연결 + 내 디바이스 + 기기 상세) 유지.
- [ ] 디바이스 상세 panel에 "정보" / "앱" 탭. 정보 tab은 P2와 동일 내용.
- [ ] "앱" 탭 활성화 시: `mobile.driver.listInstalledApps(deviceId)` 호출 → 결과 리스트 표시.
- [ ] 앱 리스트는 검색 input의 substring (대소문자 무시)로 즉시 필터링.
- [ ] 새로고침 버튼 → 리스트 재조회.
- [ ] 페이지 헤더 옆에 도구 상태 아이콘. 호버 시 도구 카드 모달이 오버레이.
- [ ] 도구 상태가 모두 OK → 체크 아이콘, 1개라도 미흡 → 경고 아이콘 (색은 디자인 토큰).
- [ ] Mock driver에서는 dummy 13개 앱 반환, 첫 호출 시 즉시 (지연 없이).
- [ ] 연결 구성 탭은 "곧 구현 예정" 같은 placeholder만 표시 (P4 표시).

## Affected layers (CLAUDE.md §3.1)

- Pure logic: `src/main/drivers/mobile/appium.ts` (real) + mock에 `listInstalledApps(deviceId): Promise<InstalledApp[]>` 추가.
  iOS는 spawn `ideviceinstaller -l`, Android는 spawn `adb shell pm list packages`
  + `dumpsys`. 결과 parsing은 util 함수로 분리해 unit test 가능.
- IPC handler: `CHANNELS.DEVICE_APPS_LIST` 추가.
- UI component:
  - `DevicesPage.tsx` 재구성 (Tabs root + 헤더 status icon).
  - 신규 `DeviceAppsTab.tsx` (검색 + 리스트).
  - 신규 `ToolingStatusBadge.tsx` (헤더 옆 아이콘 + 호버 모달).
- E2E: 기존 `nav-mobile-devices`가 여전히 도착하는지, 탭 전환 후 page-mobile-devices testId가 유지되는지 확인.

## Data model changes

- 신규 type `src/shared/types/mobile.ts`:
  ```ts
  export interface InstalledApp {
    name: string;
    bundleId: string;
    version: string;
  }
  ```
- 저장 X. 매번 driver에서 fetch.

## IPC contract changes

| Channel | Direction | Input | Output |
|---|---|---|---|
| `CHANNELS.DEVICE_APPS_LIST` | renderer → main | `{ deviceId: string }` (`<platform>:<udid>`) | `{ apps: InstalledApp[] }` |

호출 비용: 디바이스에 따라 1-5초 (real). UI는 spinner.

## UI flow

```
[헤더: Smartphone icon + "디바이스" title + ToolingStatusBadge (호버→모달)]
[Tabs: 기기 관리 (active) / 연결 구성]

(기기 관리 tab content — P2 레이아웃)
┌────────────────────────────┬─────────────────────────────┐
│ 실시간 연결                │ 기기 상세                   │
│  - device row              │  [정보] [앱]                │
│ 내 디바이스                │                             │
│  - saved row (selected)    │  (현재 탭 컨텐츠)           │
└────────────────────────────┴─────────────────────────────┘
```

앱 tab 내부:
```
설치된 앱 (3/13)           [새로고침]
[검색 input: 이름/Bundle ID/버전]
┌────────────────────────────────────────┐
│ WebDriverAgentRunner-Runner    v1.0    │
│ com.mhrhie.WebDriverAgentRunner...     │
├────────────────────────────────────────┤
│ Chrome                  v148.7778.100  │
│ com.google.chrome.ios                  │
└────────────────────────────────────────┘
```

States:
- Empty (필터 결과 없음): "조건에 맞는 앱이 없습니다."
- Loading: spinner + "앱 목록 조회 중..."
- Error: red toast + "다시 시도" 버튼.

## i18n

신규 키 (en + ko):

- `mobile.devices.tab.management` — "기기 관리" / "Device management"
- `mobile.devices.tab.connection` — "연결 구성" / "Connection config"
- `mobile.devices.tab.connection.placeholder` — "연결 구성은 곧 구현 예정입니다." / "Connection config coming soon."
- `mobile.devices.apps.installed` — "설치된 앱" / "Installed apps"
- `mobile.devices.apps.search` — "앱 검색 (이름/Bundle ID/버전)" / "Search apps (name/bundle ID/version)"
- `mobile.devices.apps.empty` — "조건에 맞는 앱이 없습니다." / "No matching apps."
- `mobile.devices.apps.loading` — "앱 목록 조회 중..." / "Loading apps..."
- `mobile.devices.apps.refresh` — "새로고침" / "Refresh" (already exists as common.refresh — 재사용)
- `mobile.devices.tooling.statusOk` — "모든 도구가 설치되어 있습니다" / "All tools installed"
- `mobile.devices.tooling.statusMissing` — "일부 도구가 누락되었습니다" / "Some tools are missing"

## Error handling

- ideviceinstaller / adb 명령어 실패 → empty list + toast with stderr tail.
- 디바이스가 연결 끊긴 사이에 호출 → "디바이스 연결 안 됨" toast.
- Mock driver는 실패 simulation 없음 (항상 성공).

## Performance / security notes

- `listInstalledApps`는 expensive (real 1-5초). 자동 polling 금지. 사용자 새로고침 명시 클릭에만.
- spawn 명령어는 main process에서만. stdout/stderr buffer는 maxBuffer 옵션 충분히 (10MB) 또는 streaming.
- 검색 필터는 client-side (이미 받아온 리스트).

## Workspace / multi-tenancy

영향 없음. App list는 device-level이므로 workspace 무관.

## Driver compatibility

- Real:
  - iOS: `which ideviceinstaller` 확인 → 없으면 ToolingStatusBadge가 경고 표시.
    있으면 `ideviceinstaller -u <udid> -l` 호출.
  - Android: `adb -s <serial> shell pm list packages -3` (3rd party only로 시작; 변경 가능) +
    각 pkg에 대해 `dumpsys` 또는 한 번에 `cmd package list packages -3 --show-versioncode`.
- Mock: 13개 hard-coded (이름/번들/버전), 즉시 반환.

## Open notes for /sprint

- **Tabs 컴포넌트**: 이미 `@/components/ui/tabs` 같은 게 있는지 확인 (shadcn). 없으면
  Radix tabs 추가.
- **ToolingStatusBadge 호버 모달**: shadcn의 Popover 사용. P4의 호버 모달과 동일
  컴포넌트 재사용 가능.
- **앱 검색 debounce**: 이미 받아온 리스트에 대한 client-side filter이므로 debounce 불필요.
  단순 controlled input.
- **카드 제거**: 기존 DevicesPage의 "도구" 카드와 "Appium 서버" 카드의 내용은 호버 모달 안으로
  이동. 컴포넌트 코드는 그대로 옮기되 wrapping만 바뀜. 캐퍼빌리티 카드 / 세션 카드는
  아직 살아있음 (P4/P5에서 제거).
- **driver i/f 변경**: `MobileDriver` interface에 `listInstalledApps` 추가. 인터페이스
  변경은 모든 구현체 (real + mock) 동시 수정 필요 — TypeScript가 강제.

---

**Status:** active
**Created:** 2026-05-22
**Slug:** devices-tabbed-detail-apps
**Origin:** intake
**Depends on:** devices-my-storage (P2)
**Required-by:** devices-connection-config (P4 — app dropdown 소스), mobile-inspector-page (P5 — 호버 모달 재사용)
