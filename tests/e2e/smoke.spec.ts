import { test, expect, type Page } from '@playwright/test';
import { launchHermetra, closeHermetra, type LaunchedApp } from './fixtures/electron';

const NAV_ITEMS: { testid: string; page: string; group: string }[] = [
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
// shape out of this file to build its screen list, and the toggle is a control,
// not a screen.
const LEGACY_TOGGLE = 'nav-legacy-toggle';

/** Nav rows in a folded drawer are not in the DOM — open it first. */
async function revealNav(win: Page, testid: string): Promise<void> {
  if (await win.getByTestId(testid).isVisible().catch(() => false)) return;
  await win.getByTestId(LEGACY_TOGGLE).click();
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

  test('all 9 sidebar nav items are present', async () => {
    const win = app.window;
    await revealNav(win, NAV_ITEMS[0]!.testid);
    for (const item of NAV_ITEMS) {
      await expect(win.getByTestId(item.testid), `missing nav: ${item.testid}`).toBeVisible();
    }
  });

  // The drawer is the only thing in the rail, so folding it empties the nav —
  // which is the point, and it has to be reversible.
  test('the legacy drawer folds every item away and back', async () => {
    const win = app.window;
    await win.getByTestId(LEGACY_TOGGLE).click();
    await expect(win.getByTestId('nav-web-remote')).toHaveCount(0);

    await win.getByTestId(LEGACY_TOGGLE).click();
    await expect(win.getByTestId('nav-web-remote')).toBeVisible();
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
