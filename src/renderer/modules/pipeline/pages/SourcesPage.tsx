import { Antenna } from 'lucide-react';
import { PipelinePlaceholder } from './PipelinePlaceholder';

export function SourcesPage() {
  return (
    <PipelinePlaceholder
      testId="page-pipeline-sources"
      icon={Antenna}
      titleKey="pipeline.sources.title"
      subtitleKey="pipeline.sources.subtitle"
    />
  );
}
