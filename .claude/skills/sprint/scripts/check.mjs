#!/usr/bin/env node
/**
 * check.mjs — UNIVERSAL. Reads harness.config.json → commands.{typecheck,
 * test, build} and runs each, returning a structured summary.
 *
 * Usage:
 *   node check.mjs            # human-readable
 *   node check.mjs --json     # machine-readable
 */
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { loadConfig } from '../../../lib/config.mjs';

const json = process.argv.includes('--json');
const cfg = loadConfig();
const cmds = cfg.commands ?? {};
const steps = [];

for (const label of ['typecheck', 'test', 'build']) {
  const cmd = cmds[label];
  if (!cmd) continue; // optional — skip if not configured
  const t0 = Date.now();
  const r = spawnSync(cmd, { shell: true, encoding: 'utf-8' });
  steps.push({
    label,
    cmd,
    code: r.status ?? -1,
    durationMs: Date.now() - t0,
    stdoutTail: (r.stdout ?? '').split(/\r?\n/).slice(-25).join('\n'),
    stderrTail: (r.stderr ?? '').split(/\r?\n/).slice(-25).join('\n'),
  });
}

const failed = steps.filter((s) => s.code !== 0);
const summary = { ok: failed.length === 0, steps: steps.map(({ label, code, durationMs }) => ({ label, code, durationMs })) };
if (json) {
  process.stdout.write(JSON.stringify({ ...summary, failed: failed.map(({ label, stderrTail }) => ({ label, stderrTail })) }, null, 2) + '\n');
} else {
  for (const s of steps) {
    const tag = s.code === 0 ? 'PASS' : 'FAIL';
    process.stdout.write(`[${tag}] ${s.label}  (${s.durationMs}ms)\n`);
  }
  if (failed.length) {
    process.stdout.write('\n--- failure output (tail) ---\n');
    for (const s of failed) {
      process.stdout.write(`\n### ${s.label}\n`);
      if (s.stdoutTail) process.stdout.write(s.stdoutTail + '\n');
      if (s.stderrTail) process.stdout.write(s.stderrTail + '\n');
    }
  }
}
process.exit(summary.ok ? 0 : 1);
