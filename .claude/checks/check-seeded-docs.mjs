#!/usr/bin/env node
/**
 * check-seeded-docs.mjs — UNIVERSAL DRIVER.
 *
 * Some documents are shipped *by* the app into a user's folder — the workbench
 * guide is one. They are written as string constants in source, and the copy on
 * disk can only be refreshed if the app can recognise its own older text. So a
 * retired version has to be recorded somewhere before it stops shipping.
 *
 * Forgetting that is silent and lands on the user: the app stops teaching X,
 * their file goes on teaching X, and they do what it says and nothing happens.
 * That is a real incident (2026-08-18, `export extract` in the workbench guide).
 *
 * The check compares the working tree against HEAD:
 *
 *   shipped text changed  and  the HEAD text is not in the record   → FAIL
 *   what ships today is listed in the record                        → FAIL
 *                                (every listing would rewrite it, so
 *                                 an edit of the person's survives one pass)
 *
 * Config — .claude/harness.config.json → checks.seeded-docs:
 *   { enabled, source, record, docs: [<const name>, ...] }
 *
 * Exit: 0 OK / 1 findings / 2 misconfigured or cannot compare.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { getCheck, root as cfgRoot } from '../lib/config.mjs';

const ROOT = cfgRoot();

/**
 * Every template literal in a file, as the text a runtime would see.
 *
 * A record file is a list of them and a source file names each one, so reading
 * the literals is enough — no need to understand the surrounding declarations.
 *
 * It has to walk the file the way the language does, not hunt for backticks:
 * these files are dense with doc comments that quote code in backticks, and a
 * scanner that counts those pairs off by one and then reads a real literal as
 * comment text. `${` means the value depends on something outside the file, and
 * a document seeded verbatim never does; such a literal is skipped rather than
 * guessed at.
 */
function templateLiterals(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '/' && next === '/') {
      i = src.indexOf('\n', i);
      if (i < 0) break;
      continue;
    }
    if (c === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end < 0 ? src.length : end + 2;
      continue;
    }
    if (c === "'" || c === '"') {
      i++;
      while (i < src.length && src[i] !== c) i += src[i] === '\\' ? 2 : 1;
      i++;
      continue;
    }
    if (c === '`') {
      const at = i;
      let body = '';
      let interpolated = false;
      i++;
      while (i < src.length && src[i] !== '`') {
        if (src[i] === '\\') {
          body += src[i + 1] ?? '';
          i += 2;
          continue;
        }
        if (src[i] === '$' && src[i + 1] === '{') interpolated = true;
        body += src[i];
        i++;
      }
      i++;
      if (!interpolated) out.push({ body, at });
      continue;
    }
    i++;
  }
  return out;
}

/** The literal assigned to `const <name> = ` in this source. */
function namedLiteral(src, name) {
  const decl = `const ${name} = \``;
  const at = src.indexOf(decl);
  if (at < 0) return null;
  const lit = templateLiterals(src).find((l) => l.at === at + decl.length - 1);
  return lit ? lit.body : null;
}

/** The same file as of the last commit, or null when it is not in HEAD yet. */
function atHead(rel) {
  const r = spawnSync('git', ['show', `HEAD:${rel}`], { cwd: ROOT, encoding: 'utf-8' });
  return r.status === 0 ? r.stdout : null;
}

const same = (a, b) => a.replace(/\r\n/g, '\n').trimEnd() === b.replace(/\r\n/g, '\n').trimEnd();

function main() {
  const cfg = getCheck('seeded-docs');
  if (!cfg.enabled) {
    process.stdout.write('check-seeded-docs: disabled in harness.config.json\n');
    process.exit(0);
  }
  if (!cfg.source || !cfg.record || !Array.isArray(cfg.docs) || cfg.docs.length === 0) {
    process.stderr.write('check-seeded-docs: source/record/docs[] required in harness.config.json\n');
    process.exit(2);
  }

  const sourceFile = path.join(ROOT, cfg.source);
  const recordFile = path.join(ROOT, cfg.record);
  for (const f of [sourceFile, recordFile]) {
    if (!fs.existsSync(f)) {
      process.stderr.write(`check-seeded-docs: ${path.relative(ROOT, f)} not found\n`);
      process.exit(2);
    }
  }

  const now = fs.readFileSync(sourceFile, 'utf-8');
  const before = atHead(cfg.source);
  const recorded = templateLiterals(fs.readFileSync(recordFile, 'utf-8')).map((l) => l.body);

  const findings = [];
  for (const name of cfg.docs) {
    const shipping = namedLiteral(now, name);
    if (shipping === null) {
      findings.push(`${name}: not found in ${cfg.source}`);
      continue;
    }
    if (recorded.some((r) => same(r, shipping))) {
      findings.push(
        `${name}: what ships today is listed in ${cfg.record}. ` +
          `The record is of retired versions only — listing the current one makes ` +
          `every refresh overwrite the file, so a person's edit survives one pass.`,
      );
    }
    // No HEAD copy means the constant is new in this change; nothing retired yet.
    const previous = before === null ? null : namedLiteral(before, name);
    if (previous === null || same(previous, shipping)) continue;
    if (!recorded.some((r) => same(r, previous))) {
      findings.push(
        `${name}: changed since the last commit, and the text it replaces is not in ` +
          `${cfg.record}. Copy the HEAD version in verbatim — without it the app ` +
          `cannot recognise the stale copy already sitting in a user's folder, and ` +
          `that copy keeps teaching what this change just removed.`,
      );
    }
  }

  if (findings.length === 0) {
    process.stdout.write(
      `check-seeded-docs: OK (${cfg.docs.length} document(s), ${recorded.length} retired version(s) recorded)\n`,
    );
    process.exit(0);
  }
  process.stderr.write('check-seeded-docs: FAIL\n');
  for (const f of findings) process.stderr.write(`  - ${f}\n`);
  process.exit(1);
}

main();
