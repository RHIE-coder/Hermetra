import { Database } from 'lucide-react';
import { PipelinePlaceholder } from './PipelinePlaceholder';

export function StoragePage() {
  return (
    <PipelinePlaceholder
      testId="page-pipeline-storage"
      icon={Database}
      titleKey="pipeline.storage.title"
      subtitleKey="pipeline.storage.subtitle"
    />
  );
}
