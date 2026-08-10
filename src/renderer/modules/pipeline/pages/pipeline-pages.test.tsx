// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n';
import { messages } from '@/lib/messages';
import { JobsPage } from './JobsPage';
import { SourcesPage } from './SourcesPage';
import { IngestionPage } from './IngestionPage';
import { ProcessingPage } from './ProcessingPage';
import { StoragePage } from './StoragePage';
import { InsightsPage } from './InsightsPage';

/**
 * Spec acceptance criteria covered here (data-pipeline-nav):
 *
 *   AC-pipeline-01 — each of the six stage screens renders its own `page-*`
 *                    container. e2e and the surface adapter find a screen by
 *                    that ID, so a missing one is a screen that cannot be
 *                    verified, not merely an untested one.
 *   AC-pipeline-02 — each screen states what belongs there (title + subtitle)
 *                    and says plainly that it is not built yet.
 *
 * These screens hold no state and touch no IPC — there is deliberately nothing
 * to mock. What is worth pinning is the contract the rest of the harness reads.
 */

const SCREENS = [
  { name: 'Jobs', Page: JobsPage, testId: 'page-pipeline-jobs', titleKey: 'pipeline.jobs.title' },
  { name: 'Sources', Page: SourcesPage, testId: 'page-pipeline-sources', titleKey: 'pipeline.sources.title' },
  { name: 'Ingestion', Page: IngestionPage, testId: 'page-pipeline-ingestion', titleKey: 'pipeline.ingestion.title' },
  { name: 'Processing', Page: ProcessingPage, testId: 'page-pipeline-processing', titleKey: 'pipeline.processing.title' },
  { name: 'Storage', Page: StoragePage, testId: 'page-pipeline-storage', titleKey: 'pipeline.storage.title' },
  { name: 'Insights', Page: InsightsPage, testId: 'page-pipeline-insights', titleKey: 'pipeline.insights.title' },
] as const;

const renderPage = (Page: () => React.JSX.Element) =>
  render(
    <I18nProvider>
      <Page />
    </I18nProvider>,
  );

describe('Data Pipeline screens', () => {
  for (const { name, Page, testId, titleKey } of SCREENS) {
    // AC-pipeline-01
    it(`${name}: renders ${testId}`, () => {
      renderPage(Page);
      expect(screen.getByTestId(testId)).toBeInTheDocument();
    });

    // AC-pipeline-02: the heading is this screen's own, in whichever locale the
    // host picked — asserted against the catalogue rather than a literal, so the
    // test does not become a second place the copy lives.
    it(`${name}: heads the screen with its own title`, () => {
      renderPage(Page);
      const heading = screen.getByRole('heading', { level: 1 });

      expect([messages.en[titleKey], messages.ko[titleKey]]).toContain(heading.textContent);
    });

    // AC-pipeline-02
    it(`${name}: says it is not built yet`, () => {
      const { container } = renderPage(Page);
      const placeholder = [messages.en['pipeline.placeholder.title'], messages.ko['pipeline.placeholder.title']];

      expect(placeholder.some((text) => container.textContent?.includes(text))).toBe(true);
    });
  }

  it('gives every screen a distinct page container', () => {
    const ids = SCREENS.map((s) => s.testId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
