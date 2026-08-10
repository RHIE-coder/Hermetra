import { ListChecks } from 'lucide-react';
import { PipelinePlaceholder } from './PipelinePlaceholder';

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
