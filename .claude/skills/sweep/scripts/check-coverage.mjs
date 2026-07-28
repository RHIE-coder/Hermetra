#!/usr/bin/env node
/**
 * check-coverage.mjs — UNIVERSAL DRIVER.
 *
 * Reads harness.config.json → checks.coverage. Currently supports
 * runner=vitest (parses thresholds from vitest.config.ts). Other runners
 * can extend the switch.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { getCheck, getCommand, root as cfgRoot } from '../../../lib/config.mjs';

const ROOT = cfgRoot();
const cfg = getCheck('coverage');
if (!cfg.enabled) {
  process.stdout.write('check-coverage: disabled in harness.config.json\n');
  process.exit(0);
}

const MAX_AGE_MS = 5 * 60 * 1000;
const force = process.argv.includes('--force');
const summaryFile = path.join(ROOT, cfg.summaryFile ?? 'coverage/coverage-summary.json');

function freshSummary() {
  if (force || !fs.existsSync(summaryFile)) return false;
  return Date.now() - fs.statSync(summaryFile).mtimeMs < MAX_AGE_MS;
}

if (!freshSummary()) {
  const coverageCmd = getCommand('coverage');
  if (!coverageCmd) {
    process.stderr.write('check-coverage: commands.coverage not set in harness.config.json\n');
    process.exit(2);
  }
  process.stdout.write('check-coverage: running coverage...\n');
  const r = spawnSync(coverageCmd, { shell: true, stdio: ['ignore', 'inherit', 'inherit'] });
  if (r.status !== 0) {
    process.stderr.write(`check-coverage: command exited ${r.status}\n`);
    process.exit(r.status ?? 1);
  }
}

if (!fs.existsSync(summaryFile)) {
  process.stderr.write(`check-coverage: ${summaryFile} not produced\n`);
  process.exit(2);
}

const summary = JSON.parse(fs.readFileSync(summaryFile, 'utf-8'));

// Threshold parser per runner
const runner = cfg.runner ?? 'vitest';
let thresholds = [];
switch (runner) {
  case 'vitest': {
    const vitestCfg = path.join(ROOT, 'vitest.config.ts');
    if (fs.existsSync(vitestCfg)) {
      const src = fs.readFileSync(vitestCfg, 'utf-8');
      const re = /'([^']+)'\s*:\s*\{\s*lines:\s*(\d+)\s*,\s*branches:\s*(\d+)\s*,\s*functions:\s*(\d+)\s*,\s*statements:\s*(\d+)\s*\}/g;
      let m;
      while ((m = re.exec(src))) {
        thresholds.push({ glob: m[1], lines: +m[2], branches: +m[3], functions: +m[4], statements: +m[5] });
      }
    }
    break;
  }
  default:
    process.stderr.write(`check-coverage: unknown runner "${runner}"; supported: vitest\n`);
    process.exit(2);
}

/**
 * Single pass, because chained .replace() calls corrupt each other: turning `**`
 * into `.*` first means the later `*` → `[^/]*` pass rewrites that `.*` into
 * `.[^/]*`, which silently demands an extra path segment. That bug made
 * `src/main/bridge/**\/*.ts` never match `src/main/bridge/orchestrator.ts`, so
 * every threshold rule reported OK.
 */
function globToRegExp(glob) {
  let out = '^';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        if (glob[i + 2] === '/') {
          out += '(?:[^/]+/)*'; // `**/` — zero or more directories
          i += 2;
        } else {
          out += '.*';
          i += 1;
        }
      } else {
        out += '[^/]*'; // `*` — within one segment
      }
    } else if ('.+^${}()|[]\\?'.includes(ch)) {
      out += `\\${ch}`;
    } else {
      out += ch;
    }
  }
  return new RegExp(`${out}$`);
}

function matchGlob(p, glob) {
  return globToRegExp(glob).test(p.replace(/\\/g, '/'));
}

const findings = [];
for (const [absFile, metrics] of Object.entries(summary)) {
  if (absFile === 'total') continue;
  const rel = path.relative(ROOT, absFile).replace(/\\/g, '/');
  for (const t of thresholds) {
    if (!matchGlob(rel, t.glob)) continue;
    const checks = [
      ['lines', metrics.lines.pct],
      ['branches', metrics.branches.pct],
      ['functions', metrics.functions.pct],
      ['statements', metrics.statements.pct],
    ];
    for (const [metric, pct] of checks) {
      if (pct < t[metric]) findings.push({ file: rel, metric, pct, need: t[metric] });
    }
  }
}

if (findings.length === 0) {
  process.stdout.write(`check-coverage: OK (runner=${runner}, ${thresholds.length} threshold rule(s))\n`);
  process.exit(0);
}
process.stderr.write(`check-coverage: ${findings.length} threshold miss(es)\n`);
for (const f of findings) {
  process.stderr.write(`  • ${f.file}  ${f.metric} ${f.pct.toFixed(1)}% < ${f.need}%\n`);
}
process.exit(1);
