import { test, expect, type Page } from '@playwright/test';
import { launchHermetra, closeHermetra, type LaunchedApp } from './fixtures/electron';

const NAV_ITEMS: { testid: string; page: string; group: string }[] = [
  // data-pipeline-nav: six stage screens, in pipeline order. All shells for now.
  { testid: 'nav-pipeline-jobs',       page: 'page-pipeline-jobs',       group: 'Data Pipeline' },
  { testid: 'nav-pipeline-sources',    page: 'page-pipeline-sources',    group: 'Data Pipeline' },
  { testid: 'nav-pipeline-ingestion',  page: 'page-pipeline-ingestion',  group: 'Data Pipeline' },
  { testid: 'nav-pipeline-processing', page: 'page-pipeline-processing', group: 'Data Pipeline' },
  { testid: 'nav-pipeline-storage',    page: 'page-pipeline-storage',    group: 'Data Pipeline' },
  { testid: 'nav-pipeline-insights',   page: 'page-pipeline-insights',   group: 'Data Pipeline' },
  { testid: 'nav-web-remote',        page: 'page-web-remote',        group: 'Web' },
  { testid: 'nav-web-code',          page: 'page-web-code',          group: 'Web' },
  { testid: 'nav-mobile-devices',    page: 'page-mobile-devices',    group: 'Mobile' },
  { testid: 'nav-mobile-code',       page: 'page-mobile-code',       group: 'Mobile' },
  // mobile-inspector-page (P5): Inspector is the 3rd Mobile group item.
  { testid: 'nav-mobile-inspector',  page: 'page-mobile-inspector',  group: 'Mobile' },
  { testid: 'nav-bridge-scenarios',  page: 'page-bridge-scenarios',  group: 'Bridge' },
  { testid: 'nav-bridge-variables',  page: 'page-bridge-variables',  group: 'Bridge' },
  { testid: 'nav-bridge-bus',        page: 'page-bridge-bus',        group: 'Bridge' },
  { testid: 'nav-bridge-events',     page: 'page-bridge-events',     group: 'Bridge' },
];

// Not written as `testid: '...'` on purpose — the surface adapter scrapes that
// shape out of this file to build its screen list, and a toggle is a control,
// not a screen.
const PIPELINE_TOGGLE = 'nav-pipeline-toggle';
const LEGACY_TOGGLE = 'nav-legacy-toggle';

/** Which drawer a row lives in. Each one folds on its own. */
const drawerToggle = (testid: string): string =>
  testid.startsWith('nav-pipeline-') ? PIPELINE_TOGGLE : LEGACY_TOGGLE;

/** Nav rows in a folded drawer are not in the DOM — open the right one first. */
async function revealNav(win: Page, testid: string): Promise<void> {
  if (await win.getByTestId(testid).isVisible().catch(() => false)) return;
  await win.getByTestId(drawerToggle(testid)).click();
}

test.describe.serial('smoke', () => {
  let app: LaunchedApp;

  test.beforeAll(async () => {
    app = await launchHermetra();
  });

  test.afterAll(async () => {
    if (app) await closeHermetra(app);
  });

  test('app boots and sidebar is visible', async () => {
    const win = app.window;
    await expect(win).toHaveTitle(/Hermetra/i);
    await expect(win.locator('aside')).toBeVisible();
  });

  // Must run before anything opens a drawer — the fixture gives each launch a
  // fresh user-data dir, so this is the only test that sees a first launch.
  test('first launch opens Data Pipeline and leaves Legacy folded', async () => {
    const win = app.window;
    await expect(win.getByTestId('nav-pipeline-jobs')).toBeVisible();
    await expect(win.getByTestId('nav-web-remote')).toHaveCount(0);
  });

  test(`all ${NAV_ITEMS.length} sidebar nav items are present`, async () => {
    const win = app.window;
    for (const item of NAV_ITEMS) {
      await revealNav(win, item.testid);
      await expect(win.getByTestId(item.testid), `missing nav: ${item.testid}`).toBeVisible();
    }
  });

  // Every screen this app has lives inside a drawer, so folding one empties that
  // part of the nav — which is the point, and it has to be reversible. The two
  // drawers fold independently.
  test('each drawer folds its own items away and back', async () => {
    const win = app.window;

    await revealNav(win, 'nav-web-remote');
    await win.getByTestId(LEGACY_TOGGLE).click();
    await expect(win.getByTestId('nav-web-remote')).toHaveCount(0);
    await expect(win.getByTestId('nav-pipeline-jobs')).toBeVisible();
    await win.getByTestId(LEGACY_TOGGLE).click();
    await expect(win.getByTestId('nav-web-remote')).toBeVisible();

    await win.getByTestId(PIPELINE_TOGGLE).click();
    await expect(win.getByTestId('nav-pipeline-jobs')).toHaveCount(0);
    await expect(win.getByTestId('nav-web-remote')).toBeVisible();
    await win.getByTestId(PIPELINE_TOGGLE).click();
    await expect(win.getByTestId('nav-pipeline-jobs')).toBeVisible();
  });

  for (const item of NAV_ITEMS) {
    test(`navigates to ${item.testid}`, async () => {
      const win = app.window;
      await revealNav(win, item.testid);
      await win.getByTestId(item.testid).click();
      await expect(
        win.getByTestId(item.page),
        `expected ${item.page} to render after clicking ${item.testid}`,
      ).toBeVisible();
    });
  }
});
