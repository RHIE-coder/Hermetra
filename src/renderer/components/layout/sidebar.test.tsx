// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it('groups the items into one card per section', () => {
    const { container } = renderSidebar('/');
    const cards = container.querySelectorAll('nav > section');

    expect(cards).toHaveLength(3);
    for (const card of cards) {
      expect(card.className).toContain('bg-card');
      expect(card.className).toContain('shadow');
    }
  });
});
