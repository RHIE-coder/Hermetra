---
name: quick
description: Fast-path workflow for clearly simple, single-layer changes (small bug fixes, one-file tweaks, regex tightening). Compresses /intake + /sprint into one shot — generates a minimal spec from a one-line description, asks the user for a single confirmation, then hands off to /sprint. Refuses and routes to /intake if the change is multi-layer, touches user-visible strings (i18n), adds a new IPC channel, a new page/route, or a new schema field.
---

# /quick — Fast-Path Workflow

You are running the **quick** skill. Your job is to compress `/intake` +
`/sprint` into a one-shot path for **clearly simple** changes. Anything that is
not clearly simple goes back to `/intake`.

## When to use /quick vs the alternatives

| Situation | Use |
|---|---|
| Rename, typo, dead comment removal | Just `Edit` directly. No workflow. |
| Single-layer bug fix, single-file tweak, regex tightening, small validation | `/quick` |
| Multi-layer change, new user-visible string (i18n), new IPC channel, new page/route, new schema field, new data type | `/intake` |

When uncertain, default to `/intake`. A bad call here is worse than a
one-question overhead.

## Hard rules

1. **One confirmation only.** You call `AskUserQuestion` exactly once — to
   confirm the generated spec. No loop. If the user disapproves, abort and
   suggest `/intake`.
2. **Scope gate first.** Before generating the spec, run the classification
   in step 2 below. If any "route to /intake" trigger fires, stop and route.
3. **No implementation.** You generate the spec, get the one-shot confirmation,
   then invoke `/sprint`. `/sprint` orchestrates the actual TDD loop.
4. **Ledger first.** Read `.claude/immunity/ledger.md` before generating the
   spec so the spec doesn't reintroduce a known mistake.

## Procedure

### 1. Read context

- `CLAUDE.md` — patterns and house rules (especially §3.1 layer table, §6).
- `.claude/immunity/ledger.md` — past mistakes to avoid.
- The file(s) the request points at (skim, don't deep-read).

### 2. Classify the request (the scope gate)

Decide each of the following from the user's one-line request. If you cannot
decide with high confidence, that itself is a signal to route to `/intake`.

- **Affected layer.** Must be exactly **one** of: pure logic
  (`src/main/bridge/**`, `src/main/services/**`) / DB schema
  (`tests/schema/**` shape) / IPC handler (`src/main/ipc/**`) / UI component
  (`src/renderer/**`) / E2E (`tests/e2e/**`).
- **Files involved.** 1–2 max. If more, this is not "quick".
- **New user-visible string?** If yes → route to `/intake`.
- **New IPC channel / new page / new route / new schema field / new exported
  type?** If yes → route to `/intake`.

If any trigger fires, stop and reply:

> "이 요청은 `/quick` 범위 밖입니다. 이유: `<reason>`. `/intake "<one-line>"`
> 로 진행하세요."

### 3. Generate a minimal spec (in-memory draft)

Use `.claude/skills/quick/template.md`. Fill in:

- `Goal` — one sentence.
- `Acceptance criteria` — 1–3 concrete, testable items. Each one must map to
  at least one test that `/sprint`'s testwriter will write.
- `Affected layers` — the single layer + file path(s).
- `Notes for /sprint` — anything testwriter / implementer should know that's
  not obvious from the spec body.

Sections in the template marked `(해당 없음)` stay as-is — they are
intentional placeholders that signal the change is scoped narrowly.

Derive a kebab-slug from the request (max 4–5 words).

### 4. One-shot confirmation

Show the draft spec **inline** (not the file yet — write only after approval).
Then call `AskUserQuestion` exactly once:

> 질문: "다음 spec으로 바로 `/sprint`에 들어갈까요? 요약: `<one-line summary>`"
>
> Options:
> - "예, 진행하세요" — write spec + start sprint.
> - "수정 필요 / 더 논의" — abort, suggest `/intake`.

If the user picks the second option, reply:

> "중단합니다. 더 정확히 정의하려면 `/intake "<original request>"`로 진행하세요."

### 5. Write spec + invoke /sprint

On approval:

1. Write the spec to `.specs/active/<kebab-slug>.md`.
2. Invoke the `/sprint` skill with `<slug>` as the argument. From here on,
   `/sprint`'s normal Red → Green → Audit loop runs — you do not orchestrate
   the agents yourself.

### 6. Report

After `/sprint` returns, summarize in 2–3 sentences:

- spec slug
- audit pass round count
- files changed + tests added (counts)
- commit refs

## Escalation back to /intake mid-sprint

`/sprint` may still bounce back if testwriter flags spec ambiguity (see
`.claude/skills/sprint/SKILL.md` step 1). If that happens, do not retry
`/quick` with the same description — the change was bigger than it looked.
Route the user to `/intake`.

## Anti-patterns (don't do these)

- Forcing `/quick` on a multi-layer change to "save time". Mid-sprint spec
  rewrites cost more than the `/intake` question loop.
- Skipping the layer / strings / IPC classification step. That's the gate.
- Asking more than one confirmation question. If you want to, the change is
  too big for `/quick`.
- Bypassing `/sprint` and editing code directly. `/quick` is a faster way to
  spec, not a free pass to skip TDD.
- Auto-converting a vague request ("좀 더 빠르게 만들어줘") into a quick spec
  without classifying. Vague = route to `/intake`.

## Tone

Curt and decisive. The user picked `/quick` because they want to move fast.
Don't lecture about why `/intake` exists — just route there if the scope
gate trips. Korean for conversational text, English for paths / commands.
