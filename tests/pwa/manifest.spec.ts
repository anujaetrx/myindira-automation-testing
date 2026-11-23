import { test, expect } from '@fixtures';
import { ManifestValidator } from '@pwa/ManifestValidator';
import { Tags } from '@utils/constants';

test.describe(`PWA manifest ${Tags.pwa}`, () => {
  test('manifest is linked, valid and has installable icons', async ({ page }) => {
    await page.goto('/');
    const validator = new ManifestValidator(page);

    expect(await validator.href(), 'page must link a manifest').not.toBeNull();
    const manifest = await validator.validate();

    expect(['standalone', 'fullscreen', 'minimal-ui']).toContain(manifest.display);
    expect(ManifestValidator.hasRequiredIcons(manifest)).toBe(true);
  });
});
