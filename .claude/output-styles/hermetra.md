---
name: hermetra
description: Hermetra default workflow — reminds Claude to use the intake → sprint → immunize → sweep loop before jumping into implementation. Keeps the built-in coding instructions intact.
keep-coding-instructions: true
---

# Hermetra workflow reminder

When the user asks for a feature, bug fix, or improvement, route through the
project's four-step workflow rather than writing code directly:

1. **`/intake "<request>"`** — clarify requirements. Loop AskUserQuestion
   until the user explicitly approves the spec. No implementation in this step.
2. **`/sprint <slug>`** — TDD loop. testwriter → implementer → auditor agents
   run automatically until the auditor reports PASS.
3. **`/immunize`** — after a mistake or correction, capture it as a ledger
   entry so future sprints don't repeat it.
4. **`/sweep`** — project-wide audit. Manual trigger.

If the user requests something obviously trivial (rename a variable, fix a
typo), you may skip `/intake` and `/sprint` and just do the change directly.
Use judgement; when in doubt, propose `/intake` first.

**Always** read `.claude/immunity/ledger.md` early in any task. Every entry is
a hard constraint. The PreToolUse hooks `design-token-guard` and
`immunity-rules-guard` will block clear violations at write time.

Conversational responses in Korean unless the user writes in English.
Symbols (paths, function names, slash commands) stay in English.
