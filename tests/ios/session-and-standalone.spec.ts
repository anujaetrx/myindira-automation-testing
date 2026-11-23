import { test, expect } from '@fixtures';
import { DashboardPage } from '@pages/DashboardPage';
import { SsoLoginPage } from '@pages/SsoLoginPage';
import { simulateInstalledStandalone } from '@ios/StandaloneSimulator';

test.describe('iOS session handling and installed-app simulation @ios', () => {
  test('a session captured once is accepted by iOS Safari (WebKit)', async ({ adminPage }) => {
    const dashboard = new DashboardPage(adminPage);
    await dashboard.goto();
    await dashboard.expectLoaded();
  });

  test('session survives a reload (localStorage persists in WebKit)', async ({ adminPage }) => {
    const dashboard = new DashboardPage(adminPage);
    await dashboard.goto();
    await dashboard.reload();
    await dashboard.expectLoaded();
  });

  test('without the saved session the visitor must sign in', async ({ page, ssoLoginPage }) => {
    await page.goto('/dashboard');
    await ssoLoginPage.expectShown();
  });

  test('app reports the installed (standalone) environment when simulated', async ({ browser }, testInfo) => {
    const context = await browser.newContext({ ...testInfo.project.use });
    await simulateInstalledStandalone(context);
    const page = await context.newPage();
    await page.goto('/');

    expect(await page.evaluate(() => (navigator as unknown as { standalone?: boolean }).standalone)).toBe(true);
    expect(await page.evaluate(() => window.matchMedia('(display-mode: standalone)').matches)).toBe(true);
    await new SsoLoginPage(page).expectShown(); // the app still renders in the simulated installed mode
    await context.close();
  });
});
