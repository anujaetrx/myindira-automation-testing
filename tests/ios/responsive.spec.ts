import { test, expect } from '@fixtures';
import { DashboardPage } from '@pages/DashboardPage';
import { ResponsiveChecks } from '@mobile/ResponsiveChecks';

/** iPhone/iPad layout in WebKit. Projects: ios-iphone-se, ios-iphone-14, ios-iphone-15-pro-max, ios-ipad. */
test.describe('iOS responsive layout @ios', () => {
  test('sign-in page has a mobile viewport, fits the screen and has 44pt tap targets', async ({ page }) => {
    await page.goto('/');
    expect(await ResponsiveChecks.hasViewportMeta(page), 'viewport meta').toBe(true);
    expect(
      await ResponsiveChecks.hasHorizontalOverflow(page),
      `overflowing: ${(await ResponsiveChecks.overflowingElements(page)).join(', ')}`,
    ).toBe(false);

    const small = await ResponsiveChecks.smallTapTargets(page, 44); // Apple HIG minimum
    expect(small, `Too small for iOS (44pt): ${JSON.stringify(small.slice(0, 5))}`).toHaveLength(0);
  });

  test('viewport-fit=cover is set so the layout can use the notch/home-indicator safe areas', async ({ page }) => {
    await page.goto('/');
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toMatch(/viewport-fit\s*=\s*cover/);
  });

  test('signed-in dashboard fits the screen', async ({ adminPage }) => {
    const dashboard = new DashboardPage(adminPage);
    await dashboard.goto();
    expect(
      await ResponsiveChecks.hasHorizontalOverflow(adminPage),
      `overflowing: ${(await ResponsiveChecks.overflowingElements(adminPage)).join(', ')}`,
    ).toBe(false);
  });

  test('layout survives rotation', async ({ page }) => {
    await page.goto('/');
    const size = page.viewportSize()!;
    await page.setViewportSize({ width: size.height, height: size.width });
    expect(await ResponsiveChecks.hasHorizontalOverflow(page)).toBe(false);
  });
});
