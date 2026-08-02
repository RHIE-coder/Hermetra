// The gate that keeps the feedback overlay in dev builds only.
//
// `import.meta.env.DEV` is folded to a constant at build time, so a production
// renderer drops this branch and never reaches the lazy import — the overlay,
// the sketch pad and the DOM probe stay out of the shipped bundle. The IPC
// handler it talks to is likewise absent from a packaged app (`ipc/register.ts`).
import { Suspense, lazy } from 'react';

// Guarded here rather than inside the component so the production build never
// reaches `lazy()` at all — an unreachable dynamic import is one Rollup can
// drop, instead of emitting a chunk nothing will ever fetch.
const Overlay = import.meta.env.DEV
  ? lazy(() => import('./feedback-overlay').then((m) => ({ default: m.FeedbackOverlay })))
  : null;

export function DevFeedback() {
  if (!Overlay) return null;
  return (
    <Suspense fallback={null}>
      <Overlay />
    </Suspense>
  );
}
