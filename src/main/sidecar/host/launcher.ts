import { createLineSplitter } from '../protocol.ts';
import { BrowserHost, type HostContext } from './browser.ts';
import { createDispatcher } from './serve.ts';

/**
 * The sidecar process. **Runs under real Node, never Electron.**
 *
 * `camoufox-js` depends on `better-sqlite3`, whose shipped build is V8-ABI (not
 * N-API). Loading it under Electron succeeds and then segfaults on first use —
 * in the main process and under `ELECTRON_RUN_AS_NODE` alike, because both use
 * Electron's V8. Keeping the launch here confines that dependency to a runtime
 * it works on.
 *
 * It holds more than the launch. The browser, the tabs and the user's script all
 * live here, because a second Playwright client connected to the same browser
 * server sees `contexts = 0` — a script running anywhere else would be handed an
 * empty browser rather than the tab the person is looking at
 * (`docs/spec/studio/browser.md` — `studio.session`).
 *
 * This file is **not bundled**. It is copied as source and loaded by the Node
 * runtime shipped beside the app, which is also what lets the user's own `.ts`
 * script be imported with its types stripped and nothing installed.
 *
 * Contract with the supervisor (`docs/spec/studio/README.md`):
 *   stdout  one JSON frame per line — `ready` once, then replies and log lines.
 *   stdin   one JSON request per line.
 *   SIGTERM close the browser and exit 0.
 *
 * stdout stays machine-only so a chatty dependency cannot be mistaken for a
 * frame; anything for a person goes to stderr.
 */

const say = (msg: string) => process.stderr.write(`[sidecar] ${msg}\n`);
const emit = (frame: unknown) => process.stdout.write(`${JSON.stringify(frame)}\n`);

let server: { close?: () => Promise<void>; wsEndpoint(): string } | null = null;
let browser: { close(): Promise<void>; newContext(): Promise<unknown> } | null = null;

/** What Camoufox accepts. `spoof.ts` only ever produces one of these. */
type SpoofOs = 'linux' | 'macos' | 'windows';

/**
 * The OS the browser should claim — `src/main/sidecar/spoof.ts` decides it and
 * says why. Absent means "let Camoufox pick", which is the old behaviour and the
 * right answer on a platform it has no font set for.
 */
function spoofOptions(): { os?: SpoofOs } {
  const os = process.env.HERMETRA_SIDECAR_OS;
  return os ? { os: os as SpoofOs } : {};
}

async function main() {
  const headless = process.env.HERMETRA_SIDECAR_HEADLESS !== '0';
  const spoof = spoofOptions();
  say(`starting camoufox (headless=${headless}, os=${spoof.os ?? 'random'})`);

  const { launchServer } = await import('camoufox-js');
  server = await launchServer({ headless, ...spoof });
  const endpoint = server!.wsEndpoint();

  // Connected from inside the process that will run the scripts. Firefox, not
  // Chromium: Camoufox is a patched Firefox and a Chromium client cannot speak
  // to it.
  const { firefox } = await import('playwright');
  browser = await firefox.connect({ wsEndpoint: endpoint });
  const context = (await browser.newContext()) as unknown as HostContext;

  const host = new BrowserHost(context, browser);
  await host.ensurePage();

  const dispatch = createDispatcher({ host, write: (line) => process.stdout.write(line) });
  const feed = createLineSplitter((line) => void dispatch(line));
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk: string) => feed(chunk));

  say(`ready at ${endpoint}`);
  emit({ t: 'ready', endpoint });
}

async function shutdown(signal: string) {
  say(`${signal} — closing browser`);
  try {
    await browser?.close();
  } catch (e) {
    say(`disconnect failed: ${e}`);
  }
  try {
    await server?.close?.();
  } catch (e) {
    say(`close failed: ${e}`);
  }
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

main().catch((e: unknown) => {
  // Exit non-zero so the supervisor sees a crash rather than a silent hang.
  say(`failed: ${(e as Error)?.stack ?? e}`);
  process.exit(1);
});
