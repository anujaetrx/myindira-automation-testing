import { test, expect } from '@fixtures';
import { ResponsiveChecks } from '@mobile/ResponsiveChecks';

/** MD-050: Master Data on phones/tablets. Runs only in the mobile-chrome and mobile-safari projects. */
test.describe('Master Data: mobile layout @master-data', () => {
  test('MD-050 fits the screen and the form is reachable', async ({ adminPage, masterDataPage, isMobile }) => {
    test.skip(!isMobile, 'Mobile-only check');

    await masterDataPage.goto();
    expect(
      await ResponsiveChecks.hasHorizontalOverflow(adminPage),
      `overflowing: ${(await ResponsiveChecks.overflowingElements(adminPage)).join(', ')}`,
    ).toBe(false);

    await masterDataPage.scrollToForm();
    await expect(masterDataPage.dropdown).toBeVisible();
  });
});
