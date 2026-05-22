# mobile-inspector-page

> 사이드바에 `/mobile/inspector` 라우트 + 페이지를 추가한다. 사용중 연결 구성으로
> Appium 세션을 시작, 스크린샷 캡처, 화면 녹화, Native / Webview 요소 트리 추출,
> 스크린샷 위 호버 하이라이트 / 클릭 시 요소 detail 표시.

## Goal

사용중 연결 구성으로 모바일 화면 요소를 시각적으로 추출하는 inspector 페이지가 동작한다.

## Scope

- 사이드바 Mobile 그룹에 3번째 항목 추가:
  `{ to: '/mobile/inspector', labelKey: 'sidebar.mobile.inspector', icon: Crosshair, testId: 'nav-mobile-inspector' }`.
- 새 라우트 `/mobile/inspector` 등록 (App.tsx).
- 새 페이지 `MobileInspectorPage.tsx`:
  - 상단: 페이지 헤더 + 우측 "세션: 연결 안됨/연결됨" 배지.
  - Appium 비연결 시: 경고 배너 "Appium이 연결되어 있지 않습니다. Devices 상단에서 Appium 연결을
    먼저 완료해 주세요."
  - 액션 버튼 row: [세션 시작/중지] [스크린샷] [녹화 시작/중지] [요소 추출].
  - 좌측 large: 스크린샷 + overlay rect (요소 트리에서 선택/호버한 요소 강조).
  - 우측 large: Native (N) / Webview (M) tabs → 트리 view.
  - 하단 small: 선택된 요소의 상세 정보 (모든 attribute).
  - 푸터: "스크린샷 위에서 마우스를 움직이면 요소가 하이라이트됩니다. 클릭하면 선택됩니다."
- 세션 lifecycle:
  - "세션 시작" → mobile store의 사용중 연결 구성을 capability로 Appium 세션 생성.
  - 사용중 없음 → 시작 버튼 disabled.
  - 페이지 unmount 시 세션 자동 종료 (안전).
- 요소 추출:
  - Native: `driver.getPageSource()` → XML 파싱 → tree.
  - 각 노드의 `bounds` (Android `[x,y][x2,y2]` 형식) 또는 iOS의 `x/y/width/height` 속성 → 사각형 좌표.
  - Webview: `mobile:availableContexts` → WEBVIEW_* 있으면 setContext 후 getPageSource (HTML).
- 호버/클릭:
  - 스크린샷 위 mousemove: 좌표에 해당하는 가장 작은 elem rect 하이라이트.
  - 클릭: 그 elem을 선택 (오른쪽 tree에서도 동기화), 하단에 detail 표시.

## Non-scope (explicit)

- 요소 액션 (tap/swipe) 실행 — 추후.
- XPath 셀렉터 자동 생성 / 복사.
- Recorded video 편집 / 트리밍.
- 멀티 세션 (KISS: 1개만).
- iOS Webview의 Safari Web Inspector 우회 — 단순 setContext만 시도.
- Tree 검색 / 필터.

## Acceptance criteria

- [ ] 사이드바에 새 항목 "Inspector" (한글 "인스펙터") 추가, click하면 `/mobile/inspector`로 이동.
- [ ] 페이지 헤더, 액션 버튼 4개, 좌/우 패널, 하단 detail, 푸터 안내문구 렌더.
- [ ] 사용중 연결 구성이 없으면 "세션 시작" disabled + 경고 배너.
- [ ] 사용중 구성이 있고 Appium isRunning이면 "세션 시작" enabled.
- [ ] "세션 시작" → INSPECTOR_START_SESSION IPC → session.active=true → 우측 상단 배지 갱신.
- [ ] 세션 active 시 [스크린샷] → INSPECTOR_SCREENSHOT → 좌측 패널에 이미지 표시.
- [ ] 세션 active 시 [녹화 시작] → 변환되어 [녹화 중지]. 중지 시 video data URL을 표시.
- [ ] 세션 active 시 [요소 추출] → Native + Webview 트리 동시 fetch, 각 tab 카운트 갱신.
- [ ] 스크린샷 위 hover → 해당 좌표 elem이 outline. 클릭 → 선택, 하단 detail에 속성 dump.
- [ ] Tree에서 노드 클릭 → 스크린샷 위 outline 동기.
- [ ] 페이지 unmount 시 active session 자동 stop.
- [ ] Mock driver: getPageSource는 hard-coded 작은 XML (button, label 2-3개), screenshot은 더미 PNG (data URI).

## Affected layers (CLAUDE.md §3.1)

- Pure logic:
  - `src/main/drivers/mobile/appium.ts` real + mock에 메서드 추가: `startInspector(capability)`,
    `screenshot()`, `startRecording()`, `stopRecording()`, `getPageSource(context: 'native' | string)`,
    `getContexts()`, `setContext(name)`, `stopSession()`.
  - XML/HTML parser util (signal: Native bounds 추출, Webview는 DOM bounding rect).
- IPC handler: INSPECTOR_START_SESSION, INSPECTOR_STOP_SESSION, INSPECTOR_SCREENSHOT,
  INSPECTOR_START_RECORD, INSPECTOR_STOP_RECORD, INSPECTOR_GET_ELEMENTS, INSPECTOR_SET_CONTEXT.
- UI component:
  - `src/renderer/components/layout/sidebar.tsx` — 새 nav 항목 1개.
  - `src/renderer/App.tsx` — 새 Route.
  - `src/renderer/modules/mobile/pages/MobileInspectorPage.tsx` (신규).
  - `src/renderer/modules/mobile/components/inspector/ScreenshotCanvas.tsx` (신규):
    img + overlay svg/canvas로 rect 그림.
  - `src/renderer/modules/mobile/components/inspector/ElementTree.tsx` (신규).
  - `src/renderer/modules/mobile/components/inspector/ElementDetail.tsx` (신규).
- E2E: 새 nav-mobile-inspector + page-mobile-inspector testId 확인 (smoke spec에 행 추가).

## Data model changes

신규 type (src/shared/types/mobile.ts):
```ts
export interface InspectorElement {
  id: string;             // 트리 내 고유, e.g. "native:0:1:2"
  tag: string;            // class name 또는 element type
  attributes: Record<string, string>;
  bounds: { x: number; y: number; w: number; h: number } | null;
  children: InspectorElement[];
}

export interface InspectorSessionState {
  active: boolean;
  recording: boolean;
  context: 'native' | string | null; // 'native' or 'WEBVIEW_...'
}
```

## IPC contract changes

| Channel | Direction | Input | Output |
|---|---|---|---|
| `INSPECTOR_START_SESSION` | renderer → main | `{}` (사용중 conn 자동 사용) | `{ ok: true } \| { ok: false, error }` |
| `INSPECTOR_STOP_SESSION` | renderer → main | `{}` | `{ ok: true }` |
| `INSPECTOR_SCREENSHOT` | renderer → main | `{}` | `{ dataUrl: string }` |
| `INSPECTOR_START_RECORD` | renderer → main | `{}` | `{ ok: true }` |
| `INSPECTOR_STOP_RECORD` | renderer → main | `{}` | `{ dataUrl: string }` |
| `INSPECTOR_GET_ELEMENTS` | renderer → main | `{}` | `{ native: InspectorElement[], webview: InspectorElement[] }` |
| `INSPECTOR_SET_CONTEXT` | renderer → main | `{ context: 'native' \| string }` | `{ ok: true }` |

Event broadcasts (선택):
- `EVT_INSPECTOR_STATE` — session start/stop 시 renderer에 push.

## UI flow

```
[헤더: Crosshair icon + "인스펙터" title]      [세션: 연결 안됨/연결됨]

[경고 배너: Appium 미연결 시만]

[세션 시작][스크린샷][녹화 시작][요소 추출]

┌────────────────────┬─────────────────────────┐
│                    │ Native (N) | Webview (M) │
│                    │                          │
│   (screenshot)     │   tree                   │
│   + overlay rect   │     ▽ XCUIApplication    │
│                    │       ▽ XCUIElement      │
│                    │         ...              │
│                    │                          │
└────────────────────┴─────────────────────────┘
[하단 detail: 요소를 선택하면 상세 정보가 여기에 표시됩니다.]
[푸터 안내]
```

States to handle:
- Empty (no session): 좌/우 패널 placeholder 텍스트.
- Loading (스크린샷 캡처 / 요소 추출 진행 중): button spinner.
- Error: 빨간 toast + 결과 영역 안내.

## i18n

신규 키 (en + ko):

- `sidebar.mobile.inspector` — "인스펙터" / "Inspector"
- `mobile.inspector.title` — "세션/요소" / "Session / Elements"
- `mobile.inspector.subtitle` — "사용중 연결 구성으로 화면을 캡처하고 요소를 추출합니다." / "Capture screen and extract elements with the active connection config."
- `mobile.inspector.appiumNotConnected` — "Appium이 연결되어 있지 않습니다. Devices 상단에서 Appium 연결을 먼저 완료해 주세요." / "Appium is not connected. Connect Appium at the top of the Devices page first."
- `mobile.inspector.startSession` — "세션 시작" / "Start session"
- `mobile.inspector.stopSession` — "세션 중지" / "Stop session"
- `mobile.inspector.sessionConnected` — "연결됨" / "Connected"
- `mobile.inspector.sessionDisconnected` — "연결 안됨" / "Disconnected"
- `mobile.inspector.screenshot` — "스크린샷" / "Screenshot"
- `mobile.inspector.startRecord` — "녹화 시작" / "Start recording"
- `mobile.inspector.stopRecord` — "녹화 중지" / "Stop recording"
- `mobile.inspector.extract` — "요소 추출" / "Extract elements"
- `mobile.inspector.emptyScreenshot` — "스크린샷이 없습니다." / "No screenshot."
- `mobile.inspector.emptyElements` — "요소가 없습니다." / "No elements."
- `mobile.inspector.emptyDetail` — "요소를 선택하면 상세 정보가 여기에 표시됩니다." / "Select an element to see details."
- `mobile.inspector.hint` — "스크린샷 위에서 마우스를 움직이면 요소가 하이라이트됩니다. 클릭하면 선택됩니다." / "Hover over the screenshot to highlight; click to select."

## Error handling

- 세션 시작 시 Appium 연결 실패 → red toast + 오류 메시지. UI는 disconnected 상태 유지.
- getPageSource 실패 → tree 영역 "추출 실패: <msg>" + 재시도 버튼.
- setContext WEBVIEW_* 실패 → Webview tab만 빈 상태 + 안내.
- 녹화 중 세션 종료 / 페이지 unmount → 우선 stopRecord 시도 후 stopSession.

## Performance / security notes

- screenshot은 base64 data URL — 큰 이미지는 메모리 부담. 최대 1MP 정도 가정.
- 녹화 비디오는 base64 — 30초 가정, 수 MB. UI에서 video tag로 직접 stream.
- getPageSource는 큰 화면일수록 무거움 (수백 KB XML 가능). parsing은 한 번만,
  결과를 캐시 (사용자가 "다시 추출" 누르기 전까지).
- 페이지 unmount 시 미정리 세션은 device 점유 → 반드시 stopSession useEffect cleanup.

## Workspace / multi-tenancy

영향 없음 — 세션은 in-memory only. 단 사용중 연결 구성은 per-workspace (P4).

## Driver compatibility

- Real: Appium의 WebdriverIO 클라이언트 사용. `mobile:startRecordingScreen` /
  `stopRecordingScreen`, `getPageSource`, `getContexts`, `setContext`.
- Mock:
  - startInspector → 즉시 ok.
  - screenshot → 작은 dummy PNG (data URI). bounds 좌표계 검증용으로 충분.
  - getPageSource → hard-coded XML (예: 2-3개 button + label).
  - startRecording/stopRecording → 빈 dataUrl + 즉시 반환.
  - getContexts → ['NATIVE_APP', 'WEBVIEW_com.example'].
  - setContext → 항상 ok.

## Open notes for /sprint

- **사이드바 추가는 redesign-scope-overreach 룰 (ledger) 영향?**:
  - 룰 trigger는 "apply this design" 또는 design screenshot. user가 명시적으로
    새 페이지 요구 (intake 답변 "새 사이드바 항목 (Mobile 그룹 3번째)") → 룰 위반 X.
  - 하지만 implementer는 spec 외 다른 nav 변경 금지.
- **XML parsing**: DOMParser가 main process Node에 없으므로 `@xmldom/xmldom` 등
  추가 필요. 또는 sax-style minimal parser util 작성 (Android bounds 형식 limited).
- **bounds parsing**:
  - Android: `[x1,y1][x2,y2]` regex.
  - iOS: 각 elem attr x, y, width, height integer.
- **Webview overlay**: Webview DOM에는 native bounds가 없음. getBoundingClientRect는 webview 내부 좌표
  → screenshot은 native 좌표라 단순 매핑 불가. 1차 iteration은 Webview는 tree만, hover-highlight 없이.
  (acceptance criterion #9는 native에 한정 — 명시 필요.)
- **세션 / 구성 의존**: P4의 activeConnectionId 없으면 시작 불가. P4까지 미완 상태라면 진행 불가.
  /sprint testwriter가 P4 완료를 prerequisite로 가정 가능.
- **mobile store**: 기존 store에 inspectorSession state 추가, useEffect로 unmount cleanup.

---

**Status:** done
**Created:** 2026-05-22
**Completed:** 2026-05-22
**Slug:** mobile-inspector-page
**Origin:** intake
**Depends on:** devices-my-storage (P2), devices-tabbed-detail-apps (P3),
  devices-connection-config (P4)
**Required-by:** (none — P5 is leaf)
