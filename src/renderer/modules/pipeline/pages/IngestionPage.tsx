import { ArrowDownToLine } from 'lucide-react';
import { PipelinePlaceholder } from './PipelinePlaceholder';

export function IngestionPage() {
  return (
    <PipelinePlaceholder
      testId="page-pipeline-ingestion"
      icon={ArrowDownToLine}
      titleKey="pipeline.ingestion.title"
      subtitleKey="pipeline.ingestion.subtitle"
    />
  );
}
