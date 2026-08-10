// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/lib/i18n';
import { Sidebar } from './sidebar';

/**
 * Spec acceptance criteria covered here (mobile-inspector-page):
 *
 *   AC1: A new nav item `nav-mobile-inspector` exists in the Mobile group,
 *        with `to="/mobile/inspector"`.
 *
 * Why this lives in a dedicated sidebar test rather than the page test:
 *   - The Sidebar is a stand-alone component imported by AppShell.
 *   - The existing convention is to leave Sidebar untested at the unit layer,
 *     but adding a NEW nav item is exactly the kind of structural change the
 *     ledger entry `redesign-scope-overreach` warns about — the spec EXPLICITLY
 *     authorises this single item, so we pin its presence with a unit test
 *     to prevent silent regression.
 *
 * Boundary: Sidebar imports `NavLink` from react-router-dom → wrap in
 * `MemoryRouter`. No store interaction; the component reads no store.
 */

beforeEach(() => {
  // The drawer remembers itself; a cleared store is what "first launch" means.
  window.localStorage.clear();
});

const renderSidebar = (initialPath = '/') =>
  render(
    <I18nProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Sidebar />
      </MemoryRouter>
    </I18nProvider>,
  );

/**
 * The legacy drawer starts folded, so its rows are not in the DOM. Assertions
 * *about* those rows seed the drawer's memory instead of clicking it open —
 * the fold behaviour has its own describe and does not need re-testing here.
 */
const withLegacyOpen = (initialPath = '/') => {
  window.localStorage.setItem('hermetra.sidebar.legacyOpen', 'true');
  return renderSidebar(initialPath);
};

describe('Sidebar — mobile-inspector nav item', () => {
  // AC1: the new nav-mobile-inspector item is present.
  it('AC1: renders a nav-mobile-inspector entry pointing to /mobile/inspector', () => {
    withLegacyOpen();

    const item = screen.getByTestId('nav-mobile-inspector');
    expect(item).toBeInTheDocument();
    // The NavLink href is set to its `to` prop.
    expect((item as HTMLAnchorElement).getAttribute('href')).toBe('/mobile/inspector');
  });

  // AC1: the existing Mobile group items are unchanged (no churn).
  it('AC1: existing Mobile group items (devices / code) still render', () => {
    withLegacyOpen();
    expect(screen.getByTestId('nav-mobile-devices')).toBeInTheDocument();
    expect(screen.getByTestId('nav-mobile-code')).toBeInTheDocument();
  });

  // Sanity: the new item is rendered inside the Mobile group, not Bridge / Web.
  // We pin this by checking it appears after nav-mobile-code in DOM order
  // (the spec says "Mobile 그룹 3번째 항목").
  it('AC1: nav-mobile-inspector appears as the 3rd item in the Mobile group (after devices, code)', () => {
    withLegacyOpen();
    const devices = screen.getByTestId('nav-mobile-devices');
    const code = screen.getByTestId('nav-mobile-code');
    const inspector = screen.getByTestId('nav-mobile-inspector');
    // compareDocumentPosition: FOLLOWING = 4
    expect(devices.compareDocumentPosition(code) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(code.compareDocumentPosition(inspector) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

/**
 * The navigation carries no module accent — no coloured group dot, no coloured
 * rail on the selected row. That was asked for twice: the first time it was
 * read as "cards only" and the rail survived, which is why it is pinned here
 * rather than left to judgement.
 *
 * Selection still has to be visible without colour, so it is expressed as
 * depth: the chosen row is pressed into its group card.
 */
const ACCENT_CLASS = /\b(?:bg|text|border|ring|from|via|to)-(?:web|mobile|bridge)(?:\/\d+)?\b/;

describe('Sidebar — no accent, selection reads as depth', () => {
  it('renders no module accent class anywhere in the rail', () => {
    const { container } = withLegacyOpen('/web/remote');

    const offenders = [...container.querySelectorAll<HTMLElement>('[class]')]
      .map((el) => el.className)
      .filter((c) => typeof c === 'string' && ACCENT_CLASS.test(c));

    expect(offenders).toEqual([]);
  });

  it('marks the current route by pressing its row in, not by tinting it', () => {
    withLegacyOpen('/web/remote');
    const active = screen.getByTestId('nav-web-remote');

    expect(active.className).toContain('bg-muted');
    expect(active.className).toContain('shadow-inner');
    expect(active.className).toContain('font-semibold');
    // No rail: a `before:` bar in the signal colour is the shape that was cut.
    expect(active.className).not.toContain('before:bg-primary');
  });

  it('leaves every other row flush', () => {
    withLegacyOpen('/web/remote');
    const other = screen.getByTestId('nav-bridge-bus');

    expect(other.className).not.toContain('bg-muted');
    expect(other.className).not.toContain('shadow-inner');
  });

  /**
   * One card per product area, not one per group: web / mobile / bridge are
   * shelves inside a single Legacy drawer, and Data Pipeline is the second
   * drawer. A full-bleed band inside a full-bleed band would read as two
   * competing headers, so the shelves are plain muted labels.
   */
  it('groups every item into a collapsible card, one per drawer', () => {
    const { container } = renderSidebar('/');
    const cards = container.querySelectorAll('nav > section');

    expect(cards).toHaveLength(2);
    for (const card of cards) {
      expect(card.className).toContain('bg-card');
      expect(card.className).toContain('shadow');
    }
  });
});

/**
 * Two naming regressions worth pinning, both asserted by absence and therefore
 * locale-independent (the provider picks its locale up from the host):
 *
 *   - The bridge group must not be called "Settings" / "설정" again. That label
 *     filed this product's actual work — scenarios, variables, shared bus,
 *     event stream — under the one word users read as "config I never open".
 *   - The rail head carries no tagline. It was a landing-page line living in
 *     permanent UI, and the only thing that genuinely changes there (the active
 *     workspace) is the topbar's job.
 */
describe('Sidebar — naming', () => {
  it('labels the bridge group "Bridge", never "Settings"', () => {
    const { container } = withLegacyOpen('/bridge/bus');

    expect(container.textContent).not.toMatch(/settings|설정/i);
    expect(container.textContent).toMatch(/bridge|브리지/i);
  });

  it('shows the product name in the head with no tagline under it', () => {
    const { container } = renderSidebar('/');
    const head = container.querySelector('aside > div');

    expect(head?.textContent?.trim()).toBe('Hermetra');
    expect(container.textContent).not.toMatch(/automation bridge|자동화 브리지/i);
  });
});

/**
 * The legacy drawer starts **folded**, and remembers.
 *
 * It used to start open, because every screen this app had lived inside it and
 * starting collapsed would have hidden the app from itself. Data Pipeline made
 * that reasoning obsolete twice over: the rail now has a group that leads, and
 * fifteen rows with both drawers open overflow a 1024x720 rail (the last row is
 * clipped to a sliver). The group named "Legacy" is the one that gives way.
 */
describe('Sidebar — the legacy drawer', () => {
  it('starts folded, and the nav is still not empty', () => {
    renderSidebar();

    expect(screen.getByTestId('nav-legacy-toggle')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('nav-web-remote')).not.toBeInTheDocument();
    expect(screen.getByTestId('nav-pipeline-jobs')).toBeInTheDocument();
  });

  it('unfolds every item when opened', async () => {
    renderSidebar();
    await userEvent.click(screen.getByTestId('nav-legacy-toggle'));

    for (const id of ['nav-web-remote', 'nav-mobile-devices', 'nav-bridge-bus']) {
      expect(screen.getByTestId(id), id).toBeInTheDocument();
    }
  });

  it('remembers that it was opened', async () => {
    renderSidebar();
    await userEvent.click(screen.getByTestId('nav-legacy-toggle'));

    expect(window.localStorage.getItem('hermetra.sidebar.legacyOpen')).toBe('true');
  });

  it('opens unfolded when that is what was left last time', () => {
    window.localStorage.setItem('hermetra.sidebar.legacyOpen', 'true');
    renderSidebar();

    expect(screen.getByTestId('nav-legacy-toggle')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('nav-web-remote')).toBeInTheDocument();
  });

  it('folds only itself away — the Data Pipeline drawer is untouched', async () => {
    window.localStorage.setItem('hermetra.sidebar.legacyOpen', 'true');
    renderSidebar();
    await userEvent.click(screen.getByTestId('nav-legacy-toggle'));

    expect(screen.queryByTestId('nav-web-remote')).not.toBeInTheDocument();
    expect(screen.getByTestId('nav-pipeline-jobs')).toBeInTheDocument();
  });

  it('keeps every route reachable once open', () => {
    window.localStorage.setItem('hermetra.sidebar.legacyOpen', 'true');
    renderSidebar();

    const hrefs = [
      ['nav-web-remote', '/web/remote'],
      ['nav-web-code', '/web/code'],
      ['nav-mobile-devices', '/mobile/devices'],
      ['nav-mobile-code', '/mobile/code'],
      ['nav-mobile-inspector', '/mobile/inspector'],
      ['nav-bridge-scenarios', '/bridge/scenarios'],
      ['nav-bridge-variables', '/bridge/variables'],
      ['nav-bridge-bus', '/bridge/bus'],
      ['nav-bridge-events', '/bridge/events'],
    ] as const;

    for (const [testId, href] of hrefs) {
      expect((screen.getByTestId(testId) as HTMLAnchorElement).getAttribute('href')).toBe(href);
    }
  });
});

/**
 * Spec acceptance criteria covered here (data-pipeline-nav):
 *
 *   AC-app.shell.sidebar-06 — a Data Pipeline drawer holds six stage screens,
 *   in pipeline order, above the Legacy drawer.
 *
 * The order is load-bearing: the rail is the only place the pipeline's shape is
 * stated, so a shuffled list would quietly restate the product. Pinned by
 * document position rather than by index so inserting a stage later fails loudly.
 */
describe('Sidebar — the Data Pipeline drawer', () => {
  const PIPELINE = [
    ['nav-pipeline-jobs', '/pipeline/jobs'],
    ['nav-pipeline-sources', '/pipeline/sources'],
    ['nav-pipeline-ingestion', '/pipeline/ingestion'],
    ['nav-pipeline-processing', '/pipeline/processing'],
    ['nav-pipeline-storage', '/pipeline/storage'],
    ['nav-pipeline-insights', '/pipeline/insights'],
  ] as const;

  it('renders all six stage screens with their routes', () => {
    renderSidebar();

    for (const [testId, href] of PIPELINE) {
      const row = screen.getByTestId(testId) as HTMLAnchorElement;
      expect(row, testId).toBeInTheDocument();
      expect(row.getAttribute('href'), testId).toBe(href);
    }
  });

  it('keeps them in pipeline order', () => {
    renderSidebar();

    const rows = PIPELINE.map(([testId]) => screen.getByTestId(testId));
    for (let i = 0; i < rows.length - 1; i += 1) {
      expect(
        rows[i]!.compareDocumentPosition(rows[i + 1]!) & Node.DOCUMENT_POSITION_FOLLOWING,
        `${PIPELINE[i]![0]} should precede ${PIPELINE[i + 1]![0]}`,
      ).toBeTruthy();
    }
  });

  it('sits above the Legacy drawer', () => {
    renderSidebar();
    const pipeline = screen.getByTestId('nav-pipeline-toggle');
    const legacy = screen.getByTestId('nav-legacy-toggle');

    expect(
      pipeline.compareDocumentPosition(legacy) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('starts open and folds away on its own key', async () => {
    renderSidebar();
    expect(screen.getByTestId('nav-pipeline-toggle')).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(screen.getByTestId('nav-pipeline-toggle'));

    expect(screen.queryByTestId('nav-pipeline-jobs')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('hermetra.sidebar.pipelineOpen')).toBe('false');
    // The Legacy drawer keeps its own memory — folding one does not write the other.
    expect(window.localStorage.getItem('hermetra.sidebar.legacyOpen')).toBeNull();
  });

  it('folds only itself away — an open Legacy drawer stays open', async () => {
    window.localStorage.setItem('hermetra.sidebar.legacyOpen', 'true');
    renderSidebar();
    await userEvent.click(screen.getByTestId('nav-pipeline-toggle'));

    expect(screen.queryByTestId('nav-pipeline-jobs')).not.toBeInTheDocument();
    expect(screen.getByTestId('nav-web-remote')).toBeInTheDocument();
  });

  it('opens folded when that is what was left last time', () => {
    window.localStorage.setItem('hermetra.sidebar.pipelineOpen', 'false');
    renderSidebar();

    expect(screen.getByTestId('nav-pipeline-toggle')).toHaveAttribute('aria-expanded', 'false');
  });

  it('carries no module accent either', () => {
    const { container } = renderSidebar('/pipeline/jobs');

    const offenders = [...container.querySelectorAll<HTMLElement>('[class]')]
      .map((el) => el.className)
      .filter((c) => typeof c === 'string' && ACCENT_CLASS.test(c));

    expect(offenders).toEqual([]);
  });

  it('marks the current pipeline route by pressing its row in', () => {
    renderSidebar('/pipeline/storage');
    const active = screen.getByTestId('nav-pipeline-storage');

    expect(active.className).toContain('bg-muted');
    expect(active.className).toContain('shadow-inner');
    expect(screen.getByTestId('nav-pipeline-jobs').className).not.toContain('shadow-inner');
  });
});
