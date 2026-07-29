#!/usr/bin/env node
/**
 * design-token-guard.mjs — PreToolUse hook (Write|Edit).
 *
 * Blocks a write whose content references a Tailwind utility class with an
 * unregistered token. Re-uses the same scanner as
 * .claude/checks/check-design-tokens.mjs so the rule is defined in one place.
 *
 * Claude Code passes hook payload as JSON on stdin:
 *   { "tool_name": "Write" | "Edit",
 *     "tool_input": { "file_path": "...", "content"|"new_string": "..." } }
 *
 * Exit:
 *   0  → allow
 *   2  → block (stderr is shown to the user/agent)
 */
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tryLoadConfig } from '../lib/config.mjs';

const HOOK_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HOOK_DIR, '..', '..');
// A missing scanner exits non-zero, which blocks — the guard fails closed on a
// bad path rather than waving writes through.
const SCANNER = path.join(ROOT, '.claude/checks/check-design-tokens.mjs');

async function readPayload() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
    process.stdin.on('error', reject);
  });
}

function getContent(payload) {
  const input = payload.tool_input ?? {};
  // Write: { file_path, content }
  if (typeof input.content === 'string') return { file: input.file_path, content: input.content };
  // Edit: { file_path, new_string }
  if (typeof input.new_string === 'string') return { file: input.file_path, content: input.new_string };
  return null;
}

(async () => {
  let payload;
  try {
    payload = await readPayload();
  } catch {
    process.exit(0);
  }
  const got = getContent(payload);
  if (!got || !got.file) process.exit(0);

  // Read config to know whether design-tokens is enabled + what to scan.
  const cfg = tryLoadConfig();
  const dt = cfg?.checks?.['design-tokens'];
  if (!dt?.enabled) process.exit(0);
  const scanGlobs = dt.scanGlobs ?? ['src/**/*.tsx'];
  const rel = path.relative(ROOT, path.resolve(got.file)).split(path.sep).join('/');
  const matches = scanGlobs.some((g) => {
    const m = g.match(/^([^*]+)\/\*\*\/\*\.([a-z]+)$/i);
    if (!m) return rel === g;
    return rel.startsWith(m[1] + '/') && rel.toLowerCase().endsWith('.' + m[2].toLowerCase());
  });
  if (!matches) process.exit(0);

  const r = spawnSync(
    'node',
    [SCANNER, '--stdin', '--file-path', got.file],
    { input: got.content, encoding: 'utf-8' },
  );
  if (r.status === 0) process.exit(0);

  process.stderr.write('\n[design-token-guard] blocked write to ' + got.file + '\n');
  if (r.stderr) process.stderr.write(r.stderr);
  process.stderr.write(
    `\nResolution:\n` +
      `  1. Use an existing token registered via ${dt.extractor ?? 'your design system'} (${dt.configFile ?? '?'}).\n` +
      `  2. Register the token in your design system first, then write.\n` +
      `  3. Or use a project-defined component class instead of a raw utility.\n` +
      `See .claude/immunity/ledger.md and CLAUDE.md.\n`,
  );
  process.exit(2);
})();
