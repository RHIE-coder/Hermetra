# {{slug}}

> One-paragraph statement of the change in plain language. Read this and you
> should know what's being built and why.

## Goal

{{single-sentence success criterion}}

## Scope

- {{thing in scope}}
- {{thing in scope}}

## Non-scope (explicit)

- {{thing intentionally excluded — keeps scope creep from sneaking in}}

## Acceptance criteria

Each must be testable. Each maps to ≥ 1 test in /sprint.

- [ ] {{criterion 1}}
- [ ] {{criterion 2}}

## Affected layers (CLAUDE.md §3.1)

- Pure logic: {{yes/no, where}}
- DB schema: {{yes/no, where}}
- IPC handler: {{yes/no, which channels}}
- UI component: {{yes/no, which files}}
- E2E: {{yes/no, which flow}}

## Data model changes

- {{new types}}
- {{modified types}}
- {{backward compatibility note}}

## IPC contract changes

| Channel | Direction | Input | Output |
|---|---|---|---|
| {{CHANNELS.X}} | renderer → main | {{...}} | {{...}} |

## UI flow

{{word picture or sketch — golden path}}

**States to handle:**
- Empty: {{...}}
- Loading: {{...}}
- Error: {{...}}

## i18n

New keys (must add to both `en` and `ko`):

- `{{namespace.key}}`
- `{{namespace.key}}`

## Error handling

- {{error case}} → {{how surfaced}}

## Performance / security notes

- {{anything special, or "none"}}

## Workspace / multi-tenancy

- {{per-workspace? global? changes to workspaceDir structure?}}

## Driver compatibility

- Real driver: {{behavior}}
- Mock driver: {{behavior}}

## Open notes for /sprint

- {{anything testwriter / implementer should know but doesn't fit above}}

---

**Status:** active
**Created:** {{YYYY-MM-DD}}
**Slug:** {{slug}}
