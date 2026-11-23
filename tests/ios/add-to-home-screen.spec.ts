import { test, expect } from '@fixtures';
import { IosPwaReadiness } from '@ios/IosPwaReadiness';

/**
 * Safari cannot be told to install a PWA, and Playwright cannot tap Safari's Share sheet. What CAN be
 * automated is everything iOS reads to build the home-screen app: icons, manifest, meta tags.
 * The install gesture itself stays a manual/Appium step (docs/ios.md).
 */
test.describe('iOS Add to Home Screen readiness @ios @pwa', () => {
  test('page exposes what iOS needs to install it well', async ({ page }) => {
    await page.goto('/');
    const report = await new IosPwaReadiness(page).check();

    for (const w of report.warnings) test.info().annotations.push({ type: 'warning', description: w });
    for (const p of report.passed) test.info().annotations.push({ type: 'ok', description: p });

    expect(report.errors, `Blocking issues:\n${report.errors.join('\n')}`).toEqual([]);
  });

  test('Safari never fires beforeinstallprompt, so the app must not depend on it', async ({ page }) => {
    await page.addInitScript(() => {
      window.addEventListener('beforeinstallprompt', () => ((window as unknown as { __bip: boolean }).__bip = true));
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle'); // let the app's start-up code run
    expect(await page.evaluate(() => (window as unknown as { __bip?: boolean }).__bip ?? false)).toBe(false);
  });
});
