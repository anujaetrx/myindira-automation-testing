import { test as base, type Browser, type Page, type TestInfo } from '@playwright/test';
import { AuthManager } from '@auth/AuthManager';
import { SessionInjector } from '@auth/SessionInjector';
import type { Role } from '@config/environment';

type AuthFixtures = {
  adminPage: Page;
  userPage: Page;
};

type AuthWorkerFixtures = {
  /** One manager per worker: its in-memory de-duplication avoids parallel duplicate logins. */
  authManager: AuthManager;
};

/** Opens a fresh browser context pre-loaded with the role's session. Keeps the project's device settings. */
const rolePage =
  (role: Role) =>
  async (
    { browser, authManager }: { browser: Browser; authManager: AuthManager },
    use: (page: Page) => Promise<void>,
    testInfo: TestInfo,
  ) => {
    const session = await authManager.ensureSession(role);
    const context = await browser.newContext({
      ...testInfo.project.use,
      storageState: session.storageStatePath,
    });
    await SessionInjector.applySessionStorage(context, session);
    await use(await context.newPage());
    await context.close();
  };

export const authTest = base.extend<AuthFixtures, AuthWorkerFixtures>({
  authManager: [
    async ({}, use) => {
      await use(new AuthManager());
    },
    { scope: 'worker' },
  ],
  adminPage: rolePage('admin'),
  userPage: rolePage('user'),
});
