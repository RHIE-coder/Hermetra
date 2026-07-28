#!/usr/bin/env node
/**
 * check-ledger-violations.mjs — Walk every `rule:` regex in
 * .claude/immunity/ledger.md and grep the repo for matches.
 *
 * Doubles as the immunity-rules-guard PreToolUse hook when called with
 * --stdin --file-path PATH (scans content from stdin against rules).
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const LEDGER = path.join(ROOT, '.claude/immunity/ledger.md');

if (!fs.existsSync(LEDGER)) {
  process.stderr.write(`check-ledger-violations: ledger not found at ${LEDGER}\n`);
  process.exit(2);
}

function loadRules() {
  // Parse the same way lint-ledger does, but only keep entries with `rule:`.
  const md = fs.readFileSync(LEDGER, 'utf-8');
  const idx = md.indexOf('## Entries');
  if (idx < 0) return [];
  const body = md.slice(idx).split(/\r?\n/);
  const rules = [];
  let cur = null;
  for (const line of body) {
    const idStart = line.match(/^-\s+id:\s*(.+?)\s*$/);
    if (idStart) {
      if (cur && cur.rule) rules.push(cur);
      cur = { id: idStart[1].trim() };
      continue;
    }
    if (!cur) continue;
    const ruleLine = line.match(/^\s+rule:\s*(.+?)\s*$/);
    if (ruleLine) cur.rule = ruleLine[1];
  }
  if (cur && cur.rule) rules.push(cur);
  // Compile
  for (const r of rules) {
    try {
      r.re = new RegExp(r.rule);
    } catch (err) {
      process.stderr.write(`check-ledger-violations: rule for "${r.id}" does not compile: ${err.message}\n`);
      process.exit(2);
    }
  }
  return rules;
}

function walk(dir, acc) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'out', 'dist', '.git', 'coverage', '.specs'].includes(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip .claude/immunity/ledger.md so the rule patterns themselves don't match
      walk(abs, acc);
    } else if (entry.isFile() && /\.(ts|tsx|mjs|js|css|html|json)$/i.test(entry.name)) {
      // Skip the ledger and the rule-guard hook itself
      const rel = path.relative(ROOT, abs).split(path.sep).join('/');
      if (rel === '.claude/immunity/ledger.md') continue;
      if (rel.startsWith('.claude/skills/')) continue; // skill docs may reference rules
      if (rel.startsWith('.claude/agents/')) continue;
      if (rel.startsWith('.claude/hooks/')) continue;
      acc.push(abs);
    }
  }
  return acc;
}

async function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
  });
}

async function main() {
  const args = process.argv.slice(2);
  const stdinFlag = args.includes('--stdin');
  const fpIdx = args.indexOf('--file-path');
  const filePathArg = fpIdx >= 0 ? args[fpIdx + 1] : null;

  const rules = loadRules();
  if (rules.length === 0) {
    process.stdout.write('check-ledger-violations: no rules to enforce\n');
    process.exit(0);
  }

  const findings = [];
  if (stdinFlag) {
    const content = await readStdin();
    const filePath = filePathArg ?? '<stdin>';
    // Don't apply rules to the ledger itself or to immunity scripts (they
    // reference patterns descriptively).
    const rel = path.relative(ROOT, path.resolve(filePath)).split(path.sep).join('/');
    if (rel === '.claude/immunity/ledger.md' || rel.startsWith('.claude/')) {
      process.exit(0);
    }
    for (const r of rules) {
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (r.re.test(lines[i])) {
          findings.push({ file: filePath, line: i + 1, id: r.id, src: lines[i].trim() });
        }
      }
    }
  } else {
    const files = walk(path.join(ROOT, 'src'), []);
    // Also scan top-level config files
    for (const extra of ['tailwind.config.ts', 'vitest.config.ts', 'package.json']) {
      const abs = path.join(ROOT, extra);
      if (fs.existsSync(abs)) files.push(abs);
    }
    for (const abs of files) {
      const rel = path.relative(ROOT, abs).split(path.sep).join('/');
      const content = fs.readFileSync(abs, 'utf-8');
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        for (const r of rules) {
          if (r.re.test(lines[i])) {
            findings.push({ file: rel, line: i + 1, id: r.id, src: lines[i].trim() });
          }
        }
      }
    }
  }

  if (findings.length === 0) {
    process.stdout.write(`check-ledger-violations: OK (${rules.length} rule(s) enforced)\n`);
    process.exit(0);
  }
  process.stderr.write(`check-ledger-violations: ${findings.length} violation(s)\n`);
  for (const f of findings) {
    process.stderr.write(`  • ${f.file}:${f.line}  [${f.id}]  ${f.src}\n`);
  }
  process.stderr.write(`\nSee .claude/immunity/ledger.md for the rule rationale.\n`);
  process.exit(1);
}

main();
