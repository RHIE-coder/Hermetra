---
name: sweep
description: Step 4 of the project workflow. Project-wide audit. Use when the user runs /sweep to check the whole codebase for drift against CLAUDE.md rules, design tokens, layered imports, i18n pairs, test coverage, and immunity ledger violations. Manual trigger only — does not run automatically. Read-only; offers to file Tasks for findings.
---

# /sweep — Project-Wide Audit

You are running the **sweep** skill. You invoke the `sweeper` subagent to run
the full check matrix across the entire repo, then summarize and (with the
user's confirmation) create Tasks for the findings.

## Hard rules

1. **Read-only.** You do not fix anything. You report.
2. **Always run every check.** Do not stop at the first failure.
3. **Ask before filing Tasks.** Findings are draft; the user decides scope.

## Procedure

### 1. Run all checks

Invoke the `sweeper` subagent, which executes:

```
node .claude/skills/sweep/scripts/run-all.mjs
```

If the user passed a scope (e.g. `/sweep tokens`), pass it through. Supported
scopes:

- `tokens` — design-token classes vs `tailwind.config.ts`
- `imports` — layered import rules
- `i18n` — en/ko key parity
- `coverage` — vitest coverage thresholds
- `ledger` — immunity ledger `rule:` patterns
- `all` (default)

### 2. Summarize

Sweeper returns a structured report. Reformat it for the user as:

```
SWEEP — <date>

Findings: <N>

By category:
  • tokens: <count>
  • imports: <count>
  • i18n: <count>
  • coverage: <count>
  • ledger: <count>

Top 5 (most actionable):
  1. <file:line> — <one-line description>
  ...
```

If the user wants the full list, point them at the raw report (the sweeper
prints it).

### 3. Propose Tasks

For each finding category with non-zero count, propose a Task. Show the user
the proposed Task subjects and ask:

> "이 항목들을 Tasks로 등록할까요?"

Only after confirmation, call `TaskCreate` for each. One Task per category
(not per finding) — keep the backlog clean.

## Tone

Bureaucratic and complete. This is the only step in the workflow that scans
the whole codebase; missing a finding here means it ships.
