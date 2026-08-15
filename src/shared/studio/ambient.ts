/**
 * What the workbench runner puts in scope before it imports a script.
 *
 * One declaration, two readers. The main process writes it into the workspace
 * as `scripts/hermetra-env.d.ts`, so the person's own `tsc` and any editor they
 * open the folder in agree with the runtime; the renderer hands the same text to
 * Monaco, so the editor inside the app does too.
 *
 * Two copies of this would drift, and the symptom of drift is the app painting
 * its own seed red — which is the thing it exists to prevent.
 */
export const STUDIO_AMBIENT_DTS = `// Hermetra workbench — what is in scope before your script is imported.
// Written once per workspace. Yours to edit; the app will not overwrite it.

declare global {
  /** The active tab of the workbench browser — a Playwright \`Page\`. */
  const page: any;
  /** The browser context behind it. \`context.newPage()\` opens another tab. */
  const context: any;
  /** The browser itself, if a script needs a context of its own. */
  const browser: any;
  /** The address bar, as the run saw it. */
  const ctx: { url?: string };
  /** Same as \`console.log\` — both land in the panel below, line by line. */
  function log(...args: unknown[]): void;
  /** The sidecar's environment variables. */
  const env: Record<string, string | undefined>;
  /** The shared variable bus. Reads are not wired to the workbench yet. */
  const bus: { set(key: string, value: string): void; get(key: string): string | undefined };
}

export {};
`;
