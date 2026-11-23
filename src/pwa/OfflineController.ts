import type { BrowserContext } from '@playwright/test';

/** Toggle network state at the context level so service workers are affected too. */
export class OfflineController {
  constructor(private readonly context: BrowserContext) {}

  async goOffline(): Promise<void> {
    await this.context.setOffline(true);
  }

  async goOnline(): Promise<void> {
    await this.context.setOffline(false);
  }

  async withOffline<T>(fn: () => Promise<T>): Promise<T> {
    await this.goOffline();
    try {
      return await fn();
    } finally {
      await this.goOnline();
    }
  }
}
