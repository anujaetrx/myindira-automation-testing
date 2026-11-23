import { test as base } from '@playwright/test';
import { env, type Env } from '@config/environment';
import { Logger } from '@utils/logger/Logger';

type BaseFixtures = {
  logger: Logger;
  env: Env;
  /** Auto fixture: logs test lifecycle. Does not touch `page`, so API tests stay browserless. */
  lifecycle: void;
};

export const baseTest = base.extend<BaseFixtures>({
  logger: async ({}, use, testInfo) => {
    await use(Logger.for(testInfo.title));
  },

  env: async ({}, use) => {
    await use(env);
  },

  // Override `page` to surface browser-side errors in the run log (only created when a test uses a page).
  page: async ({ page, logger }, use) => {
    page.on('pageerror', (err) => logger.error(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') logger.warn(`console.error: ${msg.text()}`);
    });
    await use(page);
  },

  lifecycle: [
    async ({ logger }, use, testInfo) => {
      logger.info(`START [${testInfo.project.name}] ${testInfo.titlePath.join(' > ')}`);
      await use();
      logger.info(`END   [${testInfo.status}] ${testInfo.title}`);
    },
    { auto: true },
  ],
});
