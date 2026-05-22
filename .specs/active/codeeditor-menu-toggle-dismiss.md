# codeeditor-menu-toggle-dismiss

> CodeEditor (web/mobile 공유)의 "+" 메뉴를 같은 버튼 재클릭으로 닫을 수 있게
> 하고, 메뉴/트리거 외 영역 클릭 시 닫히는 기존 동작은 유지·보강한다.

## Goal

CodeEditor "+" 버튼이 toggle로 동작하고, 메뉴/트리거 외 영역 mousedown 시 메뉴가 닫힌다.

## Scope

- 사이드바 헤더 "+" 버튼 (`CodeEditor.tsx:441-448`)과 각 폴더 "+" 버튼
  (`CodeEditor.tsx:297-306`)을 toggle 동작으로 변경: 자기가 연 메뉴면 닫고,
  아니면 그 위치의 메뉴로 전환.
- 기존 document `mousedown` 핸들러 (`CodeEditor.tsx:185-192`)를 보강하여
  트리거 자기 자신은 외부 클릭으로 잡지 않도록 한다 (재클릭 시
  mousedown→close → click→open 레이스 제거).

## Non-scope (explicit)

(해당 없음 — /quick은 single-layer 변경에만 사용)

## Acceptance criteria

각 항목은 테스트로 검증 가능해야 함.

- [ ] 메뉴가 열린 상태에서 같은 "+" 버튼 클릭 → 메뉴가 닫힌다 (toggle).
- [ ] 메뉴가 열린 상태에서 다른 "+" 버튼 클릭 → 그 위치의 메뉴로 전환된다.
- [ ] 메뉴/트리거 외 영역 mousedown → 메뉴가 닫힌다 (기존 동작 회귀 방지).
- [ ] 메뉴 내부 항목 (New File / New Folder) 클릭은 외부 클릭으로 잡히지 않는다
      (회귀 방지).

## Affected layers (CLAUDE.md §3.1)

- UI component: `src/renderer/modules/shared/CodeEditor.tsx` — web/mobile이 공유하는
  단일 파일. 양 페이지 (`WebCodePage.tsx`, `MobileCodePage.tsx`)는 props만 전달하므로
  이 파일 하나만 수정하면 양쪽이 모두 적용된다.

## Data model changes

(해당 없음)

## IPC contract changes

(해당 없음)

## UI flow

기존 메뉴 위치 / 디자인 / 호출 트리거 표시 변경 없음.

- 트리거 버튼에 `data-menu-trigger="<parent>"` attribute 추가 (테스트용 식별자 +
  document mousedown 핸들러의 제외 식별자 겸용)
- 메뉴 자체에는 변경 없음

States to handle:
- Empty: 해당 없음
- Loading: 해당 없음
- Error: 해당 없음

## i18n

(해당 없음 — 사용자에게 보이는 새 문자열 없음)

## Error handling

(해당 없음)

## Performance / security notes

(해당 없음)

## Workspace / multi-tenancy

(해당 없음)

## Driver compatibility

(해당 없음)

## Open notes for /sprint

- **구현 힌트**:
  - `openMenu(parent)` → `toggleMenu(parent)`로 바꾸고
    `setMenuParent((c) => c === parent ? null : parent)`로 구현.
  - 두 "+" 버튼에 `data-menu-trigger={parent}` (top-level은 `""`).
  - 기존 `useEffect`의 mousedown 핸들러에서 `target.closest('[data-menu-trigger]')`의
    `data-menu-trigger` 값이 현재 `menuParent`와 같으면 close를 스킵한다.
- **테스트 layer**: UI component. 신규 파일
  `src/renderer/modules/shared/CodeEditor.test.tsx`에 4개 시나리오:
  1. same-trigger toggle (열린 상태에서 같은 + 다시 클릭 → 닫힘)
  2. cross-trigger swap (다른 + 클릭 → 전환)
  3. outside dismiss (`fireEvent.mouseDown(document.body)` → 닫힘)
  4. inside-menu click no-op (메뉴 항목 클릭은 외부 dismiss로 잡히지 않음)
- **Test 환경 주의**: 컴포넌트가 `useTheme` (next-themes), `useT` (i18n) 등을 사용함.
  최소 props만 mock하고 `monaco-editor`는 `vi.mock`으로 stub.

---

**Status:** active
**Created:** 2026-05-22
**Slug:** codeeditor-menu-toggle-dismiss
**Origin:** quick
