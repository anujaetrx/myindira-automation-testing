import type { Page } from '@playwright/test';

export class CacheInspector {
  constructor(private readonly page: Page) {}

  async cacheNames(): Promise<string[]> {
    return this.page.evaluate(() => caches.keys());
  }

  async cachedUrls(cacheName?: string): Promise<string[]> {
    return this.page.evaluate(async (name) => {
      const names = name ? [name] : await caches.keys();
      const urls: string[] = [];
      for (const n of names) {
        const cache = await caches.open(n);
        urls.push(...(await cache.keys()).map((r) => r.url));
      }
      return urls;
    }, cacheName);
  }

  async isCached(urlPart: string): Promise<boolean> {
    return (await this.cachedUrls()).some((u) => u.includes(urlPart));
  }
}
