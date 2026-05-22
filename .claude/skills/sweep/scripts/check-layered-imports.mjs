#!/usr/bin/env node
/**
 * check-layered-imports.mjs — UNIVERSAL.
 *
 * Reads .claude/harness.config.json → checks.layered-imports.rules and
 * enforces them. Each rule is { scope: regex, forbid: [{ pattern, msg }] }.
 *
 * `scope` is a regex matched against the relative file path. `forbid.pattern`
 * is a regex matched line-by-line. If both match, the line is flagged.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { getCheck, root as cfgRoot } from '../../../lib/config.mjs';

const ROOT = cfgRoot();

const cfg = getCheck('layered-imports');
if (!cfg.enabled) {
  process.stdout.write('check-layered-imports: disabled in harness.config.json\n');
  process.exit(0);
}
const rules = (cfg.rules ?? []).map((r) => ({
  scope: new RegExp(r.scope),
  forbid: (r.forbid ?? []).map((f) => ({ re: new RegExp(f.pattern), msg: f.msg })),
}));
if (rules.length === 0) {
  process.stdout.write('check-layered-imports: no rules configured — skipping\n');
  process.exit(0);
}

function walk(dir, acc) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'out', 'dist', '.git', 'coverage'].includes(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, acc);
    else if (entry.isFile() && /\.(ts|tsx|mjs|js)$/i.test(entry.name)) acc.push(abs);
  }
  return acc;
}

const srcDir = path.join(ROOT, 'src');
const files = fs.existsSync(srcDir) ? walk(srcDir, []) : [];
const findings = [];

for (const abs of files) {
  const rel = path.relative(ROOT, abs).split(path.sep).join('/');
  const matched = rules.filter((r) => r.scope.test(rel));
  if (matched.length === 0) continue;
  const lines = fs.readFileSync(abs, 'utf-8').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    for (const rule of matched) {
      for (const f of rule.forbid) {
        if (f.re.test(lines[i])) {
          findings.push({ file: rel, line: i + 1, msg: f.msg, src: lines[i].trim() });
        }
      }
    }
  }
}

if (findings.length === 0) {
  process.stdout.write(`check-layered-imports: OK (${rules.length} rule(s))\n`);
  process.exit(0);
}
process.stderr.write(`check-layered-imports: ${findings.length} violation(s)\n`);
for (const f of findings) {
  process.stderr.write(`  • ${f.file}:${f.line}  ${f.msg}\n    ${f.src}\n`);
}
process.exit(1);
