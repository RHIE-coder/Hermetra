/**
 * The fetch sidecar's child process. **Runs under real Node, never Electron.**
 *
 * `camoufox-js` depends on `better-sqlite3`, whose shipped build is V8-ABI (not
 * N-API). Loading it under Electron succeeds and then segfaults on first use —
 * in the main process and under `ELECTRON_RUN_AS_NODE` alike, because both use
 * Electron's V8. Keeping the launch here confines that dependency to a runtime
 * it works on; Electron only ever speaks WebSocket to the browser this starts.
 *
 * Contract with the supervisor:
 *   stdout  `WS <ws://…>` exactly once, then nothing. Progress goes to stderr.
 *   SIGTERM close the browser and exit 0.
 *
 * stdout stays machine-only so a chatty dependency cannot be mistaken for the
 * endpoint.
 */
const say = (msg) => process.stderr.write(`[sidecar] ${msg}\n`);

let server = null;

/**
 * The OS the browser should claim — `src/main/sidecar/spoof.ts` decides it and
 * says why. Absent means "let Camoufox pick", which is the old behaviour and the
 * right answer on a platform it has no font set for.
 */
function spoofOptions() {
  const os = process.env.HERMETRA_SIDECAR_OS;
  return os ? { os } : {};
}

async function main() {
  const headless = process.env.HERMETRA_SIDECAR_HEADLESS !== '0';
  const spoof = spoofOptions();
  say(`starting camoufox (headless=${headless}, os=${spoof.os ?? 'random'})`);

  const { launchServer } = await import('camoufox-js');
  server = await launchServer({ headless, ...spoof });

  const endpoint = server.wsEndpoint();
  say(`ready at ${endpoint}`);
  process.stdout.write(`WS ${endpoint}\n`);
}

async function shutdown(signal) {
  say(`${signal} — closing browser`);
  try {
    await server?.close?.();
  } catch (e) {
    say(`close failed: ${e}`);
  }
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

main().catch((e) => {
  // Exit non-zero so the supervisor sees a crash rather than a silent hang.
  say(`failed: ${e?.stack ?? e}`);
  process.exit(1);
});
