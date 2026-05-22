#!/usr/bin/env node
/**
 * lint-ledger.mjs — Validate .claude/immunity/ledger.md entries.
 *
 * Checks:
 *  - required fields present (id, added, trigger, mistake, correct, source)
 *  - id is unique and kebab-case
 *  - added is YYYY-MM-DD
 *  - rule (if present) compiles as a JS regex
 *
 * Exit 0 if clean, 1 if any entry is malformed.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const REQUIRED = ['id', 'added', 'trigger', 'mistake', 'correct', 'source'];
const KEBAB = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseEntries(md) {
  // Take everything after "## Entries"
  const idx = md.indexOf('## Entries');
  if (idx < 0) return [];
  const body = md.slice(idx);
  const lines = body.split(/\r?\n/);
  const entries = [];
  let current = null;
  for (const line of lines) {
    const idStart = line.match(/^-\s+id:\s*(.+?)\s*$/);
    if (idStart) {
      if (current) entries.push(current);
      current = { id: idStart[1].trim(), _raw: [line], _lineStart: 0 };
      continue;
    }
    if (!current) continue;
    if (/^##\s/.test(line)) {
      // Section header → close current
      entries.push(current);
      current = null;
      continue;
    }
    current._raw.push(line);
    // Simple "key: value" field on the entry (must be indented under the entry)
    const field = line.match(/^\s+([a-z_]+):\s*(.*)$/);
    if (field) {
      const [, k, v] = field;
      if (current[k] === undefined) {
        current[k] = v.trim();
      }
    }
  }
  if (current) entries.push(current);
  return entries;
}

function lint(md) {
  const entries = parseEntries(md);
  const findings = [];
  const seen = new Set();

  if (entries.length === 0) {
    findings.push('no entries found under "## Entries"');
  }

  for (const e of entries) {
    for (const k of REQUIRED) {
      if (!e[k] || /^\s*$/.test(e[k])) {
        findings.push(`[${e.id ?? '?'}] missing field: ${k}`);
      }
    }
    if (e.id && !KEBAB.test(e.id)) {
      findings.push(`[${e.id}] id is not kebab-case`);
    }
    if (e.id) {
      if (seen.has(e.id)) findings.push(`[${e.id}] duplicate id`);
      seen.add(e.id);
    }
    if (e.added && !DATE.test(e.added)) {
      findings.push(`[${e.id}] added is not YYYY-MM-DD: ${e.added}`);
    }
    if (e.rule) {
      try {
        new RegExp(e.rule);
      } catch (err) {
        findings.push(`[${e.id}] rule does not compile as JS regex: ${err.message}`);
      }
    }
  }

  return { entries, findings };
}

const root = path.resolve(process.cwd());
const ledgerPath = path.join(root, '.claude/immunity/ledger.md');
if (!fs.existsSync(ledgerPath)) {
  process.stderr.write(`lint-ledger: not found: ${ledgerPath}\n`);
  process.exit(2);
}
const md = fs.readFileSync(ledgerPath, 'utf-8');
const { entries, findings } = lint(md);

if (findings.length === 0) {
  process.stdout.write(`lint-ledger: OK — ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}.\n`);
  process.exit(0);
}
process.stderr.write(`lint-ledger: ${findings.length} issue(s)\n`);
for (const f of findings) process.stderr.write(`  • ${f}\n`);
process.exit(1);
