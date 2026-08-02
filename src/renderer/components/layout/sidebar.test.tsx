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

describe('Sidebar — mobile-inspector nav item', () => {
  // AC1: the new nav-mobile-inspector item is present.
  it('AC1: renders a nav-mobile-inspector entry pointing to /mobile/inspector', () => {
    renderSidebar();

    const item = screen.getByTestId('nav-mobile-inspector');
    expect(item).toBeInTheDocument();
    // The NavLink href is set to its `to` prop.
    expect((item as HTMLAnchorElement).getAttribute('href')).toBe('/mobile/inspector');
  });

  // AC1: the existing Mobile group items are unchanged (no churn).
  it('AC1: existing Mobile group items (devices / code) still render', () => {
    renderSidebar();
    expect(screen.getByTestId('nav-mobile-devices')).toBeInTheDocument();
    expect(screen.getByTestId('nav-mobile-code')).toBeInTheDocument();
  });

  // Sanity: the new item is rendered inside the Mobile group, not Bridge / Web.
  // We pin this by checking it appears after nav-mobile-code in DOM order
  // (the spec says "Mobile 그룹 3번째 항목").
  it('AC1: nav-mobile-inspector appears as the 3rd item in the Mobile group (after devices, code)', () => {
    renderSidebar();
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
    const { container } = renderSidebar('/web/remote');

    const offenders = [...container.querySelectorAll<HTMLElement>('[class]')]
      .map((el) => el.className)
      .filter((c) => typeof c === 'string' && ACCENT_CLASS.test(c));

    expect(offenders).toEqual([]);
  });

  it('marks the current route by pressing its row in, not by tinting it', () => {
    renderSidebar('/web/remote');
    const active = screen.getByTestId('nav-web-remote');

    expect(active.className).toContain('bg-muted');
    expect(active.className).toContain('shadow-inner');
    expect(active.className).toContain('font-semibold');
    // No rail: a `before:` bar in the signal colour is the shape that was cut.
    expect(active.className).not.toContain('before:bg-primary');
  });

  it('leaves every other row flush', () => {
    renderSidebar('/web/remote');
    const other = screen.getByTestId('nav-bridge-bus');

    expect(other.className).not.toContain('bg-muted');
    expect(other.className).not.toContain('shadow-inner');
  });

  /**
   * One card now, not three: web / mobile / bridge are shelves inside a single
   * collapsible drawer. A full-bleed band inside a full-bleed band would read as
   * two competing headers, so the shelves are plain muted labels.
   */
  it('groups every item into one collapsible card', () => {
    const { container } = renderSidebar('/');
    const cards = container.querySelectorAll('nav > section');

    expect(cards).toHaveLength(1);
    expect(cards[0]!.className).toContain('bg-card');
    expect(cards[0]!.className).toContain('shadow');
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
    const { container } = renderSidebar('/bridge/bus');

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
 * The drawer starts open because every screen this app has lives inside it —
 * opening collapsed would hide the app from itself. Folding it away is a
 * deliberate act, and one the app does not undo behind your back.
 */
describe('Sidebar — the legacy drawer', () => {
  it('starts open, so the nav is not empty on first launch', () => {
    renderSidebar();

    expect(screen.getByTestId('nav-legacy-toggle')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('nav-web-remote')).toBeInTheDocument();
  });

  it('folds every item away when closed', async () => {
    renderSidebar();
    await userEvent.click(screen.getByTestId('nav-legacy-toggle'));

    for (const id of ['nav-web-remote', 'nav-mobile-devices', 'nav-bridge-bus']) {
      expect(screen.queryByTestId(id), id).not.toBeInTheDocument();
    }
  });

  it('remembers that it was folded away', async () => {
    renderSidebar();
    await userEvent.click(screen.getByTestId('nav-legacy-toggle'));

    expect(window.localStorage.getItem('hermetra.sidebar.legacyOpen')).toBe('false');
  });

  it('opens folded when that is what was left last time', () => {
    window.localStorage.setItem('hermetra.sidebar.legacyOpen', 'false');
    renderSidebar();

    expect(screen.getByTestId('nav-legacy-toggle')).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps every route reachable once open', () => {
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
