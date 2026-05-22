#!/usr/bin/env node
/**
 * bundle-setup.mjs — Generate a self-contained HARNESS_SETUP.md by stitching
 * the existing universal-core source files into the scaffolder doc.
 *
 * Output: HARNESS_SETUP.md (overwritten) at repo root.
 *
 * The doc is structured so that an AI agent reading it in a fresh project
 * can recreate every harness file verbatim, then run /setup to wire up the
 * project-specific bits.
 *
 * Re-run this script whenever a universal file changes.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();

// Files to inline. Order matters for the generated doc.
const SECTIONS = [
  {
    title: 'Part C1 — Config loader (universal)',
    files: [
      { src: '.claude/lib/config.mjs', dst: '.claude/lib/config.mjs', lang: 'javascript' },
    ],
  },
  {
    title: 'Part C2 — Preflight (universal)',
    files: [
      { src: '.claude/scripts/preflight.mjs', dst: '.claude/scripts/preflight.mjs', lang: 'javascript' },
    ],
  },
  {
    title: 'Part C3 — Agents (universal)',
    files: [
      { src: '.claude/agents/testwriter.md', dst: '.claude/agents/testwriter.md', lang: 'markdown' },
      { src: '.claude/agents/implementer.md', dst: '.claude/agents/implementer.md', lang: 'markdown' },
      { src: '.claude/agents/auditor.md', dst: '.claude/agents/auditor.md', lang: 'markdown' },
      { src: '.claude/agents/sweeper.md', dst: '.claude/agents/sweeper.md', lang: 'markdown' },
    ],
  },
  {
    title: 'Part C4 — /setup skill (universal)',
    files: [
      { src: '.claude/skills/setup/SKILL.md', dst: '.claude/skills/setup/SKILL.md', lang: 'markdown' },
    ],
  },
  {
    title: 'Part C5 — /intake skill (universal)',
    files: [
      { src: '.claude/skills/intake/SKILL.md', dst: '.claude/skills/intake/SKILL.md', lang: 'markdown' },
      { src: '.claude/skills/intake/template.md', dst: '.claude/skills/intake/template.md', lang: 'markdown' },
      { src: '.claude/skills/intake/scripts/gap-check.mjs', dst: '.claude/skills/intake/scripts/gap-check.mjs', lang: 'javascript' },
    ],
  },
  {
    title: 'Part C6 — /sprint skill (universal)',
    files: [
      { src: '.claude/skills/sprint/SKILL.md', dst: '.claude/skills/sprint/SKILL.md', lang: 'markdown' },
      { src: '.claude/skills/sprint/template.md', dst: '.claude/skills/sprint/template.md', lang: 'markdown' },
      { src: '.claude/skills/sprint/scripts/check.mjs', dst: '.claude/skills/sprint/scripts/check.mjs', lang: 'javascript' },
    ],
  },
  {
    title: 'Part C7 — /immunize skill (universal)',
    files: [
      { src: '.claude/skills/immunize/SKILL.md', dst: '.claude/skills/immunize/SKILL.md', lang: 'markdown' },
      { src: '.claude/skills/immunize/template.md', dst: '.claude/skills/immunize/template.md', lang: 'markdown' },
      { src: '.claude/skills/immunize/scripts/lint-ledger.mjs', dst: '.claude/skills/immunize/scripts/lint-ledger.mjs', lang: 'javascript' },
    ],
  },
  {
    title: 'Part C8 — /sweep skill + drivers (universal)',
    files: [
      { src: '.claude/skills/sweep/SKILL.md', dst: '.claude/skills/sweep/SKILL.md', lang: 'markdown' },
      { src: '.claude/skills/sweep/scripts/run-all.mjs', dst: '.claude/skills/sweep/scripts/run-all.mjs', lang: 'javascript' },
      { src: '.claude/skills/sweep/scripts/check-design-tokens.mjs', dst: '.claude/skills/sweep/scripts/check-design-tokens.mjs', lang: 'javascript' },
      { src: '.claude/skills/sweep/scripts/check-layered-imports.mjs', dst: '.claude/skills/sweep/scripts/check-layered-imports.mjs', lang: 'javascript' },
      { src: '.claude/skills/sweep/scripts/check-i18n-pairs.mjs', dst: '.claude/skills/sweep/scripts/check-i18n-pairs.mjs', lang: 'javascript' },
      { src: '.claude/skills/sweep/scripts/check-coverage.mjs', dst: '.claude/skills/sweep/scripts/check-coverage.mjs', lang: 'javascript' },
      { src: '.claude/skills/sweep/scripts/check-ledger-violations.mjs', dst: '.claude/skills/sweep/scripts/check-ledger-violations.mjs', lang: 'javascript' },
    ],
  },
  {
    title: 'Part C9 — PreToolUse hooks (universal)',
    files: [
      { src: '.claude/hooks/design-token-guard.mjs', dst: '.claude/hooks/design-token-guard.mjs', lang: 'javascript' },
      { src: '.claude/hooks/immunity-rules-guard.mjs', dst: '.claude/hooks/immunity-rules-guard.mjs', lang: 'javascript' },
    ],
  },
  {
    title: 'Part C10 — Settings + output style (universal/project)',
    files: [
      { src: '.claude/settings.json', dst: '.claude/settings.json', lang: 'json' },
      { src: '.claude/output-styles/hermetra.md', dst: '.claude/output-styles/<<PROJECT_NAME>>.md', lang: 'markdown', rename: true },
    ],
  },
  {
    title: 'Part D1 — Tokens extractor: tailwind (reference plugin)',
    files: [
      { src: '.claude/extractors/tokens/tailwind.mjs', dst: '.claude/extractors/tokens/tailwind.mjs', lang: 'javascript' },
    ],
  },
  {
    title: 'Part D2 — i18n extractor: messages-ts (reference plugin)',
    files: [
      { src: '.claude/extractors/i18n/messages-ts.mjs', dst: '.claude/extractors/i18n/messages-ts.mjs', lang: 'javascript' },
    ],
  },
];

const HEAD = `# Portable Harness Setup Prompt (Self-Contained)

> **AI: How to use this file.** When a user hands this to you in a fresh
> project, do the following in order:
>
> 1. Read **Part A** and run the interview.
> 2. After the user approves the answers, **scaffold the directories** from
>    Part B.
> 3. **Create every file in Parts C and D verbatim** from the source blocks
>    below. The file path for each block is the heading immediately above it
>    (e.g. \`### \\\`.claude/lib/config.mjs\\\`\`).
> 4. **Write \`.claude/harness.config.json\`** (Part E) using the interview
>    answers.
> 5. **Run verification** (Part F). If preflight passes, hand off to the user
>    with a suggestion to run \`/intake\`.
>
> This file is generated by \`.claude/scripts/bundle-setup.mjs\` in the
> reference project. Re-bundle whenever the universal core changes.

---

## What this gives you

A four-step workflow:

1. **\`/setup\`** — Bootstrap or repair. Auto-fills what it can; interviews
   for what it can't; verifies via preflight. Run this first on a new project.
2. **\`/intake "<request>"\`** — Exhaustive requirements analysis. Loops
   \`AskUserQuestion\` until the user explicitly approves a spec.
3. **\`/sprint <slug>\`** — Auto TDD loop. \`testwriter\` → \`implementer\` →
   \`auditor\` agents run in order. Full test suite runs **3 times** in one
   sprint (Red verify, Green verify, Audit). Side-effect-safe.
4. **\`/immunize\`** — Captures a mistake as a ledger entry. Future sprints
   read the ledger first. Optional \`rule:\` regex auto-enforces via hook.
5. **\`/sweep\`** — Project-wide audit. Manual trigger.

Two PreToolUse hooks (\`design-token-guard\`, \`immunity-rules-guard\`) back
the ledger up at the tool-call level — clear violations are blocked before
they hit disk.

---

## Architecture

\`\`\`
┌─────────────────────────────────────────────────────────┐
│  UNIVERSAL CORE (copy verbatim, never edit per project)  │
│  Agents · Skills · Scripts · Hooks · Lib · Ledger schema │
└─────────────────────────────────────────────────────────┘
                          ↑ reads at runtime
                          │
┌─────────────────────────────────────────────────────────┐
│  PROJECT CONFIG (one file)                              │
│  .claude/harness.config.json                            │
│  commands · checks.<name>.enabled · extractors          │
└─────────────────────────────────────────────────────────┘
                          ↑ names plugins
                          │
┌─────────────────────────────────────────────────────────┐
│  PLUGINS (extractors — only the ones you need)          │
│  .claude/extractors/tokens/<name>.mjs                   │
│  .claude/extractors/i18n/<name>.mjs                     │
└─────────────────────────────────────────────────────────┘
\`\`\`

The Universal Core never changes between projects. The Config is one JSON
file with all your project-specific knobs. Plugins are tiny (~40 lines) when
you have non-standard design systems or i18n formats.

---

## Part A — Interview the user (mandatory)

Before scaffolding, ask the following with \`AskUserQuestion\`. Use the
answers to assemble \`harness.config.json\` in Part E.

1. **Project name + primary language.**
2. **Test command** (e.g. \`npm run test\`, \`pytest\`, \`cargo test\`).
3. **Typecheck command** (optional).
4. **Build command** (optional).
5. **Coverage command** (optional).
6. **Design system**: Tailwind / CSS custom properties / Style Dictionary /
   design-tokens.json / **none**. If "none", \`design-tokens\` check stays
   disabled. Otherwise: which file declares the tokens?
7. **i18n**: messages.ts / react-intl JSON / i18next JSON / other / **none**.
   If not "none": file path + locales list (≥ 2).
8. **Layered import rules**: any "module A never imports module B" rules?
   List them. Otherwise stay disabled.
9. **Initial ledger seeds**: 1–3 known mistakes worth capturing (past
   incidents, repeated style violations). Otherwise leave ledger empty.
10. **Hook policy**: \`block\` (exit 2) or \`warn\` (exit 0 with stderr)?
    Recommend \`block\` once team is comfortable.

**Wait for user approval of the answers before writing any file.**

---

## Part B — Scaffold directories

\`\`\`bash
mkdir -p .specs/active .specs/done \\
  .claude/agents \\
  .claude/skills/setup \\
  .claude/skills/intake/scripts .claude/skills/intake/examples \\
  .claude/skills/sprint/scripts \\
  .claude/skills/immunize/scripts \\
  .claude/skills/sweep/scripts \\
  .claude/scripts \\
  .claude/lib \\
  .claude/immunity \\
  .claude/hooks \\
  .claude/extractors/tokens \\
  .claude/extractors/i18n \\
  .claude/output-styles
\`\`\`

---

## Part C — Universal core source (write each verbatim)

> For each subsection below, the heading shows the destination path. Copy
> the fenced block to that exact path. **Do not modify** — these files are
> byte-identical across all harness installs.

`;

const TAIL = `
---

## Part E — Write \`.claude/harness.config.json\`

Assemble from interview answers:

\`\`\`json
{
  "version": "1.0",
  "project": {
    "name": "<<asked>>",
    "primaryLanguage": "<<asked>>"
  },
  "commands": {
    "test": "<<asked>>",
    "typecheck": "<<asked or null>>",
    "build": "<<asked or null>>",
    "coverage": "<<asked or null>>"
  },
  "checks": {
    "ledger-violations": { "enabled": true },
    "design-tokens": {
      "enabled": <<bool>>,
      "extractor": "<<name, e.g. tailwind>>",
      "configFile": "<<path>>",
      "scanGlobs": ["src/**/*.tsx"]
    },
    "layered-imports": {
      "enabled": <<bool>>,
      "rules": [
        {
          "scope": "<<regex>>",
          "forbid": [
            { "pattern": "<<regex>>", "msg": "<<human-readable>>" }
          ]
        }
      ]
    },
    "i18n-pairs": {
      "enabled": <<bool>>,
      "extractor": "<<name>>",
      "file": "<<path>>",
      "locales": ["<<l1>>", "<<l2>>"]
    },
    "coverage": {
      "enabled": <<bool>>,
      "runner": "<<vitest|jest|...>>",
      "summaryFile": "coverage/coverage-summary.json"
    }
  },
  "intake": {
    "optionalSections": []
  }
}
\`\`\`

Set \`enabled: false\` for any check the project doesn't use.

Also seed \`.claude/immunity/ledger.md\`:

\`\`\`markdown
# Immunity Ledger

(see schema in .claude/skills/immunize/template.md)

## Entries

(no entries yet — add via /immunize after the first incident)
\`\`\`

---

## Part F — Verify

Run in order. Stop and fix if any fails:

1. \`node .claude/scripts/preflight.mjs\` — must exit 0.
2. \`node .claude/skills/immunize/scripts/lint-ledger.mjs\` — must exit 0.
3. \`node .claude/skills/sweep/scripts/run-all.mjs --skip coverage\` —
   all enabled checks must \`PASS\`.
4. Hook smoke test (only if design-tokens enabled):
   pipe a bad-token write through \`.claude/hooks/design-token-guard.mjs\`;
   it should exit 2.

---

## Part G — Append to \`CLAUDE.md\`

Append (adapting \`<<N>>\` to the next section number):

\`\`\`markdown
## <<N>>. Workflow (four+1 steps, in order)

Every non-trivial change goes through this loop. Trivial = rename, typo, comment.

0. \`/setup\` — bootstrap or repair (idempotent).
1. \`/intake "<request>"\` — Requirements analysis.
2. \`/sprint <slug>\` — Auto TDD loop.
3. \`/immunize\` — Capture mistakes in .claude/immunity/ledger.md.
4. \`/sweep\` — Project-wide audit (manual trigger).

### Active immunity rules

Every agent reads .claude/immunity/ledger.md first. Two PreToolUse hooks
back this up:

- design-token-guard — Blocks Writes referencing unregistered tokens.
- immunity-rules-guard — Blocks Writes matching any ledger rule regex.

If a hook blocks you, fix the underlying issue; do not bypass.
\`\`\`

---

## Part H — package.json scripts (Node projects)

\`\`\`json
{
  "scripts": {
    "sweep": "node .claude/skills/sweep/scripts/run-all.mjs",
    "sweep:tokens": "node .claude/skills/sweep/scripts/check-design-tokens.mjs",
    "sweep:imports": "node .claude/skills/sweep/scripts/check-layered-imports.mjs",
    "sweep:i18n": "node .claude/skills/sweep/scripts/check-i18n-pairs.mjs",
    "sweep:coverage": "node .claude/skills/sweep/scripts/check-coverage.mjs",
    "sweep:ledger": "node .claude/skills/sweep/scripts/check-ledger-violations.mjs",
    "lint:ledger": "node .claude/skills/immunize/scripts/lint-ledger.mjs",
    "preflight": "node .claude/scripts/preflight.mjs"
  }
}
\`\`\`

For non-Node projects: Node ≥ 18 is required to run the \`.mjs\` scripts.

---

## Operating notes

- **Run \`/setup\` first on any fresh checkout.** It's idempotent.
- **Ledger discipline.** 200 vague entries < 20 sharp entries.
- **Hook noise.** If a hook blocks legitimate code, narrow the regex or
  the extractor — do not disable.
- **Soft rollout.** Hooks run as warn-only by editing \`process.exit(2)\` →
  \`process.exit(0)\` in the hook scripts.

That's the harness. Hand it to Claude, run \`/setup\`, then \`/intake\` your
first feature.

---

## Writing your own extractor

Each ADAPT check is split into a universal driver + a project extractor.
Reference implementations are inlined above (Parts D1, D2).

**Tokens extractor contract** (\`getTokens\`):

\`\`\`javascript
export async function getTokens({ configFile, root }) {
  // returns Promise<Set<string>>
  // flat list of registered token NAMES (no values)
  // nested keys flattened as \`parent-child\`
}
\`\`\`

**i18n extractor contract** (\`getLocaleKeys\`):

\`\`\`javascript
export async function getLocaleKeys({ file, locales, root }) {
  // returns Promise<Map<string locale, Set<string keyName>>>
}
\`\`\`

That's the entire plugin contract — no registry, no class hierarchy. Drop a
file, name it in config, done.
`;

function readSource(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    throw new Error(`bundle-setup: source missing: ${abs}`);
  }
  return fs.readFileSync(abs, 'utf-8');
}

let out = HEAD;

for (const section of SECTIONS) {
  out += `\n### ${section.title}\n\n`;
  for (const file of section.files) {
    const content = readSource(file.src);
    out += `#### \`${file.dst}\`\n\n`;
    if (file.rename) {
      out += `> Rename to match your project. The \`name:\` frontmatter field should match the file basename.\n\n`;
    }
    out += '```' + file.lang + '\n';
    out += content;
    if (!content.endsWith('\n')) out += '\n';
    out += '```\n\n';
  }
}

out += TAIL;

const target = path.join(ROOT, 'HARNESS_SETUP.md');
fs.writeFileSync(target, out, 'utf-8');
process.stdout.write(`bundle-setup: wrote ${target} (${out.length.toLocaleString()} chars, ${out.split('\n').length} lines)\n`);
