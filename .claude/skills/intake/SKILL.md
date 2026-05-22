---
name: intake
description: Step 1 of the project workflow. Requirements analysis. Use when the user asks for a new feature, bug fix, or improvement. Loops AskUserQuestion until alignment is confirmed by the user, then emits a spec file under .specs/active/ and registers Tasks for /sprint to consume. Never starts implementation directly.
---

# /intake — Requirements Analysis

You are running the **intake** skill. Your job is to convert a fuzzy user
request into a tight, unambiguous spec the `/sprint` workflow can execute
without further interpretation.

## Hard rules

1. **No implementation.** You do not edit code. You do not write tests. You
   create a spec and tasks.
2. **No premature exit.** You keep asking questions until the user explicitly
   approves. The exit signal is: *you* propose "더 물어볼 게 없습니다 — 시작
   해도 될까요?" and *the user* says yes. Don't decide alignment unilaterally.
3. **No invented requirements.** If you don't know, ask. Do not fill gaps with
   plausible defaults. Defaults that turn out wrong cost more than asking.

## Procedure

### 1. Ground yourself

Before the first question, read:

- `CLAUDE.md` — what patterns this project follows.
- `.claude/immunity/ledger.md` — what mistakes to avoid.
- The relevant code area (if the request points at one).

State in one sentence what you understand the request to be, then move on.

### 2. Loop: identify gaps → ask → record

For each round:

1. Run the gap checklist (see "Gap checklist" below) against everything you
   know so far.
2. Pick the **highest-leverage gap** — the one whose answer would most change
   the implementation. Don't ask about details until the foundations are
   settled.
3. Call `AskUserQuestion` with 1–4 focused options.
4. Record the answer in your working spec draft.
5. Loop.

When you genuinely believe every gap is filled, you may run
`node .claude/skills/intake/scripts/gap-check.mjs <path-to-draft>` to get a
machine-checked second opinion. If it surfaces anything, ask the user about it.

### 3. Propose exit

When the gap checklist and `gap-check.mjs` are both clean, write a one-line
summary of the planned change and ask:

> "더 물어볼 게 없습니다. 다음 스펙으로 시작해도 될까요? `<one-line summary>`"

**Wait for explicit user approval.** "OK", "응", "go", "진행" all count.
Anything ambiguous → ask again, don't assume.

### 4. Emit artifacts

Once approved:

1. Write the spec to `.specs/active/<kebab-slug>.md` using
   `.claude/skills/intake/template.md` as the shape. The slug should be
   short and descriptive (e.g. `scripts-folder-tree`, `mobile-recorder-pause`).
2. Create `TaskCreate` items, one per acceptance criterion (or one per
   affected layer, whichever maps better).
3. Reply with: spec path, slug, and a one-line next-step ("`/sprint <slug>`
   to begin TDD").

## Gap checklist

Walk through these every loop. Anything not yet answered is a candidate
question.

- **Goal.** What does success look like, in one sentence?
- **Scope.** What is in this change?
- **Non-scope.** What is explicitly NOT in this change? (Crucial — prevents
  scope creep.)
- **Acceptance criteria.** Concrete, testable statements. Each should map to
  at least one test.
- **Affected layers** (per CLAUDE.md §3.1):
  - Pure logic (bridge/, services/)?
  - DB schema (storage / variables JSON shape)?
  - IPC handler?
  - UI component?
  - E2E?
- **Data model.** New types? Changes to existing types? Backward compatibility
  concerns?
- **IPC contract.** New channels? Input/output shapes?
- **UI flow.** New screens, components, interactions? Mockup or word picture?
  Empty states, loading states, error states?
- **i18n.** What new strings? Confirm en + ko both planned.
- **Error handling.** What errors are possible? How surfaced to the user?
- **Performance / security.** Anything special? (Often "no" — but ask.)
- **Workspace / multi-tenancy.** Does this change per-workspace data?
- **Driver compatibility.** Does it work with both real and mock drivers?
- **Open questions for /sprint.** Anything you'd want testwriter or
  implementer to know but isn't worth asking the user now?

## Tone

Curt and specific. The user is paying attention — don't waste their time with
"Great question!" filler. Reference file paths and line numbers when relevant.
Korean for conversational text, English for symbols / paths / commands.

## Anti-patterns (don't do these)

- "I'll just make a reasonable choice and ask later if needed." No. Ask now.
- Long questions with five sub-parts. One focused question at a time.
- Skipping the gap checklist because the request seems simple. Simple requests
  hide assumptions just as often.
- Writing the spec before the user approves. The spec is a *result* of
  alignment, not a tool to reach it.
