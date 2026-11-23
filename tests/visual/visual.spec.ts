import { test, expect } from '@fixtures';
import { DashboardPage } from '@pages/DashboardPage';
import { Tags } from '@utils/constants';

test.describe(`Visual ${Tags.visual}`, () => {
  test('dashboard matches baseline', async ({ userPage }) => {
    const dashboard = new DashboardPage(userPage);
    await dashboard.goto();
    await expect(userPage).toHaveScreenshot('dashboard.png', { fullPage: true });
  });
});
