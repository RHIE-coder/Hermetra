#!/usr/bin/env node
/**
 * immunity-rules-guard.mjs — PreToolUse hook (Write|Edit).
 *
 * For each entry in .claude/immunity/ledger.md that has a `rule:` regex,
 * check the proposed write/edit content. If any rule matches, block.
 *
 * Re-uses .claude/skills/sweep/scripts/check-ledger-violations.mjs to keep
 * the rule semantics in one place.
 *
 * Exit:
 *   0  → allow
 *   2  → block
 */
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HOOK_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HOOK_DIR, '..', '..');
const SCANNER = path.join(ROOT, '.claude/skills/sweep/scripts/check-ledger-violations.mjs');

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
  if (typeof input.content === 'string') return { file: input.file_path, content: input.content };
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

  // Don't lint ledger / hook / skill internals — they describe rules.
  const rel = path.relative(ROOT, path.resolve(got.file)).split(path.sep).join('/');
  if (rel.startsWith('.claude/')) process.exit(0);
  // Don't lint markdown — docs frequently need to discuss the bad pattern.
  // Ledger rules are for source code; docs/specs are exempt.
  if (/\.(md|mdx|txt)$/i.test(got.file)) process.exit(0);

  const r = spawnSync(
    'node',
    [SCANNER, '--stdin', '--file-path', got.file],
    { input: got.content, encoding: 'utf-8' },
  );
  if (r.status === 0) process.exit(0);

  process.stderr.write('\n[immunity-rules-guard] blocked write to ' + got.file + '\n');
  if (r.stderr) process.stderr.write(r.stderr);
  process.stderr.write(
    '\nSee .claude/immunity/ledger.md for the rule rationale. ' +
      'If the rule is genuinely wrong here, either narrow the regex or remove the entry — ' +
      'do not bypass.\n',
  );
  process.exit(2);
})();
