# scripts-folder-tree

> Replace the flat-list sidebar in Web & Mobile script editors with a tree
> that supports nested folders. The `+` button opens a menu (New file / New
> folder); new files are written to disk immediately (empty + seed comment)
> so they appear in the tree at once.

## Goal

User can organize web/mobile scripts in nested folders and create new files
or folders directly from the sidebar without using `window.prompt`.

## Scope

- Recursive listing of files + folders from `<workspaceDir>/scripts/{web,mobile}/`
- `mkdir` operation for empty folders
- `+` dropdown menu with two options: New file, New folder
- Tree rendering with expand/collapse
- Per-folder hover `+` button for nested creation
- Nested folders unlimited depth
- New file is written empty (with seed comment) immediately

## Non-scope (explicit)

- Drag-and-drop reordering or moving between folders
- Rename in place (delete + recreate is fine for now)
- Tree state persistence across sessions
- Multi-select operations
- Folder-level metadata (icons, colors, descriptions)

## Acceptance criteria

- [ ] `scripts.list(slot)` returns `{ path, name, type: 'file' | 'folder' }[]`
      recursively, folders before files within the same parent
- [ ] `scripts.mkdir(slot, path)` creates an empty folder, supports nesting
- [ ] `scripts.save(slot, body)` auto-creates parent folders for nested paths
- [ ] `scripts.remove(slot, path)` deletes recursively if path is a folder
- [ ] All script-service paths are sandboxed to the workspace scripts dir
- [ ] `+` button in sidebar opens a dropdown with "New file" / "New folder"
- [ ] Selecting either opens an inline input row; Enter commits, Escape cancels
- [ ] New file commit writes empty file to disk immediately and selects it in editor
- [ ] New folder commit creates folder and expands it
- [ ] Folder rows toggle expand/collapse on click
- [ ] Folder rows have hover `+` for nested creation
- [ ] Click outside menu closes it

## Affected layers (CLAUDE.md §3.1)

- Pure logic: yes — `src/main/services/scripts.ts` (recursive walk, mkdir)
- DB schema: no — filesystem is the source of truth
- IPC handler: yes — new `WEB_SCRIPTS_MKDIR`, `MOBILE_SCRIPTS_MKDIR` channels
- UI component: yes — `src/renderer/modules/shared/CodeEditor.tsx` (tree + menu)
- E2E: no — covered by component + service tests

## Data model changes

- `ScriptFile` adds `type: 'file' | 'folder'` (was just `{ path, name }`)
- No backward compat needed — `ScriptFile` only crosses IPC at runtime, not persisted

## IPC contract changes

| Channel | Direction | Input | Output |
|---|---|---|---|
| `WEB_SCRIPTS_MKDIR` | renderer → main | `{ path: string }` | `ScriptFile[]` |
| `MOBILE_SCRIPTS_MKDIR` | renderer → main | `{ path: string }` | `ScriptFile[]` |

## UI flow

User clicks `+` on the sidebar header → small floating panel appears with
"New file" and "New folder" buttons → selecting one inserts an inline input
row at the relevant depth → user types name → Enter commits, blur commits,
Escape cancels.

For nested creation, hover on a folder row reveals a `+` button next to the
trash icon; clicking it opens the same menu but scoped to that folder as parent.

**States to handle:**
- Empty: "아직 스크립트가 없습니다." (also clears once any item exists)
- Loading: not applicable — list is sync once received
- Error: name with `/` or `..` is sanitized client-side; path-escape on main side throws and surfaces via existing IPC error path

## i18n

New keys (must add to both `en` and `ko`):

- `web.code.newFile`
- `web.code.newFolder`
- `web.code.newItem`
- `web.code.folderNamePrompt`
- `web.code.deleteFileConfirm`
- `web.code.deleteFolderConfirm`
- `web.code.empty`

## Error handling

- Path escape attempt (`../foo`): main-side `safePath` throws `Invalid path`,
  surfaces as a generic error toast (no special UI — these are programmer
  errors, not user errors).

## Performance / security notes

- `safePath` must verify normalized path stays inside the workspace scripts
  dir, using `path.sep`-aware prefix comparison (not raw `startsWith`).

## Workspace / multi-tenancy

- Files and folders live under `workspaceDir/scripts/{web,mobile}/`. Switching
  workspace re-lists from the new dir (already handled by App.tsx init flow).

## Driver compatibility

- Not applicable — this is pure storage UI, drivers untouched.

## Open notes for /sprint

- `window.prompt` is blocked in Electron renderer by default; that's why the
  previous `+` button appeared inert. Replace with inline input.
- Reuse the `.panel` component class from `global.css` for the dropdown — do
  NOT use `bg-popover` (not in `tailwind.config.ts`; see ledger entry
  `design-token-fabrication`).

---

**Status:** done
**Created:** 2026-05-22
**Slug:** scripts-folder-tree
