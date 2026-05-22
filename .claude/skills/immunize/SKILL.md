---
name: immunize
description: Step 3 of the project workflow. Captures a mistake from the current or prior conversation as a new entry in .claude/immunity/ledger.md so future sprint agents do not repeat it. Use when the user has just corrected a behavior, or when an audit / sweep finds a repeating pattern worth blocking.
---

# /immunize — Capture a Lesson

You are running the **immunize** skill. Your single job is to turn a specific
mistake into a structured ledger entry that future agents (testwriter,
implementer, auditor, sweeper) will read and obey.

## Hard rules

1. **One incident, one entry.** Don't combine unrelated lessons.
2. **Concrete, not motherhood.** "Be careful with X" is useless. "Pattern Y in
   context Z silently fails because W; do A instead" is useful.
3. **Add a `rule:` regex when possible.** A regex is what lets the
   PreToolUse hook block the mistake at write time. If the lesson is purely
   judgement, omit `rule:` — agents still read the entry, but enforcement is
   manual.
4. **Don't dilute by adding everything.** A ledger with 200 vague entries is
   worse than one with 20 sharp ones. If a lesson is already covered by an
   existing entry, *update* that entry instead of adding a new one.

## Procedure

1. **Identify the incident.** Read recent conversation. The user's correction
   (e.g. "왜자꾸…", "또…", "안 지켜") is usually the trigger. Confirm with the
   user in one sentence: "기록할 내용: <one-line summary>. 맞나요?"
2. **Open the ledger.** Read `.claude/immunity/ledger.md` to see existing
   entries. If the new lesson refines an existing entry, prefer updating.
3. **Draft the entry** using the schema in
   `.claude/skills/immunize/template.md`. Pay attention to:
   - `id`: short, kebab-case, unique
   - `trigger`: when the mistake tends to happen
   - `mistake`: what went wrong, concretely
   - `correct`: what to do instead
   - `rule`: regex pattern (only if mechanically detectable)
   - `source`: pointer to the incident (PR, conversation date, file:line)
4. **Show the draft to the user** and ask for confirmation before writing.
5. **Append** to `.claude/immunity/ledger.md`. Do not rewrite the file beyond
   adding the new entry.
6. **Validate** by running:
   `node .claude/skills/immunize/scripts/lint-ledger.mjs`
   Fix any reported issue before reporting done.

## Output contract

Reply with:
- The new entry's `id`
- Where it lives in the ledger (line number)
- Whether the `rule:` will be enforced by the hook (always yes if `rule:` is
  set; otherwise no — agent-read enforcement only)

## Anti-patterns

- Adding an entry "just in case" without a concrete incident.
- A `rule:` regex so broad it catches legitimate code (false positives kill
  the harness's credibility). Test the regex against the codebase first.
- Soft language: "try to…", "consider…". Use imperative: "use…", "do not…".
