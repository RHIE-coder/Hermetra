import { BarChart3 } from 'lucide-react';
import { PipelinePlaceholder } from './PipelinePlaceholder';

export function InsightsPage() {
  return (
    <PipelinePlaceholder
      testId="page-pipeline-insights"
      icon={BarChart3}
      titleKey="pipeline.insights.title"
      subtitleKey="pipeline.insights.subtitle"
    />
  );
}
