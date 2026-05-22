#!/usr/bin/env node
/**
 * preflight.mjs — Single-call readiness check for the harness.
 *
 * Verifies hard prerequisites are in place. Returns a structured report so
 * agents can read it with one tool call instead of probing files one by one.
 *
 * Exit codes:
 *   0 = ready
 *   1 = not ready (findings listed)
 *   2 = the harness install itself is broken (config malformed, etc.)
 *
 * Flags:
 *   --json    machine-readable output
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { tryLoadConfig } from '../lib/config.mjs';

const ROOT = process.cwd();
const json = process.argv.includes('--json');

const findings = [];

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function need(rel, severity, hint) {
  if (!exists(rel)) findings.push({ kind: 'missing-path', severity, path: rel, hint });
}

// 1. Required project files
need('CLAUDE.md', 'hard', 'Project rules. Cannot be auto-generated — interview the user.');

// 2. Harness internals
const harnessDirs = [
  '.claude/agents',
  '.claude/skills/intake',
  '.claude/skills/sprint',
  '.claude/skills/immunize',
  '.claude/skills/sweep',
  '.claude/skills/sweep/scripts',
  '.claude/hooks',
  '.claude/immunity',
  '.claude/lib',
  '.specs/active',
  '.specs/done',
];
for (const d of harnessDirs) need(d, 'hard', 'Harness directory missing. Re-run install.');

// 3. Required files
need('.claude/immunity/ledger.md', 'hard', 'Can be auto-seeded with the schema header.');
need('.claude/harness.config.json', 'hard', 'Single source of truth for harness knobs.');

// 4. Config validation (only if config exists)
const cfg = tryLoadConfig();
if (cfg) {
  if (!cfg.commands?.test) {
    findings.push({ kind: 'config', severity: 'hard', key: 'commands.test', hint: 'How to run tests.' });
  }
  // Per-check validation
  const checks = cfg.checks ?? {};
  if (checks['design-tokens']?.enabled) {
    const dt = checks['design-tokens'];
    if (!dt.extractor) findings.push({ kind: 'config', severity: 'hard', key: 'checks.design-tokens.extractor', hint: 'e.g. "tailwind".' });
    else {
      const extractor = `.claude/extractors/tokens/${dt.extractor}.mjs`;
      if (!exists(extractor)) findings.push({ kind: 'extractor', severity: 'hard', path: extractor, hint: 'Extractor not installed.' });
    }
    if (!dt.configFile) findings.push({ kind: 'config', severity: 'hard', key: 'checks.design-tokens.configFile', hint: 'Path to design-system config (e.g. tailwind.config.ts).' });
    else if (!exists(dt.configFile)) findings.push({ kind: 'missing-path', severity: 'hard', path: dt.configFile, hint: 'Referenced by checks.design-tokens but does not exist.' });
  }
  if (checks['i18n-pairs']?.enabled) {
    const i18 = checks['i18n-pairs'];
    if (!i18.extractor) findings.push({ kind: 'config', severity: 'hard', key: 'checks.i18n-pairs.extractor' });
    else {
      const extractor = `.claude/extractors/i18n/${i18.extractor}.mjs`;
      if (!exists(extractor)) findings.push({ kind: 'extractor', severity: 'hard', path: extractor });
    }
    if (!i18.file) findings.push({ kind: 'config', severity: 'hard', key: 'checks.i18n-pairs.file' });
    else if (!exists(i18.file)) findings.push({ kind: 'missing-path', severity: 'hard', path: i18.file });
    if (!Array.isArray(i18.locales) || i18.locales.length < 2) {
      findings.push({ kind: 'config', severity: 'hard', key: 'checks.i18n-pairs.locales', hint: 'Need ≥ 2 locales.' });
    }
  }
  if (checks['layered-imports']?.enabled) {
    if (!Array.isArray(checks['layered-imports'].rules) || checks['layered-imports'].rules.length === 0) {
      findings.push({ kind: 'config', severity: 'hard', key: 'checks.layered-imports.rules', hint: 'Empty rules array — disable the check or add rules.' });
    }
  }
} else {
  // Already reported as missing-path above.
}

// 5. Soft (warn-only)
if (!exists('ARCHITECTURE.md')) findings.push({ kind: 'missing-path', severity: 'soft', path: 'ARCHITECTURE.md', hint: 'Optional. Helps agents form deeper context.' });
if (!exists('README.md')) findings.push({ kind: 'missing-path', severity: 'soft', path: 'README.md', hint: 'Optional but recommended.' });

const hard = findings.filter((f) => f.severity === 'hard');
const soft = findings.filter((f) => f.severity === 'soft');
const ready = hard.length === 0;

if (json) {
  process.stdout.write(JSON.stringify({ ready, hard, soft }, null, 2) + '\n');
} else {
  process.stdout.write(`preflight: ${ready ? 'READY' : 'NOT READY'} (hard: ${hard.length}, soft: ${soft.length})\n`);
  if (hard.length) {
    process.stdout.write('\nMissing (hard — fix before running /sprint):\n');
    for (const f of hard) {
      const id = f.path ?? f.key ?? '?';
      process.stdout.write(`  • ${id}${f.hint ? '  — ' + f.hint : ''}\n`);
    }
  }
  if (soft.length) {
    process.stdout.write('\nWarnings (soft — recommended, not required):\n');
    for (const f of soft) {
      const id = f.path ?? f.key ?? '?';
      process.stdout.write(`  • ${id}${f.hint ? '  — ' + f.hint : ''}\n`);
    }
  }
}

process.exit(ready ? 0 : 1);
