#!/usr/bin/env node
/**
 * gap-check.mjs — Scan a spec draft under .specs/active/ for missing or
 * placeholder-only sections. Exits 1 if gaps found (with a list to stderr),
 * 0 if the spec looks complete enough for /sprint to consume.
 *
 * Usage:
 *   node .claude/skills/intake/scripts/gap-check.mjs <path-to-spec.md>
 *   node .claude/skills/intake/scripts/gap-check.mjs .specs/active/foo.md
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const REQUIRED_SECTIONS = [
  'Goal',
  'Scope',
  'Non-scope (explicit)',
  'Acceptance criteria',
  'Affected layers (CLAUDE.md §3.1)',
  'Data model changes',
  'IPC contract changes',
  'UI flow',
  'i18n',
  'Error handling',
  'Performance / security notes',
  'Workspace / multi-tenancy',
  'Driver compatibility',
];

const PLACEHOLDER_RE = /\{\{[^}]+\}\}/;
const NA_TOKENS = /^(?:none|n\/a|not applicable|없음|해당\s*없음)\.?$/i;

function parseSections(md) {
  const lines = md.split(/\r?\n/);
  const sections = new Map();
  let current = null;
  for (const line of lines) {
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) {
      current = h[1].trim();
      sections.set(current, []);
      continue;
    }
    if (current) sections.get(current).push(line);
  }
  return sections;
}

function sectionIsEmpty(body) {
  const text = body.join('\n').trim();
  if (!text) return true;
  // Strip leading/trailing horizontal rules
  const meaningful = text
    .split('\n')
    .filter((l) => l.trim() && !/^---+$/.test(l.trim()))
    .join('\n')
    .trim();
  return meaningful.length === 0;
}

function sectionHasPlaceholdersOnly(body) {
  const text = body.join('\n').trim();
  if (!text) return false;
  // Lines that are either blank, a placeholder, or a bullet with only a placeholder
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.every(
    (l) =>
      /^[-*]\s*\{\{[^}]+\}\}\s*$/.test(l) ||
      /^\{\{[^}]+\}\}$/.test(l) ||
      /^\|\s*\{\{[^}]+\}\}/.test(l),
  );
}

function sectionMentionsPlaceholder(body) {
  return body.some((l) => PLACEHOLDER_RE.test(l));
}

function acceptanceCriteriaBad(body) {
  const text = body.join('\n');
  const boxes = text.match(/^\s*-\s+\[[ x]\]\s+.+$/gm) ?? [];
  if (boxes.length === 0) return 'no checklist items';
  // All boxes still contain only the template placeholder
  const allPlaceholder = boxes.every((b) => /\{\{[^}]+\}\}/.test(b));
  if (allPlaceholder) return 'all checklist items are template placeholders';
  return null;
}

function isAcceptableEmpty(name, body) {
  // Sections where "none" / "not applicable" is a valid answer
  const acceptable = new Set([
    'Non-scope (explicit)',
    'Data model changes',
    'IPC contract changes',
    'Error handling',
    'Performance / security notes',
    'Workspace / multi-tenancy',
    'Driver compatibility',
    'i18n',
  ]);
  if (!acceptable.has(name)) return false;
  const text = body
    .join('\n')
    .split('\n')
    .map((l) => l.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
  return NA_TOKENS.test(text);
}

function check(specPath) {
  const abs = path.resolve(specPath);
  if (!fs.existsSync(abs)) {
    process.stderr.write(`gap-check: file not found: ${abs}\n`);
    process.exit(2);
  }
  const md = fs.readFileSync(abs, 'utf-8');
  const sections = parseSections(md);
  const findings = [];

  for (const name of REQUIRED_SECTIONS) {
    if (!sections.has(name)) {
      findings.push(`missing section: ## ${name}`);
      continue;
    }
    const body = sections.get(name);
    if (sectionIsEmpty(body)) {
      findings.push(`empty section: ## ${name}`);
      continue;
    }
    if (isAcceptableEmpty(name, body)) continue;
    if (sectionHasPlaceholdersOnly(body)) {
      findings.push(`placeholders only: ## ${name}`);
      continue;
    }
    if (sectionMentionsPlaceholder(body)) {
      findings.push(`unresolved {{placeholder}} in: ## ${name}`);
    }
    if (name === 'Acceptance criteria') {
      const bad = acceptanceCriteriaBad(body);
      if (bad) findings.push(`acceptance criteria: ${bad}`);
    }
  }

  if (findings.length === 0) {
    process.stdout.write(`gap-check: OK — ${path.basename(abs)} looks complete.\n`);
    process.exit(0);
  }
  process.stderr.write(`gap-check: ${findings.length} gap(s) in ${path.basename(abs)}\n`);
  for (const f of findings) process.stderr.write(`  • ${f}\n`);
  process.exit(1);
}

const arg = process.argv[2];
if (!arg) {
  process.stderr.write('usage: gap-check.mjs <path-to-spec.md>\n');
  process.exit(2);
}
check(arg);
