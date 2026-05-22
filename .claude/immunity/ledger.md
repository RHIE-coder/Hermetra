# Immunity Ledger

Append-only record of mistakes the team has paid for. Every agent in the
`/sprint` loop reads this file at the start of its turn and **must not violate
any entry**. New entries are added via `/immunize`.

Entry schema:

```yaml
- id: <kebab-slug>
  added: <YYYY-MM-DD>
  trigger: <when this mistake tends to happen>
  mistake: <what went wrong, concretely>
  correct: <what to do instead>
  rule: <optional regex; if a Write/Edit content matches, the hook blocks>
  source: <PR / incident / conversation reference>
```

The `rule:` field is **machine-checked** by `.claude/hooks/immunity-rules-guard.mjs`
on every Write/Edit. Use it for hard, unambiguous patterns. Omit it when the
lesson is judgement-based.

---

## Entries

- id: design-token-fabrication
  added: 2026-05-22
  trigger: Writing Tailwind utility classes in .tsx files.
  mistake: Used `bg-popover` (and similar shadcn defaults like `bg-sidebar`)
    without checking `tailwind.config.ts`. The class is silently dropped by
    Tailwind because the token is not registered, so the element renders
    transparent and the user has to catch it visually.
  correct: Before writing `bg-X`, `text-X`, `border-X`, `ring-X`, grep
    `tailwind.config.ts` to confirm the token exists. If a needed token is
    missing, add it to `global.css` + `tailwind.config.ts` first. Reuse the
    existing semantic tokens (`card`, `accent`, `muted`, `destructive`, ...)
    or the `.panel` component class for floating opaque surfaces.
  rule: \b(?:bg|text|border|ring|from|via|to|decoration|outline|divide|placeholder|caret|fill|stroke|shadow)-(?:popover|sidebar|input-foreground|popover-foreground|sidebar-foreground|sidebar-accent|sidebar-border|sidebar-ring|chart-[1-9])\b
  source: CodeEditor.tsx dropdown menu rendered transparent; user incident 2026-05-22.

- id: tdd-implementation-first
  added: 2026-05-22
  trigger: Adding new behavior (feature, bugfix, refactor with new tests).
  mistake: Wrote implementation first, tests last. Violates CLAUDE.md §3.2
    (Red → Green → Refactor) and §3.6 ("Failing test added first commit
    visible in history").
  correct: For any new behavior, the FIRST commit on the branch must be a
    failing test that captures the increment. The implementation commit comes
    next. Use `/sprint` to enforce this order via the testwriter → implementer
    → auditor agent loop.
  source: Scripts tree/folder feature, conversation 2026-05-22.

- id: redesign-scope-overreach
  added: 2026-05-22
  trigger: User says "apply this design" or shares a design screenshot.
  mistake: Restructured navigation, added pages, or rearranged layout to mirror
    the reference. Out of scope.
  correct: "Apply this design" = update colors / radii / shadows / spacing
    only. Do not add pages, do not change navigation hierarchy, do not move
    sections around. If the reference implies structural change, ask first.
  source: Pre-existing memory `feedback_redesign_scope.md`, promoted to ledger
    so it now blocks via auditor / sweeper checks.
