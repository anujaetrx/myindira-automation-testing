import type { Page } from '@playwright/test';
import { timeouts } from '@config/timeouts.config';

export class ServiceWorkerHelper {
  constructor(private readonly page: Page) {}

  /** Resolves once a service worker is registered AND active for the page. */
  async waitUntilActive(): Promise<void> {
    await this.page.waitForFunction(
      async () => {
        if (!('serviceWorker' in navigator)) return false;
        const reg = await navigator.serviceWorker.getRegistration();
        return reg?.active?.state === 'activated';
      },
      undefined,
      { timeout: timeouts.serviceWorker },
    );
  }

  async isSupported(): Promise<boolean> {
    return this.page.evaluate(() => 'serviceWorker' in navigator);
  }

  async scriptUrl(): Promise<string | null> {
    return this.page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return reg?.active?.scriptURL ?? null;
    });
  }

  async scope(): Promise<string | null> {
    return this.page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return reg?.scope ?? null;
    });
  }

  /** True when the page is controlled by the service worker (needs one reload after first install). */
  async isControlling(): Promise<boolean> {
    return this.page.evaluate(() => !!navigator.serviceWorker.controller);
  }

  async unregisterAll(): Promise<void> {
    await this.page.evaluate(async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    });
  }
}
