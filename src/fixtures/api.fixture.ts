import { test as base, type APIRequestContext } from '@playwright/test';
import { env } from '@config/environment';
import { timeouts } from '@config/timeouts.config';
import { AuthApiClient } from '@api/clients/AuthApiClient';
import { UserApiClient } from '@api/clients/UserApiClient';
import { OrderApiClient } from '@api/clients/OrderApiClient';
import { MasterDataApiClient } from '@api/clients/MasterDataApiClient';
import { authTest } from './auth.fixture';

type ApiFixtures = {
  apiContext: APIRequestContext;
  authApi: AuthApiClient;
  /** Admin-authenticated clients: used for setup/teardown and API tests. */
  userApi: UserApiClient;
  orderApi: OrderApiClient;
  masterDataApi: MasterDataApiClient;
};

export const apiTest = authTest.extend<ApiFixtures>({
  apiContext: async ({ playwright }, use) => {
    const ctx = await playwright.request.newContext({
      baseURL: env.apiBaseUrl,
      timeout: timeouts.api,
      extraHTTPHeaders: { Accept: 'application/json' },
    });
    await use(ctx);
    await ctx.dispose();
  },
  authApi: async ({ apiContext }, use) => use(new AuthApiClient(apiContext)),
  userApi: async ({ apiContext, authManager }, use) =>
    use(new UserApiClient(apiContext, await authManager.apiAuthFor('admin'))),
  orderApi: async ({ apiContext, authManager }, use) =>
    use(new OrderApiClient(apiContext, await authManager.apiAuthFor('admin'))),
  masterDataApi: async ({ apiContext, authManager }, use) =>
    use(new MasterDataApiClient(apiContext, await authManager.apiAuthFor('admin'))),
});

// `base` is intentionally unused: apiTest builds on authTest so it can reach authManager.
void base;
