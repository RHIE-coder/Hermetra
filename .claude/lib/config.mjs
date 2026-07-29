/**
 * config.mjs — Load and validate .claude/harness.config.json.
 *
 * Single source of truth for project-specific knobs the check scripts read.
 * Used by .claude/checks/* and the two PreToolUse hooks.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, '.claude/harness.config.json');

let cached = null;

export function loadConfig() {
  if (cached) return cached;
  if (!fs.existsSync(CONFIG_PATH)) {
    const err = new Error(
      `harness.config.json not found at ${CONFIG_PATH}\n` +
        `It configures the checks in .claude/checks/ — restore it from git history.`,
    );
    err.code = 'NO_HARNESS_CONFIG';
    throw err;
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch (e) {
    throw new Error(`harness.config.json is not valid JSON: ${e.message}`, { cause: e });
  }
  cached = raw;
  return raw;
}

export function tryLoadConfig() {
  try {
    return loadConfig();
  } catch (e) {
    if (e.code === 'NO_HARNESS_CONFIG') return null;
    throw e;
  }
}

export function getCheck(name) {
  const cfg = loadConfig();
  return cfg.checks?.[name] ?? { enabled: false };
}

export function isEnabled(name) {
  return !!getCheck(name).enabled;
}

export function getCommand(name) {
  const cfg = loadConfig();
  return cfg.commands?.[name] ?? null;
}

export function root() {
  return ROOT;
}
