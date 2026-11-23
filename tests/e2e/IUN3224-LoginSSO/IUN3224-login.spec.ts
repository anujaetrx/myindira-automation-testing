import { test } from '@fixtures';
import { credentialsFor } from '@config/environment';
import { Tags } from '@utils/constants';

test.describe('Login (Microsoft SSO)', () => {
  test(`admin signs in with Microsoft and lands on the dashboard ${Tags.smoke}`, async ({
    ssoLoginPage,
    microsoftLoginPage,
    dashboardPage,
  }) => {
    await ssoLoginPage.goto();
    await ssoLoginPage.signInWithMicrosoft();
    await microsoftLoginPage.signIn(credentialsFor('admin'));
    await dashboardPage.expectLoaded();
  });

  test(`a visitor without a session only sees the sign-in option ${Tags.regression}`, async ({ ssoLoginPage, page }) => {
    await ssoLoginPage.goto();
    await ssoLoginPage.expectShown();

    await page.goto('/dashboard'); // a protected route must not render for anonymous users
    await ssoLoginPage.expectShown();
  });
});
