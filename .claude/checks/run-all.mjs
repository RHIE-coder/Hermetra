#!/usr/bin/env node
/**
 * run-all.mjs — UNIVERSAL. Reads harness.config.json → checks.* and runs
 * every check whose enabled flag is true. Skips disabled checks gracefully.
 *
 * Usage:
 *   node run-all.mjs                          # all enabled
 *   node run-all.mjs tokens imports           # subset
 *   node run-all.mjs --skip coverage          # all enabled except coverage
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../lib/config.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const REGISTRY = [
  { name: 'tokens', cfgKey: 'design-tokens', script: 'check-design-tokens.mjs' },
  { name: 'imports', cfgKey: 'layered-imports', script: 'check-layered-imports.mjs' },
  { name: 'i18n', cfgKey: 'i18n-pairs', script: 'check-i18n-pairs.mjs' },
  { name: 'ledger', cfgKey: 'ledger-violations', script: 'check-ledger-violations.mjs' },
  { name: 'coverage', cfgKey: 'coverage', script: 'check-coverage.mjs' },
];

const cfg = loadConfig();

const args = process.argv.slice(2);
const skipIdx = args.indexOf('--skip');
const skip = skipIdx >= 0 ? (args[skipIdx + 1] ?? '').split(',') : [];
const includes = args.filter((a, i) => !a.startsWith('--') && i !== skipIdx + (skipIdx >= 0 ? 1 : 0));

const selected = (includes.length ? REGISTRY.filter((c) => includes.includes(c.name)) : REGISTRY)
  .filter((c) => !skip.includes(c.name))
  .filter((c) => cfg.checks?.[c.cfgKey]?.enabled !== false);

const results = [];
for (const c of selected) {
  const t0 = Date.now();
  const r = spawnSync('node', [path.join(HERE, c.script)], { stdio: 'inherit' });
  results.push({ name: c.name, code: r.status ?? -1, durationMs: Date.now() - t0 });
}

process.stdout.write('\n=== SWEEP SUMMARY ===\n');
for (const r of results) {
  const tag = r.code === 0 ? 'PASS' : 'FAIL';
  process.stdout.write(`  [${tag}]  ${r.name.padEnd(12)} ${r.durationMs}ms\n`);
}
const failed = results.filter((r) => r.code !== 0);
process.stdout.write(`Total: ${results.length} | Pass: ${results.length - failed.length} | Fail: ${failed.length}\n`);
process.exit(failed.length ? 1 : 0);
