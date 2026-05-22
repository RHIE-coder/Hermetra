---
name: setup
description: Bootstrap or repair the harness on this project. Runs preflight, interviews the user about anything missing, fills the gaps (creates missing dirs, seeds ledger, writes harness.config.json), then re-verifies. Use when a project is brand-new to the harness or after pulling a teammate's branch left things in an incomplete state.
---

# /setup — Harness Readiness

You are running the **setup** skill. Your job is to make the project ready
for `/intake`, `/sprint`, `/immunize`, `/sweep`. You either confirm everything
is in place, or interview the user, write the missing pieces, and confirm.

## Hard rules

1. **Preflight first, always.** Token-cheap: one shell call returns the full
   list of missing items as JSON. Read it before asking the user anything.
2. **Don't ask what you can derive.** Some missing items have safe defaults
   (empty dirs, ledger schema header). Just seed them. Save questions for
   genuinely ambiguous decisions.
3. **Don't write `CLAUDE.md` for the user.** It's the project's source of
   truth for patterns. If it's missing, refuse to proceed and ask the user
   to write at least a stub. Offer to draft based on what you observe in the
   repo, but require user approval.
4. **Idempotent.** Running `/setup` twice in a row should be a no-op the
   second time.

## Procedure

### 1. Preflight

```
node .claude/scripts/preflight.mjs --json
```

Parse the JSON. If `ready: true`, report it and stop. Suggest `/intake` next.

If `ready: false`, proceed.

### 2. Auto-fill (no questions needed)

For each `hard` finding whose `kind` and `path` is in the auto-fillable
list below, create it silently. Then re-run preflight to update the list.

Auto-fillable items:

| `kind` / `path` | Action |
|---|---|
| `missing-path: .specs/active` | `mkdir -p .specs/active` |
| `missing-path: .specs/done` | `mkdir -p .specs/done` |
| `missing-path: .claude/immunity` | `mkdir -p .claude/immunity` |
| `missing-path: .claude/immunity/ledger.md` | Write the schema-only ledger stub (see below) |
| Other `missing-path` under `.claude/...` (directories) | `mkdir -p` |

**Ledger stub** (when seeding `.claude/immunity/ledger.md`):

```
# Immunity Ledger

(see schema in .claude/skills/immunize/template.md)

## Entries

(no entries yet — add via /immunize after the first incident)
```

### 3. Interview for the rest

For each remaining hard finding, ask **one focused question**:

| `kind` / `key` | Question |
|---|---|
| `missing-path: CLAUDE.md` | "CLAUDE.md is missing — this is the project's rules file and the harness can't proceed without it. Want me to draft a minimal version based on what I can see in the repo, for you to review?" Wait for approval. If yes, propose a draft; await edits. |
| `config: commands.test` | "What command runs your tests? (e.g. `npm run test`, `pytest`, `cargo test`)" |
| `config: commands.typecheck` | Optional. "Typecheck command? (or skip)" |
| `config: commands.build` | Optional. "Build command? (or skip)" |
| `config: checks.design-tokens.*` | "Does this project have a design-system anchor file (Tailwind config, design-tokens.json, CSS custom properties)? If yes, which extractor: `tailwind` / `css-vars` / `style-dictionary` / `none`." Then ask for the configFile path. If no extractor exists for the chosen option, offer to disable the check or create the extractor stub. |
| `config: checks.i18n-pairs.*` | "Multi-locale UI? If yes: extractor (`messages-ts` / `react-intl-json` / `i18next-json` / `none`), file path, locales (≥ 2)." |
| `config: checks.layered-imports.rules` | "Want to enforce import boundaries? Show me which directories shouldn't import which (e.g. `src/renderer/` never imports `src/main/`)." Build the rules array from their answer. Or accept "skip" → disable. |
| `extractor: <path>` | "Extractor `<name>` is referenced but not installed at `<path>`. I can scaffold a stub — you'll need to fill in the extraction logic. Proceed?" |
| `missing-path: <design-system or i18n file>` | "Config references `<path>` but it doesn't exist. Path correct? Or should I disable the check?" |

For **soft** findings (`ARCHITECTURE.md`, `README.md`), just mention them at
the end — do not block on them.

### 4. Write the config

When all answers are collected, write `.claude/harness.config.json` with the
shape below. Disable any check the user declined.

```json
{
  "version": "1.0",
  "project": { "name": "<<derived from package.json or asked>>", "primaryLanguage": "<<asked>>" },
  "commands": { "test": "<<asked>>", "typecheck": "<<asked|null>>", "build": "<<asked|null>>", "coverage": "<<derived if vitest>>" },
  "checks": {
    "ledger-violations": { "enabled": true },
    "design-tokens": { "enabled": <<bool>>, "extractor": "<<name>>", "configFile": "<<path>>", "scanGlobs": ["src/**/*.tsx"] },
    "layered-imports": { "enabled": <<bool>>, "rules": [...] },
    "i18n-pairs":      { "enabled": <<bool>>, "extractor": "<<name>>", "file": "<<path>>", "locales": [...] },
    "coverage":        { "enabled": <<bool>>, "runner": "<<name>>", "summaryFile": "<<path>>" }
  }
}
```

### 5. Re-verify

```
node .claude/scripts/preflight.mjs
```

Must now exit 0. If it doesn't, loop back to step 3 for the residual items.

### 6. Report

Short summary:
- Created: list of files/dirs
- Disabled checks: list (with one-line reason each)
- Soft warnings remaining: list
- Next step: `/intake "<first feature>"`

## Tone

Direct, no filler. You are unblocking the workflow — the user wants this
done in the minimum number of questions.
