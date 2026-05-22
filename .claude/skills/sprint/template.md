# Sprint commit message templates

Use these for the three commits emitted during a sprint. Replace `<slug>` and
the bracketed parts. Keep the subject under 70 chars; details go in the body.

---

## Red commit (testwriter output)

```
test(<area>): add failing tests for <slug>

Captures acceptance criteria from .specs/active/<slug>.md.
Tests fail by design — implementer turns them green next.

Layers covered:
- <layer 1>: <test file>
- <layer 2>: <test file>

Spec: .specs/active/<slug>.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

---

## Green commit (implementer output)

```
feat(<area>): <one-line spec summary>

Minimum implementation to turn the Red tests green. No scope beyond
what the tests require. Follows patterns in CLAUDE.md §2.

Files:
- <file>
- <file>

Spec: .specs/active/<slug>.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

---

## Refactor commit (only if work actually moved)

```
refactor(<area>): <what improved>

Behavior unchanged; tests still green.

Spec: .specs/done/<slug>.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

---

## When the user later squashes

If the user squash-merges, the squashed message should reference the spec
(`Spec: .specs/done/<slug>.md`) so the history still points back. The spec
itself is the long-form context.
