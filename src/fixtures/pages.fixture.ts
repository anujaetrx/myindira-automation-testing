import { test as base } from '@playwright/test';
import { LoginPage } from '@pages/LoginPage';
import { DashboardPage } from '@pages/DashboardPage';
import { ProfilePage } from '@pages/ProfilePage';
import { SsoLoginPage } from '@pages/SsoLoginPage';
import { MicrosoftLoginPage } from '@pages/MicrosoftLoginPage';

type PageFixtures = {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  profilePage: ProfilePage;
  ssoLoginPage: SsoLoginPage;
  microsoftLoginPage: MicrosoftLoginPage;
};

/** Page objects bound to the default (unauthenticated) `page`. For authenticated pages see auth.fixture. */
export const pagesTest = base.extend<PageFixtures>({
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  dashboardPage: async ({ page }, use) => use(new DashboardPage(page)),
  profilePage: async ({ page }, use) => use(new ProfilePage(page)),
  ssoLoginPage: async ({ page }, use) => use(new SsoLoginPage(page)),
  microsoftLoginPage: async ({ page }, use) => use(new MicrosoftLoginPage(page)),
});
