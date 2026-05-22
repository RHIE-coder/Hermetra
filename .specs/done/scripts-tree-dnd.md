# scripts-tree-dnd

> CodeEditor의 스크립트 트리 (web/mobile 공유 컴포넌트)에서 폴더/파일을
> drag&drop으로 이동 가능하게 한다. 다중 선택 (Shift/Cmd-click) 후 동시 이동
> 지원. 대상 경로에 같은 이름이 이미 있으면 에러 토스트로 알리고 이동 취소.

## Goal

CodeEditor 트리에서 폴더/파일을 drag&drop으로 옮길 수 있고, conflict 시 안전하게 막힌다.

## Scope

- HTML5 native DnD API 기반 (`draggable={true}`, `onDragStart/Over/Leave/Drop`).
- 드래그 대상: 트리의 파일 또는 폴더.
- 드롭 대상: 다른 폴더 또는 트리 루트 (`""`).
- 드롭 위치 visual indicator: 호버 중인 폴더는 강조 (e.g. `bg-accent/30` ring).
- 폴더 hover-expand: 닫혀있는 폴더 위에 ~600ms 머무르면 자동 펼침.
- 다중 선택: Cmd/Ctrl-click 토글, Shift-click 연속 범위. 선택된 항목들은
  드래그 시 함께 이동.
- Conflict policy: 대상 경로에 같은 이름이 존재하면 **에러 토스트 + 이동 취소**
  (전체 batch 중 하나라도 conflict면 전체 abort, partial move 없음).
- 자기 자신 / 자기 자손 폴더로의 이동은 시각적으로도 금지 (드롭 차단).

## Non-scope (explicit)

- 외부 OS 파일을 드래그해서 임포트하는 기능 (이번 spec 아님).
- 코드 에디터 내부에서 텍스트를 트리로 드래그하는 기능 (아님).
- Undo/redo (아님).
- 키보드만으로 이동 (아님; 추후).

## Acceptance criteria

각 항목은 테스트로 검증 가능해야 함.

- [ ] 단일 파일을 다른 폴더로 drop → 그 폴더 아래로 이동.
- [ ] 단일 폴더를 루트로 drop → 루트로 이동.
- [ ] Cmd-click으로 2개 파일 선택 + 폴더로 drop → 두 파일 모두 이동.
- [ ] Shift-click 범위 선택 + drop → 범위 내 항목 전부 이동.
- [ ] 대상 폴더에 같은 이름의 파일이 이미 있으면 → 에러 토스트 표시 +
      원본은 그대로 (한 batch에 conflict 1건이라도 있으면 전체 abort).
- [ ] 폴더를 자기 자신 또는 자기 자손에 drop → 차단 (시각적 indicator 표시
      안 됨, drop 무시).
- [ ] 닫혀있는 폴더 위에 드래그 호버 ~600ms → 자동 펼침.
- [ ] 드래그 중인 항목은 시각적으로 dim (opacity-50).

## Affected layers (CLAUDE.md §3.1)

- Pure logic: `src/main/services/scripts.ts` — `moveScript(from, to)` (파일) +
  `moveFolder(from, to)` (폴더 + 자손 일괄). 동일 경로 존재 시 throw.
- IPC handler: 신규 채널 `CHANNELS.SCRIPT_MOVE` (input: `{ from: string, to: string }[]`
  배치 단위 — 다중 선택 batch는 atomic하게 처리; 한 항목이라도 throw하면 모두 rollback).
- UI component: `src/renderer/modules/shared/CodeEditor.tsx` (DnD 핸들러 + 선택 상태 +
  visual indicator + hover-expand 타이머).
- E2E: 해당 없음 (UI component 테스트로 충분).

## Data model changes

- 새 type:
  ```ts
  // src/shared/types/web.ts
  export interface ScriptMoveRequest {
    from: string;  // existing path
    to: string;    // new path (parent + name)
  }
  ```
- `ScriptFile` 자체는 변경 없음 (path가 바뀔 뿐).

## IPC contract changes

| Channel | Direction | Input | Output |
|---|---|---|---|
| `CHANNELS.SCRIPT_MOVE` | renderer → main | `{ moves: ScriptMoveRequest[] }` | `{ ok: true } \| { ok: false, error: string, conflicts: string[] }` |

`SCRIPT_MOVE`는 atomic: 모든 move가 가능한지 dry-run (대상 경로 존재 검사) 후
실제 실행. 하나라도 실패하면 전체 rollback.

## UI flow

선택 모델:
- 단일 click → 단일 선택 (드래프트 로드는 기존 onClick 유지; 선택 표시는 별도 state).
- Cmd/Ctrl + click → 선택 set 토글.
- Shift + click → tree-flatten 기준 마지막 선택 ~ 클릭 항목 범위.

드래그 시작:
- 1개 이상 선택 상태에서 항목 grab → 선택된 모든 항목이 드래그 페이로드 (count 표시 배지).
- 미선택 항목 grab → 그것 1개만 드래그.

드롭 가능 표시:
- 폴더 위 호버: ring + 살짝 진한 배경.
- 600ms 호버 → 폴더 자동 펼침 (timer; 드래그 leave하면 timer cancel).
- 자기 자신/자손 폴더 위는 indicator 안 뜸 (드롭 이벤트도 무시).

States to handle:
- Empty: 빈 트리에 드롭 → 루트로 이동.
- Loading: SCRIPT_MOVE IPC 진행 중 → 트리 갱신은 응답 후. 실패 시 토스트.
- Error: conflict / I/O 실패 → red toast + 원본 유지.

## i18n

신규 키 (en + ko 둘 다 필수):

- `web.code.move.conflict` / `mobile.code.move.conflict` —
  "이미 같은 이름의 파일/폴더가 존재합니다." / "A file/folder with the same name already exists."
- `web.code.move.cannotIntoSelf` / `mobile.code.move.cannotIntoSelf` —
  "폴더를 자기 자신 또는 자손에 옮길 수 없습니다." / "Cannot move a folder into itself or its descendants."
- `common.move` — "이동" / "Move" (드래그 ghost 배지 텍스트용; 다른 곳에서도 재사용)

## Error handling

- IPC `SCRIPT_MOVE` 응답이 `ok: false` → 사용자에게 red toast (`conflicts` 목록을 한 줄로 요약).
- 트리 상태는 응답 전 optimistically 변경 X (실패 시 rollback 비용 큼). 응답 후 listScripts() 재호출로 갱신.
- 드롭 시 from === to → no-op (조용히 무시).

## Performance / security notes

- 폴더 이동은 자식 전체를 fs.rename으로 처리 (atomic on same fs). 다른 디스크
  cross-device는 가정 안 함 (workspaceDir 안에서만).
- hover-expand 600ms timer는 unmount 시 clear.

## Workspace / multi-tenancy

영향 없음. `workspaceManager().activeDir()` 안에서만 동작.

## Driver compatibility

해당 없음 (드라이버 무관).

## Open notes for /sprint

- **HTML5 DnD 주의점**: `e.preventDefault()` on `dragOver` is required to allow drop.
  `e.dataTransfer.effectAllowed = 'move'`.
- **다중 선택 state**: CodeEditor.tsx에 `const [selection, setSelection] = useState<Set<string>>(new Set())`.
  selection vs draft (active file) 구분. selection 클리어 timing은 폴더 toggle/스크립트 load 시.
- **테스트**: happy-dom의 DnD는 native event 시뮬레이션이 까다로움. RTL의
  `fireEvent.dragStart` / `dragOver` / `drop` 사용. DataTransfer는 `vi.fn()` 으로 stub.
- **scripts.ts moveScript/moveFolder**: 기존 saveScript/deleteScript와 유사 패턴.
  workspaceDir + path joining 시 `path.resolve` 후 workspaceDir prefix 검사
  (path traversal 방어).
- **IPC batch**: 다중 batch atomic은 dry-run (모든 target path가 비어있는지 확인)
  후 실행. 중간 실패 시 이미 옮긴 것 되돌리기는 복잡 — dry-run을 통과시키는 게
  안전한 패턴.

---

**Status:** done
**Created:** 2026-05-22
**Completed:** 2026-05-22
**Slug:** scripts-tree-dnd
**Origin:** intake
**Depends on:** none
