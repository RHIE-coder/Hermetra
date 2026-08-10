import { Cog } from 'lucide-react';
import { PipelinePlaceholder } from './PipelinePlaceholder';

export function ProcessingPage() {
  return (
    <PipelinePlaceholder
      testId="page-pipeline-processing"
      icon={Cog}
      titleKey="pipeline.processing.title"
      subtitleKey="pipeline.processing.subtitle"
    />
  );
}
