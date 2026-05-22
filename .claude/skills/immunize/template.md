# Ledger entry template

Append entries to `.claude/immunity/ledger.md` under the `## Entries` section,
preserving the exact YAML-block-inside-markdown shape.

```yaml
- id: <kebab-slug>           # required, unique
  added: <YYYY-MM-DD>        # required
  trigger: |                 # required — when this mistake tends to happen
    <natural-language description>
  mistake: |                 # required — what went wrong, concretely
    <natural-language description with file:line if applicable>
  correct: |                 # required — what to do instead, imperative
    <natural-language description>
  rule: <regex>              # optional — if set, hook BLOCKS matching writes
  source: <pointer>          # required — PR, conversation date, incident slug
```

## Choosing the `rule:` regex

The regex is evaluated against the **content of a Write or Edit** tool call.
It should match the *bad pattern itself*, not the absence of something.

- ✅ `\bbg-popover\b` — bad: using a class that doesn't exist in tokens
- ✅ `from\s+['"]@main/` (inside a renderer file context) — bad: layered
  import violation (handled by check-layered-imports.mjs; rule duplicates is
  fine)
- ❌ `^(?!.*await).*\.click\(\)` — looking for absence is fragile; instead
  write a positive rule against the bad shape, or rely on tests

Before committing the rule:
1. Search the repo for matches: `grep -rE '<your-rule>' src/`
2. If matches exist that are NOT the mistake, narrow the regex.
3. If the rule would have caught the original incident, you have a good rule.

## Updating an existing entry

If a new incident is a refinement of an existing entry:

- Append a one-line `# 2026-MM-DD note: …` inside the entry rather than
  duplicating.
- Extend the `rule:` regex if a new pattern of the same class emerged.
- Bump `added:` only if the lesson materially changed.
