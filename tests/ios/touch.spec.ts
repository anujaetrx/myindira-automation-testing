import { test, expect } from '@fixtures';
import { DashboardPage } from '@pages/DashboardPage';
import { IosTouch } from '@ios/IosTouch';

test.describe('iOS touch @ios', () => {
  test('menu items respond to a tap', async ({ adminPage }) => {
    const dashboard = new DashboardPage(adminPage);
    await dashboard.goto();

    await new IosTouch(adminPage).tap(dashboard.feedMenuItem);
    await expect(adminPage).not.toHaveURL(/\/dashboard\/?$/);
  });

  test('long pages scroll', async ({ adminPage }) => {
    const dashboard = new DashboardPage(adminPage);
    await dashboard.goto();

    const touch = new IosTouch(adminPage);
    test.skip(!(await touch.isScrollable()), 'Dashboard is not taller than the screen');
    await touch.scrollBy(600);
    await expect.poll(() => touch.scrollY()).toBeGreaterThan(0);
  });
});
