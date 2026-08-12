import { ListChecks } from 'lucide-react';
import { PipelinePlaceholder } from './PipelinePlaceholder';

/**
 * The browser workbench lived here until 2026-08-12 and now lives at
 * `/studio/browser` — it was never a pipeline stage, and sitting among the six
 * made the rail say it was one (`docs/spec/pipeline/jobs.md`).
 *
 * What stays is the name's original promise: what ran, when, and how it went.
 * Until that exists this is a shell like its five siblings.
 */
export function JobsPage() {
  return (
    <PipelinePlaceholder
      testId="page-pipeline-jobs"
      icon={ListChecks}
      titleKey="pipeline.jobs.title"
      subtitleKey="pipeline.jobs.subtitle"
    />
  );
}
