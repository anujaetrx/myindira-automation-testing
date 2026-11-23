import { test, expect } from '@fixtures';
import { InstallPromptComponent } from '@components/pwa/InstallPrompt.component';
import { Tags } from '@utils/constants';

test.describe(`Installability ${Tags.pwa}`, () => {
  test('app fires beforeinstallprompt and shows its install UI', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'beforeinstallprompt is Chromium-only. Safari/iOS has no install event: see tests/ios/add-to-home-screen.spec.ts');

    // Capture the event before the app's scripts run.
    await page.addInitScript(() => {
      window.addEventListener('beforeinstallprompt', () => {
        (window as unknown as { __bipFired: boolean }).__bipFired = true;
      });
    });

    await page.goto('/');

    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __bipFired?: boolean }).__bipFired))
      .toBe(true);

    await expect(new InstallPromptComponent(page).installButton).toBeVisible();
  });
});
