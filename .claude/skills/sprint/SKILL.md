---
name: sprint
description: Step 2 of the project workflow. Auto TDD loop. Use after /intake has produced a spec under .specs/active/<slug>.md. Orchestrates testwriter → implementer → auditor agents until the auditor reports PASS, then moves the spec to .specs/done/ and reports.
---

# /sprint — TDD Auto Loop

You are running the **sprint** skill. Given a spec slug, you drive the
Red-Green-Audit loop using three subagents until the auditor signs off.

## Hard rules

1. **You do not write code yourself.** You orchestrate `testwriter`,
   `implementer`, and `auditor` subagents.
2. **Strict order.** Testwriter ALWAYS runs first. Implementer never runs
   before failing tests exist. Auditor never runs before tests are green.
3. **Loop until clean.** If auditor returns FAIL, route the fixes back to the
   right agent (test gap → testwriter; implementation issue → implementer)
   and re-audit. No "good enough".
4. **Ledger first.** Every subagent invocation must include
   `.claude/immunity/ledger.md` as required reading. The agent files already
   state this; you do not need to repeat it in the prompt.

## Procedure

### 0. Pre-flight

1. Resolve the spec: `.specs/active/<slug>.md`. Fail loudly if missing.
2. Read the spec yourself end-to-end so you can interpret agent reports.
3. Read `.claude/immunity/ledger.md` so you can catch agents drifting into a
   known mistake.

### 1. Red — invoke testwriter

Invoke the `testwriter` agent with:
- The spec path
- A reminder of which acceptance criteria are in scope (all, unless you have
  a reason to split)

When it returns, verify:
- New test files exist
- `npm run test` shows failures matching what testwriter claimed (the agent
  ran this, but you double-check the count)

If testwriter flagged spec ambiguity, **stop the sprint** and report back to
the user: "Spec is incomplete on X — re-run /intake to clarify."

**Commit (Red):**
- Stage only the new test files
- Commit message template: see `.claude/skills/sprint/template.md`

### 2. Green — invoke implementer

Invoke the `implementer` agent with:
- The spec path
- The list of test files testwriter created
- A pointer to the ledger

When it returns, verify by running BOTH yourself (do not trust the agent's
captured output — re-execute):

- `npm run test` (full suite, no filter) is green
- `npm run typecheck` is green

**Why re-run**: this is the side-effect gate. A regression in code far from
this sprint's diff must surface here, not at audit time.

If green is not achieved after one implementer turn, you may call implementer
once more with the failure output. If still not green, escalate: report to the
user with the failure and stop. Do NOT silently keep retrying.

**Commit (Green):**
- Stage production code (and any minimal test fixups implementer requested
  testwriter to make — but normally there should be none)
- Commit message template: see template.md

### 3. Audit — invoke auditor

Invoke the `auditor` agent. It runs `npm run check` (typecheck + test + build)
plus every sweep script and returns a PASS / FAIL report. The full test suite
runs here **for the third time** in the loop (testwriter saw it Red,
implementer+sprint saw it Green, auditor confirms Green under the same
working tree the PR will ship). That triple-pass is the side-effect gate.

- **PASS** → proceed to step 4.
- **FAIL** → for each finding, decide who fixes it:
  - missing test / wrong test shape → testwriter
  - implementation issue / token / import / i18n → implementer
  Re-invoke the chosen agent with the auditor's findings. After they finish,
  re-run auditor. Loop. Cap: 3 audit rounds. If still failing, escalate to
  the user with the residual findings.

### 4. Refactor (optional, in-loop)

If implementer requested refactoring, do it now. Otherwise skip.

**Commit (Refactor):**
- Only when something actually moved.

### 5. Close out

1. Move `.specs/active/<slug>.md` → `.specs/done/<slug>.md`. Update the
   `Status:` line to `done` and append a `Completed:` date.
2. Close every Task associated with this slug (TaskUpdate → completed).
3. Reply with a short summary:
   - files changed (counts)
   - tests added (count)
   - audit pass on round N
   - commit refs

## Failure modes (recognize and stop early)

- Testwriter flags spec ambiguity → stop, route to /intake.
- Implementer cannot reach green in 2 turns → stop, escalate.
- Auditor still FAIL after 3 rounds → stop, escalate.
- Ledger violation introduced (hook should catch this anyway) → stop, this is
  a regression, file `/immunize` if a new pattern.

## Tone

Concise status updates between phases ("Red: 5 tests, all fail. Invoking
implementer."). Final summary in 2–3 sentences. No filler.
