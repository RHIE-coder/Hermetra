# Immunity Ledger

Append-only record of mistakes the team has paid for. Every steward phase reads
this file before writing code and **must not violate any entry**. New entries
are added via `/steward:immunize`.

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
    Bare `sidebar` left the deny-list on 2026-07-29: the teal/compact design
    system registers `--sidebar` in `global.css` and `sidebar` in
    `tailwind.config.ts`, so it is a real token now. Its shadcn sub-tokens
    (`sidebar-foreground`, `sidebar-accent`, ...) are still fabrications.
  rule: \b(?:bg|text|border|ring|from|via|to|decoration|outline|divide|placeholder|caret|fill|stroke|shadow)-(?:popover|input-foreground|popover-foreground|sidebar-foreground|sidebar-accent|sidebar-border|sidebar-ring|chart-[1-9])\b
  source: CodeEditor.tsx dropdown menu rendered transparent; user incident 2026-05-22.

- id: tdd-implementation-first
  added: 2026-05-22
  trigger: Adding new behavior (feature, bugfix, refactor with new tests).
  mistake: Wrote implementation first, tests last. Violates CLAUDE.md §3.2
    (Red → Green → Refactor) and §3.6 ("Failing test added first commit
    visible in history").
  correct: For any new behavior, the FIRST commit must be a failing test that
    captures the increment. The implementation commit comes next. CLAUDE.md
    §3.2 routes this per layer: pure logic / IPC contract / schema are
    test-first without exception; UI and e2e may follow the implementation but
    land in the same change.
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
    so it now blocks via the review phase and `npm run sweep`.

- id: esm-dirname-assumption
  added: 2026-05-22
  trigger: Writing Node scripts (.mjs / .ts / .js) anywhere in this project,
    especially helpers that get loaded by tooling outside the main app build
    (Playwright globalSetup, tests/e2e/fixtures, `.claude/**/*.mjs`,
    `.harness/steward/**/*.mjs`).
  mistake: Used `__dirname` or `__filename` directly. The project has
    `"type": "module"` in package.json so every file is ESM and those globals
    do not exist. Throws `ReferenceError: __dirname is not defined` at runtime,
    often stopping the whole test/CI run before any test reports.
  correct: At the top of every ESM module that needs the current directory,
    derive the equivalent:
        import { fileURLToPath } from 'node:url';
        import path from 'node:path';
        const HERE = path.dirname(fileURLToPath(import.meta.url));
    Then use HERE in place of __dirname. (Re-declaring `const __dirname = ...`
    also works — see src/main/index.ts.) No `rule:` regex because correct usage
    (`const __dirname = path.dirname(fileURLToPath(import.meta.url))`) and
    incorrect usage share the same token and only differ at file scope —
    line-by-line regex cannot tell them apart without false positives.
  source: legacy `/sprint` run "electron-e2e-smoke", 2026-05-22; first Green attempt failed
    at tests/e2e/setup/global-setup.ts:11 with ReferenceError. Fix applied
    to global-setup.ts and tests/e2e/fixtures/electron.ts.
